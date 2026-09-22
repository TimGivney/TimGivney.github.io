#!/usr/bin/env python3
"""PartsBender Parts Finder — a single-file local program.

Run it (or double-click PartsFinder.exe) and it opens http://localhost:8765 in
your browser. Everything lives next to the program:

    PartsFinder/
      partsfinder.db     SQLite database (all imports, prices, history)
      raw/               every uploaded workbook, stored untouched
      inbox/             drop .xlsx/.csv files here, then click "Scan inbox"

Only dependency: openpyxl (bundled into the .exe).
"""
from __future__ import annotations

import csv
from email.parser import BytesParser
from email.policy import HTTP
import json
import os
import re
import shutil
import sqlite3
import sys
import threading
import time
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import openpyxl

PORT = int(os.environ.get("PARTSFINDER_PORT", "8765"))
MAX_UPLOAD = 200 * 2**20
if getattr(sys, "frozen", False):
    BASE = Path(sys.executable).resolve().parent
else:
    BASE = Path(__file__).resolve().parent
DATA = BASE / "PartsFinder"
RAW = DATA / "raw"
INBOX = DATA / "inbox"
DB = DATA / "partsfinder.db"
# bundled read-only resources (logo, seed workbooks); PyInstaller unpacks them to sys._MEIPASS
RES = Path(getattr(sys, "_MEIPASS", BASE))
LOGO = RES / "logo.png"
SEED = RES / "seed" if getattr(sys, "frozen", False) else BASE.parent.parent / "data" / "parts" / "raw"
SKIP_SHEETS = {"plan", "priority", "category", "combined data", "combined data phase 1", "oem price comparison"}


def seed_sheet_wanted(file_name: str, sheets: list[str], sheet: str) -> bool:
    """Only master data is pre-loaded: '* Master' sheets where a workbook has them, plus sheets that have
    no master counterpart (50CFM, Atlas Copco); the unclean per-OEM sheets and planning tabs are skipped."""
    s = sheet.lower()
    if s in SKIP_SHEETS:
        return False
    has_masters = any(x.lower().endswith("master") for x in sheets)
    if not has_masters:
        return True
    return s.endswith("master") or not any(x.lower() == s + " master" for x in sheets)

# --------------------------------------------------------------------------- #
# Header understanding
# --------------------------------------------------------------------------- #

# field -> list of regexes matched against a lower-cased, whitespace-collapsed header
FIELD_PATTERNS = {
    "part": [r"^part\s*(number|no\.?|#)?$", r"^part\s*number", r"^partno", r"^part no"],
    "desc": [r"^description english$", r"^description$", r"^name$", r"^oem description$", r"description"],
    "qty": [r"^qty$", r"^quantity$"],
    "assembly": [r"^assembly( number)?$", r"^assembly"],
    "pump": [r"^pump type$", r"^pump( model)?$", r"^model$"],
    "common": [r"^common$", r"^commonality$"],
    "location": [r"^location\s*#?$", r"^item$", r"^partsbender\s*#$", r"^pos(ition)?$"],
    "oem": [r"^oem$", r"^manufacturer$", r"^brand$"],
}
CURRENCY_RE = re.compile(r"\b(usd|aud|eur|eu|gbp|nzd)\b|[$€£]")
DATE_RE = re.compile(r"(19|20)\d\d")
PRICE_WORDS = re.compile(r"\b(cost|price|list|dealer|rrp)\b|\$|€")
NON_PRICE_WORDS = re.compile(r"discount|margin|qty|extended")

KNOWN_OEMS = ["Godwin", "Sykes", "BBA", "Pioneer", "Cornell", "Atlas Copco", "SPP", "Hudig",
              "Multiflo", "Weir", "John Deere", "Selwood", "Xylem", "Flygt", "Grindex"]


def norm_header(h) -> str:
    return re.sub(r"\s+", " ", str(h or "").strip().lower())


def detect_header_row(rows: list[list]) -> int | None:
    """Return the index of the first row that looks like a header (has a part-number column)."""
    for i, row in enumerate(rows[:12]):
        heads = [norm_header(c) for c in row]
        if any(re.search(p, h) for h in heads if h for p in FIELD_PATTERNS["part"]):
            return i
    return None


def map_columns(header: list) -> tuple[dict[str, int], list[dict]]:
    """Map header cells to normalised fields; every cost/price-like column becomes a price field."""
    cols: dict[str, int] = {}
    prices: list[dict] = []
    for idx, raw in enumerate(header):
        h = norm_header(raw)
        if not h:
            continue
        if PRICE_WORDS.search(h) and not NON_PRICE_WORDS.search(h):
            cur = CURRENCY_RE.search(h)
            c = {"$": "USD", "€": "EUR", "£": "GBP", "eu": "EUR"}.get(cur.group(0), cur.group(0).upper()) if cur else None
            d = DATE_RE.search(h)
            date = None
            if d:
                m = re.search(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(19|20)\d\d", h)
                date = (m.group(0) if m else d.group(0)).title()
                if "valid until" in h:
                    date = "valid until " + date
            prices.append({"col": idx, "label": str(raw).replace("\n", " ").strip(), "currency": c, "date": date})
            continue
        for field, pats in FIELD_PATTERNS.items():
            if field in cols:
                continue
            if any(re.search(p, h) for p in pats):
                cols[field] = idx
                break
    for idx, raw in enumerate(header):
        if norm_header(raw) == "description english":
            cols["desc"] = idx
    return cols, prices


STANDARD_HEADER = ["OEM", "Location #", "Part Number", "Description", "Qty", "Assembly", "Pump Type", "Common",
                   "Cost Estimate USD", "List Price USD", "List Price AUD", "Discount"]


def guess_oem(sheet_name: str, file_name: str, sample_oem_values: list[str]) -> str | None:
    vals = [v for v in sample_oem_values if v]
    if vals:
        return max(set(vals), key=vals.count)
    hay = f"{sheet_name} {file_name}".lower()
    for o in KNOWN_OEMS:
        if o.lower() in hay:
            return o
    return None


# --------------------------------------------------------------------------- #
# Normalisation helpers
# --------------------------------------------------------------------------- #

def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = str(v).strip()
    return s or None


def num(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return round(float(v), 2) if v != 0 else None
    if isinstance(v, str):
        s = re.sub(r"[^\d.\-]", "", v)
        try:
            f = float(s)
            return round(f, 2) if f != 0 else None
        except ValueError:
            return None
    return None


def part_key(p: str) -> str:
    return re.sub(r"[^a-z0-9]", "", p.lower())


def pump_key(p: str) -> str:
    return re.sub(r"[^a-z0-9]", "", p.lower())


def split_pump(p: str | None) -> tuple[str | None, str | None]:
    """'CP150i-285mm' -> ('CP150i', '285mm'); 'BA100E D265' -> ('BA100E', 'D265');
    '4622MX-CD4-RP-EM18DB-1, 14"' -> ('4622MX', 'CD4-RP-EM18DB-1, 14"'); plain names -> (name, None)."""
    if not p:
        return None, None
    p = p.strip()
    m = re.match(r"^(.+?)\s*-\s*(\d+(?:\.\d+)?\s*mm)$", p, re.I)
    if m:
        return m.group(1), m.group(2)
    m = re.match(r"^(\S+)\s+(D\d+)$", p, re.I)
    if m:
        return m.group(1), m.group(2)
    if "-RP-" in p.upper() or '"' in p:
        head, _, rest = p.partition("-")
        if rest:
            return head, rest
    return p, None


def split_common(s: str | None) -> list[str]:
    if not s:
        return []
    toks = [t for t in re.split(r"[_/,\s]+", s.strip()) if t]
    out, prefix = [], ""
    for t in toks:
        m = re.match(r"^([A-Za-z]+)(\d.*)$", t)
        if t.isalpha():
            prefix = t
        elif m:
            prefix = m.group(1)
            out.append(t)
        elif re.match(r"^\d", t) and prefix:
            out.append(prefix + t)
        else:
            out.append(t)
    return sorted(set(out))


# --------------------------------------------------------------------------- #
# Reading files
# --------------------------------------------------------------------------- #

def read_sheets(path: Path) -> list[tuple[str, list[list]]]:
    """Return [(sheet_name, rows)] for xlsx/xlsm/csv."""
    if path.suffix.lower() == ".csv":
        with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
            return [(path.stem, [list(r) for r in csv.reader(f)])]
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    try:
        return [(ws.title, [list(r) for r in ws.iter_rows(values_only=True)]) for ws in wb.worksheets]
    finally:
        wb.close()


def analyse_sheet(sheet: str, rows: list[list], file_name: str) -> dict:
    """Understand one sheet: header row, column map, OEM guess, normalised records."""
    hdr = detect_header_row(rows)
    first_data_row = 2
    if hdr is None and rows and clean(rows[0][0]) in KNOWN_OEMS and len(rows[0]) >= 8:
        # headerless sheet in the standard PartsBender 12-column layout
        rows = [STANDARD_HEADER + [None] * max(0, len(rows[0]) - 12)] + rows
        hdr, first_data_row = 0, 1
    if hdr is None:
        return {"sheet": sheet, "usable": False, "reason": "no part-number column found", "rows": len(rows)}
    header = rows[hdr]
    cols, prices = map_columns(header)
    body = rows[hdr + 1:]
    oem_vals = [clean(r[cols["oem"]]) for r in body if "oem" in cols and len(r) > cols["oem"]]
    # only trust per-row OEM values that occur repeatedly; stray part numbers in the OEM column fall back to the sheet OEM
    trusted_oems = {v for v in set(oem_vals) if v and oem_vals.count(v) >= 3}
    oem = guess_oem(sheet, file_name, [v for v in oem_vals if v in trusted_oems])
    recs = []
    for i, row in enumerate(body, start=hdr + first_data_row):
        row = list(row) + [None] * (len(header) + 2)
        part = clean(row[cols["part"]])
        if not part or norm_header(part) in ("part number", "part no.", "part no"):
            continue
        pl = []
        for p in prices:
            v = num(row[p["col"]])
            if v is not None:
                pl.append({"label": p["label"], "value": v, "currency": p["currency"], "date": p["date"]})
        g = lambda f: clean(row[cols[f]]) if f in cols else None  # noqa: E731
        rec = {
            "oem": g("oem") if g("oem") in trusted_oems else None,
            "part": part, "key": part_key(part),
            "desc": g("desc"), "qty": g("qty"), "assembly": g("assembly"),
            "pump": g("pump"), "common": g("common"), "location": g("location"),
            "prices": pl, "row": i,
            "raw": {str(header[j]).strip(): (row[j].isoformat() if hasattr(row[j], "isoformat") else row[j])
                    for j in range(len(header)) if header[j] is not None and row[j] is not None},
        }
        rec["commonPumps"] = split_common(rec["common"])
        recs.append(rec)
    dataset = "parts" if "pump" in cols or "assembly" in cols else ("pricing" if prices and "desc" in cols else "parts")
    return {
        "sheet": sheet, "usable": len(recs) > 0, "header_row": hdr + 1, "rows": len(body),
        "records": recs, "oem": oem, "dataset": dataset,
        "columns": {k: str(header[v]).replace("\n", " ").strip() for k, v in cols.items()},
        "price_columns": [p["label"] for p in prices],
    }


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #

SCHEMA = """
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY, file TEXT, sheet TEXT, oem TEXT, dataset TEXT,
  imported_at TEXT, rows INTEGER, new_parts INTEGER, existing_parts INTEGER,
  price_changes INTEGER, raw_path TEXT, columns TEXT);
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY, import_id INTEGER, oem TEXT, part TEXT, key TEXT, desc TEXT,
  qty TEXT, assembly TEXT, pump TEXT, pump_key TEXT, common TEXT, location TEXT, src_row INTEGER, raw TEXT,
  model TEXT, model_key TEXT, variant TEXT);
CREATE TABLE IF NOT EXISTS common_pumps (record_id INTEGER, pump TEXT, pump_key TEXT);
CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY, record_id INTEGER, import_id INTEGER, key TEXT, oem TEXT,
  label TEXT, value REAL, currency TEXT, date TEXT, imported_at TEXT);
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY, import_id INTEGER, kind TEXT, subject TEXT, detail TEXT,
  status TEXT DEFAULT 'open', created_at TEXT);
CREATE INDEX IF NOT EXISTS ix_rec_key ON records(key);
CREATE INDEX IF NOT EXISTS ix_rec_pump ON records(pump_key);
CREATE INDEX IF NOT EXISTS ix_rec_oem ON records(oem);
CREATE INDEX IF NOT EXISTS ix_rec_model ON records(model_key);
CREATE INDEX IF NOT EXISTS ix_cp_pump ON common_pumps(pump_key);
CREATE INDEX IF NOT EXISTS ix_price_key ON prices(key);
"""


def db() -> sqlite3.Connection:
    con = sqlite3.connect(DB, check_same_thread=False)
    con.row_factory = sqlite3.Row
    cols = {r[1] for r in con.execute("PRAGMA table_info(records)")}
    if cols and "model" not in cols:  # upgrade a database made by an older version
        for c in ("model TEXT", "model_key TEXT", "variant TEXT"):
            con.execute(f"ALTER TABLE records ADD COLUMN {c}")
        for rid, pump in con.execute("SELECT id, pump FROM records WHERE pump IS NOT NULL").fetchall():
            model, variant = split_pump(pump)
            con.execute("UPDATE records SET model=?, model_key=?, variant=? WHERE id=?", (model, pump_key(model), variant, rid))
        con.commit()
    con.executescript(SCHEMA)
    return con


LOCK = threading.Lock()
PREVIEWS: dict[str, dict] = {}


def now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def preview_file(path: Path, con: sqlite3.Connection) -> dict:
    """Analyse a file and compare against the DB without writing anything."""
    sheets = []
    for name, rows in read_sheets(path):
        a = analyse_sheet(name, rows, path.name)
        if not a["usable"]:
            sheets.append({"sheet": name, "usable": False, "reason": a.get("reason", ""), "rows": a["rows"]})
            continue
        keys = {r["key"] for r in a["records"]}
        existing = set()
        for k in keys:
            if con.execute("SELECT 1 FROM records WHERE key=? LIMIT 1", (k,)).fetchone():
                existing.add(k)
        # price changes: same key + label + currency, different latest value
        changes = []
        seen = set()
        for r in a["records"]:
            for p in r["prices"]:
                sig = (r["key"], p["label"], p["currency"])
                if sig in seen:
                    continue
                seen.add(sig)
                old = con.execute(
                    "SELECT value, date, imported_at FROM prices WHERE key=? AND label=? AND IFNULL(currency,'')=IFNULL(?,'') "
                    "ORDER BY id DESC LIMIT 1", sig).fetchone()
                if old and abs(old["value"] - p["value"]) > 0.005:
                    changes.append({"part": r["part"], "label": p["label"], "currency": p["currency"],
                                    "old": old["value"], "old_date": old["date"] or old["imported_at"], "new": p["value"]})
        # possible duplicates: variations that collapse to the same key but differ in text, or same key + different desc
        dupes = {}
        for r in a["records"]:
            dupes.setdefault(r["key"], set()).add(r["part"])
        dupes = [{"key": k, "variants": sorted(v)} for k, v in dupes.items() if len(v) > 1]
        for r in a["records"]:
            other = con.execute("SELECT DISTINCT part FROM records WHERE key=? AND part<>?", (r["key"], r["part"])).fetchall()
            if other:
                dupes.append({"key": r["key"], "variants": sorted({r["part"], *[o["part"] for o in other]})})
        dupes = list({json.dumps(d, sort_keys=True): d for d in dupes}.values())
        # unmatched pumps: pump values never seen before in DB or in this sheet's other rows
        known = {row["pump_key"] for row in con.execute("SELECT DISTINCT pump_key FROM records WHERE pump_key IS NOT NULL")}
        pumps = {r["pump"] for r in a["records"] if r["pump"]}
        unmatched = sorted(p for p in pumps if pump_key(p) not in known)
        # near-duplicate pump names within the sheet (CP100i-243 vs CP100i 243mm)
        near = {}
        for p in pumps | {row["pump"] for row in con.execute("SELECT DISTINCT pump FROM records WHERE pump IS NOT NULL")}:
            near.setdefault(re.sub(r"(mm|\s|-|_)", "", p.lower()), set()).add(p)
        near = [sorted(v) for v in near.values() if len(v) > 1]
        missing_desc = sum(1 for r in a["records"] if not r["desc"])
        sheets.append({
            "sheet": name, "usable": True, "oem": a["oem"], "dataset": a["dataset"],
            "header_row": a["header_row"], "columns": a["columns"], "price_columns": a["price_columns"],
            "rows": len(a["records"]), "distinct_parts": len(keys),
            "existing_parts": len(existing), "new_parts": len(keys - existing),
            "price_changes": changes, "duplicates": dupes, "unmatched_pumps": unmatched,
            "similar_pumps": near, "missing_desc": missing_desc,
            "_records": a["records"],
        })
    pid = f"{int(time.time()*1000)}"
    PREVIEWS[pid] = {"path": str(path), "sheets": sheets}
    return {"preview_id": pid, "file": path.name,
            "sheets": [{k: v for k, v in s.items() if k != "_records"} for s in sheets]}


def commit_import(pid: str, choices: dict, con: sqlite3.Connection) -> tuple[list[dict], Path]:
    """choices: {sheet_name: {"import": bool, "oem": str, "dataset": str}}"""
    pv = PREVIEWS.pop(pid, None)
    if not pv:
        raise ValueError("preview expired — upload again")
    path = Path(pv["path"])
    RAW.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    raw_dest = RAW / f"{stamp} {path.name}"
    if path.resolve() != raw_dest.resolve():
        shutil.copy2(path, raw_dest)
    done = []
    ts = now()
    with LOCK:
        try:
            _commit_sheets(pv, choices, con, path, raw_dest, ts, done)
            con.commit()
        except Exception:
            con.rollback()
            raise
    return done, path


def _commit_sheets(pv: dict, choices: dict, con: sqlite3.Connection, path: Path, raw_dest: Path, ts: str, done: list) -> None:
    for s in pv["sheets"]:
        if not s.get("usable"):
            continue
        ch = choices.get(s["sheet"], {})
        if not ch.get("import", True):
            continue
        oem = ch.get("oem") or s["oem"]
        override = bool(ch.get("oem")) and ch["oem"] != s["oem"]
        dataset = ch.get("dataset") or s["dataset"]
        cur = con.execute(
            "INSERT INTO imports(file,sheet,oem,dataset,imported_at,rows,new_parts,existing_parts,price_changes,raw_path,columns) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (path.name, s["sheet"], oem, dataset, ts, s["rows"], s["new_parts"], s["existing_parts"],
             len(s["price_changes"]), str(raw_dest.relative_to(DATA)), json.dumps(s["columns"])))
        iid = cur.lastrowid
        for r in s["_records"]:
            ro = oem if override else (r["oem"] or oem)
            model, variant = split_pump(r["pump"])
            c2 = con.execute(
                "INSERT INTO records(import_id,oem,part,key,desc,qty,assembly,pump,pump_key,common,location,src_row,raw,model,model_key,variant) "
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (iid, ro, r["part"], r["key"], r["desc"], r["qty"], r["assembly"], r["pump"],
                 pump_key(r["pump"]) if r["pump"] else None, r["common"], r["location"], r["row"],
                 json.dumps(r["raw"], default=str), model, pump_key(model) if model else None, variant))
            rid = c2.lastrowid
            # a pump cell like 'PP66S12_PP66S14_PP88S12' names several pumps; index each of them too
            multi = split_common(r["pump"]) if r["pump"] and "_" in r["pump"] else []
            con.executemany("INSERT INTO common_pumps VALUES(?,?,?)",
                            [(rid, p, pump_key(p)) for p in sorted(set(r["commonPumps"]) | set(multi))])
            con.executemany(
                "INSERT INTO prices(record_id,import_id,key,oem,label,value,currency,date,imported_at) VALUES(?,?,?,?,?,?,?,?,?)",
                [(rid, iid, r["key"], ro, p["label"], p["value"], p["currency"], p["date"], ts) for p in r["prices"]])
        # issues
        iss = []
        for d in s["duplicates"]:
            iss.append(("duplicate_part", d["variants"][0], "Variants: " + " | ".join(d["variants"])))
        for p in s["unmatched_pumps"]:
            iss.append(("unknown_pump", p, f"New pump model in {s['sheet']} — not seen before"))
        for grp in s["similar_pumps"]:
            iss.append(("similar_pumps", grp[0], "May be the same model: " + " | ".join(grp)))
        for ch_ in s["price_changes"]:
            iss.append(("price_change", ch_["part"],
                        f"{ch_['label']} {ch_['currency'] or ''}: {ch_['old']} ({ch_['old_date']}) → {ch_['new']}"))
        if s["missing_desc"]:
            iss.append(("missing_description", s["sheet"], f"{s['missing_desc']} rows have no description"))
        for kind, subj, det in iss:
            exists = con.execute("SELECT 1 FROM issues WHERE kind=? AND subject=? AND detail=? LIMIT 1",
                                 (kind, subj, det)).fetchone()
            if not exists:
                con.execute("INSERT INTO issues(import_id,kind,subject,detail,created_at) VALUES(?,?,?,?,?)",
                            (iid, kind, subj, det, ts))
        done.append({"sheet": s["sheet"], "oem": oem, "rows": s["rows"], "import_id": iid})


# --------------------------------------------------------------------------- #
# Queries
# --------------------------------------------------------------------------- #

def rec_dicts(rows) -> list[dict]:
    return [dict(r) for r in rows]


def q_stats(con) -> dict:
    return {
        "rows": con.execute("SELECT COUNT(*) FROM records").fetchone()[0],
        "parts": con.execute("SELECT COUNT(DISTINCT key) FROM records").fetchone()[0],
        "pumps": con.execute("SELECT COUNT(DISTINCT pump_key) FROM records WHERE pump_key IS NOT NULL").fetchone()[0],
        "oems": [r[0] for r in con.execute("SELECT DISTINCT oem FROM records WHERE oem IS NOT NULL ORDER BY oem")],
        "issues": con.execute("SELECT COUNT(*) FROM issues WHERE status='open'").fetchone()[0],
    }


def q_search(con, q: str, oem: str | None) -> dict:
    nk = part_key(q)
    words = [w for w in q.lower().split() if w]
    like = ["%" + w + "%" for w in words]
    where = ["1=1"]
    params: list = []
    if oem:
        where.append("oem=?")
        params.append(oem)
    # part-number-ish match OR all words in desc/assembly/part
    text_clause = " AND ".join(["(LOWER(part)||' '||LOWER(IFNULL(desc,''))||' '||LOWER(IFNULL(assembly,''))) LIKE ?"] * len(like))
    where.append(f"(key LIKE ? OR ({text_clause}))")
    params += ["%" + nk + "%"] + like
    rows = con.execute(
        f"SELECT key, MIN(part) part, MAX(desc) desc, GROUP_CONCAT(DISTINCT oem) oems, "
        f"COUNT(DISTINCT pump_key) pumps FROM records WHERE {' AND '.join(where)} "
        f"GROUP BY key ORDER BY (key=?) DESC, (key LIKE ?) DESC, part LIMIT 300",
        params + [nk, nk + "%"]).fetchall()
    pumps = [r[0] for r in con.execute(
        "SELECT DISTINCT pump FROM records WHERE pump_key LIKE ? UNION SELECT DISTINCT pump FROM common_pumps WHERE pump_key=? LIMIT 60",
        ("%" + nk + "%", nk))]
    oems = [r[0] for r in con.execute("SELECT DISTINCT oem FROM records WHERE LOWER(oem) LIKE ?", ("%" + q.lower() + "%",))]
    return {"parts": rec_dicts(rows), "pumps": pumps, "oems": oems}


def q_part(con, key: str) -> dict:
    rows = rec_dicts(con.execute(
        "SELECT r.*, i.file, i.sheet, i.imported_at FROM records r JOIN imports i ON i.id=r.import_id WHERE r.key=? ORDER BY r.id",
        (key,)))
    if not rows:
        return {"found": False}
    for r in rows:
        r["raw"] = json.loads(r["raw"]) if r["raw"] else {}
    pumps = sorted({r["pump"] for r in rows if r["pump"]})
    assemblies = sorted({r["assembly"] for r in rows if r["assembly"]})
    common = sorted({c[0] for c in con.execute(
        "SELECT DISTINCT cp.pump FROM common_pumps cp JOIN records r ON r.id=cp.record_id WHERE r.key=?", (key,))})
    prices = rec_dicts(con.execute(
        "SELECT p.oem, p.label, p.value, p.currency, p.date, p.imported_at, i.file, i.sheet FROM prices p JOIN imports i ON i.id=p.import_id "
        "WHERE p.key=? GROUP BY p.oem, p.label, p.currency, p.value, p.date, i.file, i.sheet ORDER BY p.oem, p.label, p.imported_at", (key,)))
    related = []
    if pumps:
        pk = [pump_key(p) for p in pumps]
        ph = ",".join("?" * len(pk))
        asm_clause = ""
        params: list = pk + [key]
        if assemblies:
            asm_clause = f" AND assembly IN ({','.join('?' * len(assemblies))})"
            params += assemblies
        related = rec_dicts(con.execute(
            f"SELECT key, MIN(part) part, MAX(desc) desc FROM records WHERE pump_key IN ({ph}) AND key<>?{asm_clause} "
            "GROUP BY key ORDER BY part LIMIT 40", params))
    # alternates: same description + same OEM, different key (only where description exact)
    alts = []
    d0 = rows[0]["desc"]
    if d0:
        alts = rec_dicts(con.execute(
            "SELECT key, MIN(part) part, oem FROM records WHERE desc=? AND oem=? AND key<>? GROUP BY key LIMIT 20",
            (d0, rows[0]["oem"], key)))
    by_oem = []
    for o in sorted({r["oem"] for r in rows if r["oem"]}):
        orows = [r for r in rows if r["oem"] == o]
        by_oem.append({
            "oem": o,
            "descs": sorted({r["desc"] for r in orows if r["desc"]}),
            "pumps": sorted({r["pump"] for r in orows if r["pump"]}),
            "assemblies": sorted({r["assembly"] for r in orows if r["assembly"]}),
            "prices": [p for p in prices if p["oem"] == o],
            "rows": len(orows)})
    return {"found": True, "key": key, "part": rows[0]["part"], "variants": sorted({r["part"] for r in rows}),
            "by_oem": by_oem, "shared": len(by_oem) > 1,
            "oems": sorted({r["oem"] for r in rows if r["oem"]}), "descs": sorted({r["desc"] for r in rows if r["desc"]}),
            "pumps": pumps, "assemblies": assemblies, "common": common,
            "common_raw": sorted({r["common"] for r in rows if r["common"]}),
            "prices": prices, "related": related, "alternates": alts, "rows": rows}


def q_pump(con, pump: str) -> dict:
    pk = pump_key(pump)
    direct = rec_dicts(con.execute(
        "SELECT * FROM records WHERE pump_key=? OR model_key=? ORDER BY assembly, part", (pk, pk)))
    via = rec_dicts(con.execute(
        "SELECT r.* FROM records r JOIN common_pumps cp ON cp.record_id=r.id WHERE cp.pump_key=? ORDER BY r.assembly, r.part", (pk,)))
    direct_ids = {r["id"] for r in direct}
    rows = direct + [r for r in via if r["id"] not in direct_ids]
    names = sorted({r["pump"] for r in direct}) or [pump]
    variants = sorted({r["variant"] for r in direct if r["variant"]})
    common = sorted({c[0] for c in con.execute(
        "SELECT DISTINCT cp.pump FROM common_pumps cp JOIN records r ON r.id=cp.record_id "
        "WHERE (r.pump_key=? OR r.model_key=?) AND cp.pump_key<>? AND cp.pump_key<>r.pump_key", (pk, pk, pk))})
    # parts unique to this pump (appear on no other pump)
    unique = [r for r in rows if con.execute(
        "SELECT 1 FROM records WHERE key=? AND pump_key IS NOT NULL AND pump_key<>? LIMIT 1", (r["key"], pk)).fetchone() is None
        and con.execute("SELECT 1 FROM records r JOIN common_pumps cp ON cp.record_id=r.id WHERE r.key=? AND cp.pump_key<>? LIMIT 1",
                        (r["key"], pk)).fetchone() is None]
    seen, parts = set(), []
    for r in rows:
        if r["key"] not in seen:
            seen.add(r["key"])
            parts.append(r)
    ukeys = {r["key"] for r in unique}
    model = next((r["model"] for r in direct if r["model"]), pump)
    return {"pump": model if len(names) > 1 else names[0], "names": names, "variants": variants,
            "oems": sorted({r["oem"] for r in rows if r["oem"]}), "direct": bool(direct),
            "common": common, "parts": parts, "unique_keys": sorted(ukeys)}


def q_oem(con, oem: str) -> dict:
    pumps = [r[0] for r in con.execute("SELECT DISTINCT pump FROM records WHERE oem=? AND pump IS NOT NULL ORDER BY pump", (oem,))]
    asm = [r[0] for r in con.execute("SELECT DISTINCT assembly FROM records WHERE oem=? AND assembly IS NOT NULL ORDER BY assembly", (oem,))]
    return {"oem": oem,
            "rows": con.execute("SELECT COUNT(*) FROM records WHERE oem=?", (oem,)).fetchone()[0],
            "parts": con.execute("SELECT COUNT(DISTINCT key) FROM records WHERE oem=?", (oem,)).fetchone()[0],
            "pumps": pumps, "assemblies": asm,
            "imports": rec_dicts(con.execute("SELECT * FROM imports WHERE oem=? ORDER BY id DESC", (oem,)))}


def q_browse(con) -> list[dict]:
    """OEM -> pump model -> variants, for the BROWSE page."""
    out: dict[str, dict] = {}
    for r in con.execute(
            "SELECT oem, model, model_key, pump, variant, COUNT(DISTINCT key) parts FROM records "
            "WHERE pump IS NOT NULL GROUP BY oem, model_key, pump_key ORDER BY oem, model, variant"):
        o = out.setdefault(r["oem"] or "Unknown", {"oem": r["oem"] or "Unknown", "models": {}})
        m = o["models"].setdefault(r["model_key"], {"model": r["model"], "variants": [], "parts": 0})
        m["variants"].append({"pump": r["pump"], "variant": r["variant"], "parts": r["parts"]})
    for o in out.values():
        for mk, m in o["models"].items():
            m["parts"] = con.execute("SELECT COUNT(DISTINCT key) FROM records WHERE model_key=?", (mk,)).fetchone()[0]
        o["models"] = sorted(o["models"].values(), key=lambda m: m["model"].lower())
        o["parts"] = con.execute("SELECT COUNT(DISTINCT key) FROM records WHERE oem=?", (o["oem"],)).fetchone()[0]
    return sorted(out.values(), key=lambda o: o["oem"].lower())


def flush_all(con: sqlite3.Connection) -> None:
    """Empty the database (raw/ copies are kept on disk)."""
    with LOCK:
        for t in ("prices", "common_pumps", "records", "issues", "imports"):
            con.execute(f"DELETE FROM {t}")
        con.commit()
        con.execute("VACUUM")
    PREVIEWS.clear()


def q_common(con, a: str, b: str) -> dict:
    """Parts appearing on both pump a and pump b (directly or via Common field)."""
    def keys_for(p):
        pk = pump_key(p)
        return {r[0] for r in con.execute(
            "SELECT key FROM records WHERE pump_key=? UNION SELECT r.key FROM records r JOIN common_pumps cp ON cp.record_id=r.id WHERE cp.pump_key=?",
            (pk, pk))}
    ka, kb = keys_for(a), keys_for(b)
    both = sorted(ka & kb)
    parts = rec_dicts(con.execute(
        f"SELECT key, MIN(part) part, MAX(desc) desc, MAX(assembly) assembly FROM records WHERE key IN ({','.join('?'*len(both))}) GROUP BY key ORDER BY part",
        both)) if both else []
    return {"a": a, "b": b, "only_a": len(ka - kb), "only_b": len(kb - ka), "parts": parts}


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #

HTML = r"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PartsBender Parts Finder</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root,[data-theme=light]{--bg:#ffffff;--panel:#f6f7fb;--line:#e3e6ee;--txt:#111827;--dim:#6b7280;--acc:#0a3ad6;--acc2:#0a3ad6;--field:#ffffff;--edge:#cfd5e3;--hover:#f1f3f9;--btntxt:#fff}
[data-theme=dark]{--bg:#0b0d12;--panel:#10131a;--line:#262a33;--txt:#e5e7eb;--dim:#8b93a3;--acc:#5b8cff;--acc2:#8fb0ff;--field:#171a22;--edge:#3a3f4b;--hover:#171a22;--btntxt:#fff}
header img{height:30px;display:block}[data-theme=dark] header img{filter:brightness(0) invert(1)}.theme{background:none;border:1px solid var(--edge);color:var(--dim);border-radius:6px;padding:3px 8px;cursor:pointer;font:11px ui-monospace,Consolas,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.45 system-ui,Segoe UI,sans-serif}
a{color:var(--acc2);text-decoration:none}a:hover{text-decoration:underline}
header{border-bottom:1px solid var(--line);background:var(--panel)}
.wrap{max-width:980px;margin:0 auto;padding:0 16px}
header .wrap{display:flex;align-items:center;gap:20px;height:48px}
.brand{font-family:ui-monospace,Consolas,monospace;letter-spacing:.25em;color:var(--acc);font-weight:600;font-size:13px;cursor:pointer}
nav{margin-left:auto;display:flex;gap:16px;font-family:ui-monospace,Consolas,monospace;font-size:12px}
nav a{color:var(--dim)}nav a.on{color:var(--acc2)}
main{padding:24px 0}
.search{display:flex;align-items:center;gap:8px;border:1px solid var(--edge);background:var(--field);border-radius:8px;padding:8px 12px}
.search:focus-within{border-color:var(--acc)}
.search input{flex:1;background:none;border:0;outline:0;color:var(--txt);font:16px ui-monospace,Consolas,monospace}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;font:11px ui-monospace,Consolas,monospace;color:var(--dim)}
.meta button{background:none;border:0;color:var(--dim);cursor:pointer;font:inherit;padding:0}.meta button.on{color:var(--acc2)}
.meta .right{margin-left:auto}
section{border-top:1px solid var(--line);padding-top:14px;margin-top:20px}
h3{margin:0 0 8px;font:11px ui-monospace,Consolas,monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--acc)}
h2{font:26px ui-monospace,Consolas,monospace;color:var(--acc2);margin:0}
.sub{font-size:18px;margin:2px 0 0}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--edge);background:var(--field);color:var(--txt);border-radius:4px;padding:4px 8px;font:12px ui-monospace,Consolas,monospace;cursor:pointer}
.chip:hover,.chip.on{border-color:var(--acc);color:var(--acc2)}
ul.list{list-style:none;margin:0;padding:0}ul.list li{border-top:1px solid var(--line)}
ul.list li:first-child{border-top:0}
.row{display:flex;flex-wrap:wrap;gap:0 16px;align-items:baseline;width:100%;text-align:left;background:none;border:0;color:inherit;padding:7px 4px;cursor:pointer;font:inherit}
.row:hover{background:var(--hover)}.row .pn{font:14px ui-monospace,Consolas,monospace;color:var(--acc2);min-width:130px}
.row .r{margin-left:auto;font:12px ui-monospace,Consolas,monospace;color:var(--dim)}
table{width:100%;border-collapse:collapse;font:13px ui-monospace,Consolas,monospace}
th{text-align:left;color:var(--dim);font-size:11px;font-weight:normal;padding:4px 6px}td{padding:5px 6px;border-top:1px solid var(--line)}
td.g{color:var(--acc2)}
.dim{color:var(--dim)}.small{font:11px ui-monospace,Consolas,monospace;color:var(--dim)}
.drop{border:2px dashed var(--edge);border-radius:10px;padding:36px;text-align:center;color:var(--dim);cursor:pointer}
.drop.over{border-color:var(--acc);color:var(--acc2)}
.btn{background:var(--acc);color:var(--btntxt);border:0;border-radius:6px;padding:8px 16px;font:600 13px system-ui;cursor:pointer}
.btn.sec{background:var(--hover);color:var(--txt)}
.card{border:1px solid var(--line);border-radius:8px;padding:14px;margin-top:12px;background:var(--panel)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0}
.stat{background:var(--field);border-radius:6px;padding:8px 10px}.stat b{display:block;font:20px ui-monospace,Consolas,monospace;color:var(--acc2)}
.stat span{font-size:11px;color:var(--dim)}
select,input[type=text]{background:var(--field);color:var(--txt);border:1px solid var(--edge);border-radius:4px;padding:4px 6px;font:13px ui-monospace,Consolas,monospace}
.warn{color:#b45309}.ok{color:#4ade80}.err{color:#f87171}
details summary{cursor:pointer;color:var(--dim);font-size:12px}
.toast{position:fixed;bottom:16px;right:16px;background:var(--field);border:1px solid var(--acc);padding:10px 14px;border-radius:6px}
</style></head><body>
<header><div class="wrap"><a href="#/"><img src="/logo.png" alt="PartsBender"></a><span class="brand" onclick="nav('#/')">PARTS FINDER</span>
<nav><a href="#/" id="n-search">SEARCH</a><a href="#/browse" id="n-browse">BROWSE</a><a href="#/data" id="n-data">DATA</a><a href="#/review" id="n-review">REVIEW <span id="issuecount"></span></a><button class="theme" id="theme" onclick="toggleTheme()"></button></nav></div></header>
<main><div class="wrap" id="app"></div></main>
<script>
const setTheme=t=>{document.documentElement.dataset.theme=t;localStorage.pfTheme=t;document.getElementById('theme').textContent=t==='dark'?'LIGHT':'DARK'};
const toggleTheme=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
setTheme(localStorage.pfTheme||'light');
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const api=(p,o)=>fetch('/api'+p,o).then(r=>r.json());
let stats={oems:[]},oemFilter='',q='';
const nav=h=>{location.hash=h};
const money=p=>(p.currency||'')+' '+Number(p.value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
function chip(t,h,on){return `<button class="chip${on?' on':''}" onclick="nav('${esc(h).replace(/'/g,'%27')}')">${esc(t)}</button>`}
function partRow(r){return `<li><button class="row" onclick="nav('#/part/${encodeURIComponent(r.key)}')"><span class="pn">${esc(r.part)}</span><span>${esc(r.desc||'—')}</span><span class="r">${esc(r.oems||r.oem||'')}${r.assembly?' · '+esc(r.assembly):''}${r.qty?' · qty '+esc(r.qty):''}${r.pumps!=null?' · '+r.pumps+' pump(s)':''}</span></button></li>`}
function searchBox(){return `<div class="search">🔎 <input id="q" placeholder="Search part number, pump, OEM or description… (or: common BA150 BA200)" value="${esc(q)}" autofocus></div>
<div class="meta">OEM: <button class="${oemFilter?'':'on'}" onclick="setOem('')">All</button>${stats.oems.map(o=>`<button class="${oemFilter===o?'on':''}" onclick="setOem('${esc(o)}')">· ${esc(o)}</button>`).join('')}
<span class="right">${stats.rows?.toLocaleString()} rows · ${stats.parts?.toLocaleString()} parts · ${stats.pumps} pumps</span></div>`}
function setOem(o){oemFilter=o;if(o&&q.trim().length<2){nav('#/oem/'+encodeURIComponent(o));return}if(location.hash!=='#/'&&!location.hash.startsWith('#/q/'))location.hash='#/';else render()}
async function loadStats(){stats=await api('/stats');$('#issuecount').textContent=stats.issues?`(${stats.issues})`:''}
let t;function bindSearch(){const i=$('#q');if(!i)return;i.focus();i.setSelectionRange(i.value.length,i.value.length);i.oninput=()=>{q=i.value;clearTimeout(t);t=setTimeout(doSearch,180);if(location.hash!=='#/'&&!location.hash.startsWith('#/q/'))location.hash='#/'}}
let seq=0;
async function doSearch(){const out=$('#results');if(!out)return;const s=q.trim();const my=++seq;const put=h=>{if(my===seq&&$('#results'))$('#results').innerHTML=h};
 if(s.length<2){out.innerHTML=`<div class="dim small">Try: ${['50818625','3911650100SP','BA200E D328','12 0282 3065','mechanical seal','Pioneer','common BA150 BA200'].map(x=>`<button class="chip" onclick="q='${x}';render();doSearch()">${x}</button>`).join(' ')}</div>`;return}
 const m=s.match(/^(?:common|parts common to)\s+(\S+)\s+(?:and\s+|&\s+|vs\s+)?(\S+)$/i);
 if(m){const d=await api(`/common?a=${encodeURIComponent(m[1])}&b=${encodeURIComponent(m[2])}`);
  put(`<section><h3>Parts common to ${esc(d.a)} and ${esc(d.b)} · ${d.parts.length}</h3><p class="small">${d.only_a} only on ${esc(d.a)} · ${d.only_b} only on ${esc(d.b)}</p><ul class="list">${d.parts.map(partRow).join('')||'<li class="dim">None found.</li>'}</ul></section>`);return}
 const wm=s.match(/^where is (\S+)( used)?\??$/i)||s.match(/^(?:show me everything for|everything for)\s+(\S+)$/i);
 const d=await api(`/search?q=${encodeURIComponent(wm?wm[1]:s)}&oem=${encodeURIComponent(oemFilter)}`);
 let h='';if(d.oems.length)h+=`<section><h3>OEMs</h3><div class="chips">${d.oems.map(o=>chip(o,'#/oem/'+encodeURIComponent(o))).join('')}</div></section>`;
 if(d.pumps.length)h+=`<section><h3>Pumps</h3><div class="chips">${d.pumps.map(p=>chip(p,'#/pump/'+encodeURIComponent(p))).join('')}</div></section>`;
 if(sharedOnly)d.parts=d.parts.filter(r=>(r.oems||'').includes(','));
 h+=`<section><h3>Parts · ${d.parts.length}${d.parts.length>=300?'+':''} <button class="chip ${sharedOnly?'on':''}" style="margin-left:8px" onclick="sharedOnly=!sharedOnly;doSearch()">shared by 2+ companies</button></h3><ul class="list">${d.parts.map(partRow).join('')||'<li class="dim">No parts match.</li>'}</ul></section>`;put(h)}
let sharedOnly=false;
function sec(t,b){return `<section><h3>${t}</h3>${b}</section>`}
const NS='<span class="dim">Not specified in imported source.</span>';
async function viewPart(key){const d=await api('/part/'+encodeURIComponent(key));if(!d.found)return `<p class="dim">Part not found.</p>`;
 let h=`<div><h2>${esc(d.part)}</h2><p class="sub">${esc(d.oems.join(' / '))} — ${esc(d.descs.join(' · ')||'No description')}</p>${d.variants.length>1?`<p class="small">Part-number variants in source: ${esc(d.variants.join(', '))}</p>`:''}</div>`;
 if(d.shared)h+=sec(`Shared across ${d.by_oem.length} companies`,`<table><tr><th>Company</th><th>Pumps</th><th>Assembly</th><th>Description</th><th>Prices</th></tr>${d.by_oem.map(o=>`<tr><td class="g">${chip(o.oem,'#/oem/'+encodeURIComponent(o.oem))}</td><td>${o.pumps.map(p=>chip(p,'#/pump/'+encodeURIComponent(p))).join(' ')||'<span class="dim">—</span>'}</td><td>${esc(o.assemblies.join(', ')||'—')}</td><td>${esc(o.descs.join(' · ')||'—')}</td><td>${o.prices.length?o.prices.map(p=>`<div><span class="g">${money(p)}</span> <span class="dim">${esc(p.label)}${p.date?' · '+esc(p.date):''}</span></div>`).join(''):'<span class="dim">none</span>'}</td></tr>`).join('')}</table>`);
 h+=sec('Used on',d.pumps.length?`<div class="chips">${d.pumps.map(p=>chip(p,'#/pump/'+encodeURIComponent(p))).join('')}</div>`:'<span class="dim">Pump compatibility: Not specified in imported source.</span>');
 h+=sec('Assembly',d.assemblies.length?esc(d.assemblies.join(', ')):NS);
 h+=sec('Common with',d.common.length?`<div class="chips">${d.common.map(p=>chip(p,'#/pump/'+encodeURIComponent(p))).join('')}</div><p class="small">source value: ${esc(d.common_raw.join(' | '))}</p>`:NS);
 h+=sec('Pricing found',d.prices.length?`<table><tr><th>Company</th><th>Source</th><th>Price</th><th>Price date</th><th>Imported</th><th>File</th></tr>${d.prices.map(p=>`<tr><td>${esc(p.oem||'')}</td><td>${esc(p.label)}</td><td class="g">${money(p)}</td><td class="dim">${esc(p.date||'—')}</td><td class="dim">${esc(p.imported_at)}</td><td class="dim">${esc(p.file)} › ${esc(p.sheet)}</td></tr>`).join('')}</table>`:'<span class="dim">No pricing in imported source.</span>');
 if(d.alternates.length)h+=sec('Same description, different part number (check — not confirmed alternates)',`<div class="chips">${d.alternates.map(a=>chip(a.part,'#/part/'+encodeURIComponent(a.key))).join('')}</div>`);
 if(d.related.length)h+=sec('Related parts (same pump & assembly)',`<div class="chips">${d.related.map(x=>chip(x.part+(x.desc?' — '+x.desc:''),'#/part/'+encodeURIComponent(x.key))).join('')}</div>`);
 h+=sec('Source rows',`<ul class="small" style="margin:0;padding-left:16px">${d.rows.map(r=>`<li>${esc(r.file)} › ${esc(r.sheet)} · row ${r.src_row}${r.pump?' · '+esc(r.pump):''}${r.qty?' · qty '+esc(r.qty):''}${r.location?' · loc '+esc(r.location):''} · imported ${esc(r.imported_at)} <details style="display:inline"><summary style="display:inline">raw</summary><code>${esc(JSON.stringify(r.raw))}</code></details></li>`).join('')}</ul>`);
 return h}
let asmFilter='';
async function viewPump(p){const d=await api('/pump/'+encodeURIComponent(p));const asms={};d.parts.forEach(r=>{const a=r.assembly||'Unspecified';asms[a]=(asms[a]||0)+1});
 const uk=new Set(d.unique_keys);
 let h=`<div><h2>${esc(d.pump)}</h2><p class="sub">${esc(d.oems.join(' / ')||'—')}</p>${d.direct?'':'<p class="small">No rows list this pump directly; showing parts whose “Common” field names it.</p>'}${d.variants.length?`<p class="small">Variants: ${d.variants.map((v,i)=>chip(v,'#/pump/'+encodeURIComponent(d.names[i]||v))).join(' ')}</p>`:''}${d.names.length>1&&!d.variants.length?`<p class="small">Name variants: ${esc(d.names.join(' | '))}</p>`:''}</div>`;
 if(d.common.length)h+=sec('Common with',`<div class="chips">${d.common.map(c=>chip(c,'#/pump/'+encodeURIComponent(c))).join('')}</div>`);
 h+=sec('Assembly breakdown',`<div class="chips"><button class="chip ${asmFilter?'':'on'}" onclick="asmFilter='';render()">All · ${d.parts.length}</button>${Object.keys(asms).sort().map(a=>`<button class="chip ${asmFilter===a?'on':''}" onclick="asmFilter=${JSON.stringify(a)};render()">${esc(a)} · ${asms[a]}</button>`).join('')}</div>`);
 const list=d.parts.filter(r=>!asmFilter||(r.assembly||'Unspecified')===asmFilter);
 h+=sec(`Parts found · ${list.length} <span class="dim">(${uk.size} unique to this pump ★)</span>`,`<ul class="list">${list.map(r=>partRow({...r,part:(uk.has(r.key)?'★ ':'')+r.part})).join('')}</ul>`);
 return h}
let browse=null;
async function viewBrowse(oem,model){browse=browse||await api('/browse');
 let h=`<h2 style="font-size:20px">BROWSE</h2><p class="dim">Pick a company, then a pump model.</p>`;
 h+=sec('Company',`<div class="chips">${browse.map(o=>chip(`${o.oem} · ${o.parts}`,'#/browse/'+encodeURIComponent(o.oem),o.oem===oem)).join('')}</div>`);
 const o=browse.find(x=>x.oem===oem);if(!o)return h;
 h+=sec(`Pump models · ${o.models.length}`,`<div class="chips">${o.models.map(m=>chip(`${m.model} · ${m.parts}`,'#/browse/'+encodeURIComponent(oem)+'/'+encodeURIComponent(m.model),m.model===model)).join('')}</div>`);
 const m=o.models.find(x=>x.model===model);if(!m)return h;
 if(m.variants.length>1||m.variants[0].variant)h+=sec('Variants',`<div class="chips">${m.variants.map(v=>chip(`${v.variant||v.pump} · ${v.parts}`,'#/pump/'+encodeURIComponent(v.pump))).join('')}</div><p class="small">Click a variant for just that build, or see all parts for the model below.</p>`);
 h+=`<div style="margin-top:20px">${await viewPump(model)}</div>`;return h}
async function viewOem(o){const d=await api('/oem/'+encodeURIComponent(o));
 let h=`<div><h2>${esc(d.oem.toUpperCase())}</h2><p class="sub">${d.rows.toLocaleString()} rows · ${d.parts.toLocaleString()} distinct part numbers</p></div>`;
 h+=sec(`Pump types · ${d.pumps.length}`,d.pumps.length?`<div class="chips">${d.pumps.map(p=>chip(p,'#/pump/'+encodeURIComponent(p))).join('')}</div>`:NS);
 h+=sec(`Assemblies · ${d.assemblies.length}`,d.assemblies.length?esc(d.assemblies.slice(0,80).join(' · ')):NS);
 h+=sec('Imports',`<table><tr><th>Date</th><th>File</th><th>Sheet</th><th>Rows</th></tr>${d.imports.map(i=>`<tr><td class="dim">${esc(i.imported_at)}</td><td>${esc(i.file)}</td><td>${esc(i.sheet)}</td><td class="g">${i.rows}</td></tr>`).join('')}</table>`);
 return h}
async function viewData(){const d=await api('/imports');
 let h=`<h2 style="font-size:20px">DATA</h2><p class="dim">Raw uploads are kept untouched in <code>PartsFinder/raw/</code>. Drop files here or into <code>PartsFinder/inbox/</code> and click Scan inbox.</p>
 <div class="drop" id="drop" onclick="$('#file').click()">Drop Excel / CSV here, or click to choose<input type="file" id="file" multiple accept=".xlsx,.xlsm,.csv" style="display:none"></div>
 <p><button class="btn sec" onclick="scanInbox()">Scan inbox folder</button> <button class="btn sec" style="color:#f87171" onclick="flushAll()">Flush ALL data…</button> <span class="small">${esc(d.inbox.length)} file(s) waiting: ${esc(d.inbox.join(', '))}</span></p><div id="preview"></div>`;
 h+=sec('Import history',d.imports.length?`<table><tr><th>Date</th><th>File</th><th>Sheet</th><th>OEM</th><th>Type</th><th>Rows</th><th>New</th><th>Existing</th><th>Price Δ</th><th>Raw copy</th></tr>${d.imports.map(i=>`<tr><td class="dim">${esc(i.imported_at)}</td><td>${esc(i.file)}</td><td>${esc(i.sheet)}</td><td>${esc(i.oem||'?')}</td><td class="dim">${esc(i.dataset)}</td><td class="g">${i.rows}</td><td>${i.new_parts}</td><td>${i.existing_parts}</td><td>${i.price_changes}</td><td class="dim">${esc(i.raw_path)}</td></tr>`).join('')}</table>`:'<span class="dim">Nothing imported yet.</span>');
 setTimeout(()=>{const dz=$('#drop'),f=$('#file');if(!dz)return;dz.ondragover=e=>{e.preventDefault();dz.classList.add('over')};dz.ondragleave=()=>dz.classList.remove('over');dz.ondrop=e=>{e.preventDefault();dz.classList.remove('over');upload(e.dataTransfer.files)};f.onchange=()=>upload(f.files)},0);
 return h}
async function flushAll(){if(!confirm('Delete EVERYTHING in the database (all imports, parts, prices, review items)?\nRaw spreadsheet copies in PartsFinder/raw/ are kept.'))return;
 if(prompt('Type FLUSH to confirm')!=='FLUSH')return;const d=await api('/flush',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:'FLUSH'})});
 if(d.error){toast(d.error,true);return}browse=null;toast('Database emptied — drop a new spreadsheet to start again');await loadStats();render()}
async function upload(files){for(const f of files){const fd=new FormData();fd.append('file',f);$('#preview').innerHTML='<p class="dim">Analysing '+esc(f.name)+'…</p>';const d=await api('/upload',{method:'POST',body:fd});showPreview(d)}}
async function scanInbox(){const d=await api('/imports');if(!d.inbox.length){toast('Inbox is empty');return}for(const n of d.inbox){$('#preview').innerHTML='<p class="dim">Analysing '+esc(n)+'…</p>';const p=await api('/inbox?name='+encodeURIComponent(n));showPreview(p)}}
function showPreview(d){if(d.error){$('#preview').innerHTML=`<div class="card err">${esc(d.error)}</div>`;return}
 let h=`<div class="card"><h3>Import preview — ${esc(d.file)}</h3>`;
 d.sheets.forEach((s,i)=>{if(!s.usable){h+=`<p class="small">Sheet “${esc(s.sheet)}” skipped: ${esc(s.reason)} (${s.rows} rows)</p>`;return}
  h+=`<div class="card"><label><input type="checkbox" id="imp${i}" checked> <b>${esc(s.sheet)}</b></label> &nbsp; OEM: <input type="text" id="oem${i}" value="${esc(s.oem||'')}" placeholder="unknown" list="oems"> &nbsp; Dataset: <select id="ds${i}"><option ${s.dataset==='parts'?'selected':''}>parts</option><option ${s.dataset==='pricing'?'selected':''}>pricing</option><option>pump parts</option><option>reference</option></select>
  <p class="small">header row ${s.header_row} · columns: ${Object.entries(s.columns).map(([k,v])=>`${k}=“${esc(v)}”`).join(', ')} · price columns: ${esc(s.price_columns.join(' | ')||'none')}</p>
  <div class="stats"><div class="stat"><b>${s.rows}</b><span>rows found</span></div><div class="stat"><b>${s.existing_parts}</b><span>existing parts</span></div><div class="stat"><b>${s.new_parts}</b><span>new parts</span></div><div class="stat"><b class="${s.price_changes.length?'warn':''}">${s.price_changes.length}</b><span>price changes</span></div><div class="stat"><b class="${s.duplicates.length?'warn':''}">${s.duplicates.length}</b><span>possible duplicates</span></div><div class="stat"><b class="${s.unmatched_pumps.length?'warn':''}">${s.unmatched_pumps.length}</b><span>new pump names</span></div><div class="stat"><b>${s.missing_desc}</b><span>no description</span></div></div>
  ${s.price_changes.length?`<details><summary>Price changes</summary><table>${s.price_changes.slice(0,200).map(c=>`<tr><td>${esc(c.part)}</td><td class="dim">${esc(c.label)}</td><td>${esc(c.currency||'')} ${c.old} <span class="dim">(${esc(c.old_date)})</span></td><td class="g">→ ${c.new}</td></tr>`).join('')}</table></details>`:''}
  ${s.duplicates.length?`<details><summary>Possible duplicate part numbers</summary><ul class="small">${s.duplicates.slice(0,200).map(x=>`<li>${esc(x.variants.join(' | '))}</li>`).join('')}</ul></details>`:''}
  ${s.unmatched_pumps.length?`<details><summary>Pump names not seen before</summary><p class="small">${esc(s.unmatched_pumps.join(' · '))}</p></details>`:''}
  ${s.similar_pumps.length?`<details><summary>Pump names that may be the same model</summary><ul class="small">${s.similar_pumps.map(g=>`<li>${esc(g.join(' | '))}</li>`).join('')}</ul></details>`:''}
  </div>`});
 h+=`<datalist id="oems">${stats.oems.map(o=>`<option>${esc(o)}</option>`).join('')}</datalist><p><button class="btn" onclick='doImport(${JSON.stringify(d.preview_id)},${JSON.stringify(d.sheets.map(s=>s.sheet))})'>IMPORT</button> <button class="btn sec" onclick="$('#preview').innerHTML=''">Cancel</button></p></div>`;
 $('#preview').innerHTML=h}
async function doImport(pid,sheets){const choices={};sheets.forEach((s,i)=>{const c=$('#imp'+i);if(!c)return;choices[s]={import:c.checked,oem:$('#oem'+i).value||null,dataset:$('#ds'+i).value}});
 const d=await api('/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preview_id:pid,choices})});
 if(d.error){toast(d.error,true);return}toast('Imported '+d.done.map(x=>`${x.sheet} (${x.rows})`).join(', '));browse=null;await loadStats();render()}
async function viewReview(){const d=await api('/issues');const kinds={};d.forEach(i=>{kinds[i.kind]=(kinds[i.kind]||0)+1});
 const label={duplicate_part:'possible duplicate part numbers',unknown_pump:'new / unknown pump models',similar_pumps:'pump names that may be the same model',price_change:'price changes detected',missing_description:'descriptions need review'};
 let h=`<h2 style="font-size:20px">REVIEW · ${d.length} open</h2><p class="dim">Nothing here is merged automatically. Resolve items when you have time; the source rows are never altered.</p>`;
 h+=`<div class="stats">${Object.entries(kinds).map(([k,n])=>`<div class="stat"><b class="warn">${n}</b><span>${label[k]||k}</span></div>`).join('')}</div>`;
 h+=`<table><tr><th>Kind</th><th>Subject</th><th>Detail</th><th>Found</th><th></th></tr>${d.map(i=>`<tr><td class="dim">${esc(label[i.kind]||i.kind)}</td><td class="g">${esc(i.subject)}</td><td>${esc(i.detail)}</td><td class="dim">${esc(i.created_at)}</td><td><button class="chip" onclick="resolve(${i.id})">resolve</button></td></tr>`).join('')}</table>`;
 return h}
async function resolve(id){await api('/issues/'+id+'/resolve',{method:'POST'});await loadStats();render()}
function toast(m,err){const t=document.createElement('div');t.className='toast'+(err?' err':'');t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3500)}
async function render(){const h=location.hash||'#/';const app=$('#app');['search','browse','data','review'].forEach(n=>$('#n-'+n).classList.toggle('on',h.startsWith('#/'+n)||(n==='search'&&!/^#\/(browse|data|review)/.test(h))));
 const parts=h.slice(2).split('/');const kind=parts[0]||'';const arg=decodeURIComponent(parts.slice(1).join('/'));
 if(kind==='data'){app.innerHTML=await viewData();return}if(kind==='browse'){app.innerHTML=await viewBrowse(parts[1]?decodeURIComponent(parts[1]):'',parts[2]?decodeURIComponent(parts[2]):'');window.scrollTo(0,0);return}if(kind==='review'){app.innerHTML=await viewReview();return}
 let body='';if(kind==='part')body=await viewPart(arg);else if(kind==='pump')body=await viewPump(arg);else if(kind==='oem')body=await viewOem(arg);
 app.innerHTML=searchBox()+(body?`<div style="margin-top:20px">${body}</div>`:'<div id="results" style="margin-top:20px"></div>');bindSearch();if(!body)doSearch();window.scrollTo(0,0)}
window.onhashchange=render;loadStats().then(render);
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    con: sqlite3.Connection

    def log_message(self, *a):  # quiet
        pass

    def send_json(self, obj, code=200):
        data = json.dumps(obj, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urlparse(self.path)
        qs = {k: v[0] for k, v in parse_qs(u.query).items()}
        p = u.path
        con = self.server.con  # type: ignore[attr-defined]
        try:
            if p == "/" or (not p.startswith("/api/") and p != "/logo.png"):
                data = HTML.encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            if p == "/logo.png" and LOGO.exists():
                data = LOGO.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            if p == "/api/stats":
                return self.send_json(q_stats(con))
            if p == "/api/search":
                return self.send_json(q_search(con, qs.get("q", ""), qs.get("oem") or None))
            if p == "/api/common":
                return self.send_json(q_common(con, qs.get("a", ""), qs.get("b", "")))
            if p.startswith("/api/part/"):
                return self.send_json(q_part(con, unquote(p[10:])))
            if p.startswith("/api/pump/"):
                return self.send_json(q_pump(con, unquote(p[10:])))
            if p.startswith("/api/oem/"):
                return self.send_json(q_oem(con, unquote(p[9:])))
            if p == "/api/browse":
                return self.send_json(q_browse(con))
            if p == "/api/imports":
                INBOX.mkdir(parents=True, exist_ok=True)
                inbox = sorted(f.name for f in INBOX.iterdir() if f.suffix.lower() in (".xlsx", ".xlsm", ".csv") and not f.name.startswith("~$"))
                return self.send_json({"imports": rec_dicts(con.execute("SELECT * FROM imports ORDER BY id DESC")), "inbox": inbox})
            if p == "/api/inbox":
                f = INBOX / Path(qs.get("name", "")).name
                if not f.exists():
                    return self.send_json({"error": "file not found in inbox"}, 404)
                return self.send_json(preview_file(f, con))
            if p == "/api/issues":
                return self.send_json(rec_dicts(con.execute("SELECT * FROM issues WHERE status='open' ORDER BY kind, subject")))
            self.send_json({"error": "not found"}, 404)
        except Exception as e:  # noqa: BLE001
            self.send_json({"error": f"{type(e).__name__}: {e}"}, 500)

    def do_POST(self):
        u = urlparse(self.path)
        p = u.path
        con = self.server.con  # type: ignore[attr-defined]
        try:
            if p == "/api/upload":
                length = int(self.headers.get("Content-Length") or 0)
                if length > MAX_UPLOAD:
                    return self.send_json({"error": f"file too large (limit {MAX_UPLOAD // 2**20} MB)"}, 413)
                raw = (f"Content-Type: {self.headers['Content-Type']}\r\n\r\n").encode() + self.rfile.read(length)
                msg = BytesParser(policy=HTTP).parsebytes(raw)
                item = next((part for part in msg.iter_parts() if part.get_filename()), None)
                if item is None:
                    return self.send_json({"error": "no file in upload"}, 400)
                INBOX.mkdir(parents=True, exist_ok=True)
                dest = INBOX / Path(item.get_filename()).name
                dest.write_bytes(item.get_payload(decode=True))
                return self.send_json(preview_file(dest, con))
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            if p == "/api/import":
                done, src = commit_import(body["preview_id"], body.get("choices", {}), con)
                if src.parent.resolve() == INBOX.resolve() and src.exists():
                    try:
                        src.unlink()
                    except OSError:
                        pass  # still open elsewhere (e.g. Excel); a copy is already in raw/
                return self.send_json({"done": done})
            if p == "/api/flush":
                if body.get("confirm") != "FLUSH":
                    return self.send_json({"error": "confirmation missing"}, 400)
                flush_all(con)
                return self.send_json({"ok": True})
            m = re.match(r"^/api/issues/(\d+)/resolve$", p)
            if m:
                con.execute("UPDATE issues SET status='resolved' WHERE id=?", (m.group(1),))
                con.commit()
                return self.send_json({"ok": True})
            self.send_json({"error": "not found"}, 404)
        except Exception as e:  # noqa: BLE001
            self.send_json({"error": f"{type(e).__name__}: {e}"}, 500)


def seed_if_empty(con: sqlite3.Connection) -> None:
    """First run: load the workbooks bundled with the program so it starts with data."""
    if con.execute("SELECT 1 FROM imports LIMIT 1").fetchone() or not SEED.is_dir():
        return
    for f in sorted(SEED.iterdir()):
        if f.suffix.lower() not in (".xlsx", ".xlsm", ".csv") or f.name.lower().startswith("cleaned"):
            continue
        print(f"  loading bundled {f.name} ...")
        pv = preview_file(f, con)
        names = [s["sheet"] for s in pv["sheets"]]
        choices = {n: {"import": seed_sheet_wanted(f.name, names, n)} for n in names}
        commit_import(pv["preview_id"], choices, con)


def main():
    DATA.mkdir(exist_ok=True)
    RAW.mkdir(exist_ok=True)
    INBOX.mkdir(exist_ok=True)
    con = db()
    seed_if_empty(con)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    srv.con = con  # type: ignore[attr-defined]
    url = f"http://localhost:{PORT}/"
    print(f"PartsBender Parts Finder\n  data folder: {DATA}\n  open {url}  (Ctrl+C to stop)")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
