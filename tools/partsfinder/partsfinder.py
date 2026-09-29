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
PLACEHOLDER_ASSEMBLY = re.compile(r"(sheet\s*\d+|data|oem mapping)", re.I)


def seed_sheet_wanted(file_name: str, sheets: list[str], sheet: str) -> bool:
    """Only master data is pre-loaded: '* Master' sheets where a workbook has them, plus sheets that have
    no master counterpart (50CFM_Pioneer, 50CFM_Cornell, Atlas Copco); the unclean per-OEM sheets and
    planning tabs are skipped."""
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
    "part": [r"^oem part\s*(number|no\.?|#)$", r"^part\s*(number|no\.?|#)?$", r"^part\s*number", r"^partno", r"^part no"],
    "desc": [r"^oem description$", r"^description english$", r"^description$", r"^name$", r"^(?!pb )(.*\b)?description"],
    "pbdesc": [r"^pb description$", r"^partsbender description$"],
    "comments": [r"^comments?$", r"^notes?$", r"^remarks?$"],
    "qty": [r"^qty$", r"^quantity$"],
    "assembly": [r"^assembly( number)?$", r"^assembly"],
    "pump": [r"^pump type$", r"^pump( model)?$", r"^model$"],
    "common": [r"^common$", r"^commonality$"],
    "location": [r"^location\s*#?$", r"^item$", r"^partsbender\s*#$", r"^pos(ition)?$"],
    "oem": [r"^oem$", r"^manufacturer$", r"^brand$"],
    "pb": [r"^pb\s*(number|no\.?|#|num)?$", r"^partsbender\s*(number|no\.?|num)$", r"^pb-?number"],
    "gnum": [r"^g[\s-]*(number|no\.?|#|num)$", r"^g$"],
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
    ranks: dict[str, int] = {}
    prices: list[dict] = []
    for idx, raw in enumerate(header):
        h = norm_header(raw)
        if not h:
            continue
        if PRICE_WORDS.search(h) and not NON_PRICE_WORDS.search(h) and not h.endswith("description"):
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
            rank = next((n for n, p in enumerate(pats) if re.search(p, h)), None)
            if rank is None:
                continue
            # patterns are ordered best-first: 'OEM Part Number' beats 'Part Number', 'OEM Description' beats 'PB Description'
            if field not in cols or rank < ranks[field]:
                cols[field], ranks[field] = idx, rank
            break
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


def multi_pumps(pump: str | None) -> list[str]:
    """'PP66S12_PP66S14_PP88S12' -> ['PP66S12', 'PP66S14', 'PP88S12']; single pump names -> []."""
    if not pump or "_" not in pump:
        return []
    pumps = split_common(pump)
    return pumps if len(pumps) > 1 else []


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
    flags: list[tuple[str, str, str]] = []  # (kind, subject, detail) — questionable data, surfaced on REVIEW, never auto-fixed
    seen_rows: dict[tuple, int] = {}
    for i, row in enumerate(body, start=hdr + first_data_row):
        row = list(row) + [None] * (len(header) + 2)
        g = lambda f: clean(row[cols[f]]) if f in cols else None  # noqa: E731
        rawpart = row[cols["part"]]
        part = clean(rawpart)
        if part and norm_header(part) in ("part number", "part no.", "part no", "oem part number"):
            continue
        if not part:
            # PartsBender-only items carry a PB or G number but no OEM number: keep them, keyed by that number
            part = g("gnum") or g("pb")
            if not part:
                if any(v not in (None, "") for v in row[:len(header)]):
                    flags.append(("blank_part_number", f"row {i}", f"{sheet}: row has data but no OEM / PB / G number — skipped"))
                continue
            flags.append(("no_oem_part_number", part, f"{sheet} row {i}: no OEM part number, listed under its PB/G number"))
        if isinstance(rawpart, str) and rawpart != rawpart.strip():
            flags.append(("whitespace_part_number", part, f"{sheet} row {i}: leading/trailing spaces in {rawpart!r} (trimmed)"))
        pl = []
        for p in prices:
            cell = row[p["col"]]
            v = num(cell)
            if isinstance(cell, str) and re.search(r"[a-z]", re.sub(r"\b(usd|aud|eur|gbp|nzd|ex|inc|gst)\b", "", cell, flags=re.I)):
                v = None  # '2016 List', 'on demand' — text in a price cell is not a price
            if v is not None:
                pl.append({"label": p["label"], "value": v, "currency": p["currency"], "date": p["date"]})
            elif cell not in (None, "") and not (isinstance(cell, (int, float)) and cell == 0):
                flags.append(("non_numeric_price", part, f"{sheet} row {i}: {p['label']} = {cell!r} (not a number, not imported)"))
        qty = g("qty")
        if qty and num(qty) is None:
            flags.append(("non_numeric_qty", part, f"{sheet} row {i}: Qty = {qty!r}"))
        desc = g("desc") or g("pbdesc")
        assembly = g("assembly")
        if assembly and PLACEHOLDER_ASSEMBLY.fullmatch(assembly):
            f = ("placeholder_assembly", assembly, f"{sheet}: Assembly '{assembly}' is a worksheet name, not an assembly — treated as blank")
            if f not in flags:
                flags.append(f)
            assembly = None
        if g("oem") and g("oem") not in trusted_oems:
            flags.append(("unrecognised_oem", part, f"{sheet} row {i}: OEM column says {g('oem')!r} (seen fewer than 3 times) — "
                          f"imported under the sheet's OEM {oem!r}"))
        rec = {
            "oem": g("oem") if g("oem") in trusted_oems else None,
            "part": part, "key": part_key(part),
            "desc": desc, "qty": qty, "assembly": assembly,
            "pump": g("pump"), "common": g("common"), "location": g("location"),
            "pb": g("pb"), "gnum": g("gnum"), "comments": g("comments"),
            "prices": pl, "row": i,
            "raw": {str(header[j]).strip(): (row[j].isoformat() if hasattr(row[j], "isoformat") else row[j])
                    for j in range(len(header)) if header[j] is not None and row[j] is not None},
        }
        rec["commonPumps"] = split_common(rec["common"])
        sig = record_sig(rec)
        if sig in seen_rows:
            flags.append(("duplicate_row", part, f"{sheet} row {i} repeats row {seen_rows[sig]} exactly — imported once"))
            continue
        seen_rows[sig] = i
        recs.append(rec)
    # same part number with different descriptions inside this sheet
    descs: dict[str, set] = {}
    for r in recs:
        if r["desc"]:
            descs.setdefault(r["key"], set()).add(r["desc"])
    for r in recs:
        if len(descs.get(r["key"], ())) > 1 and not any(f[0] == "conflicting_description" and f[1] == r["part"] for f in flags):
            flags.append(("conflicting_description", r["part"], f"{sheet}: " + " | ".join(sorted(descs[r["key"]]))))
    for r in recs:
        by = {p["label"].lower(): p["value"] for p in r["prices"]}
        cost = next((v for k, v in by.items() if "cost" in k), None)
        sell = next((v for k, v in by.items() if "sell" in k), None)
        if cost and sell and sell < cost:
            flags.append(("sell_below_cost", r["part"], f"{sheet} row {r['row']}: sell {sell} < cost {cost}"))
    dup_asm: dict[str, set] = {}
    for r in recs:
        if r["assembly"]:
            dup_asm.setdefault(re.sub(r"[\s\-_]+", "", r["assembly"].lower()), set()).add(r["assembly"])
    for v in dup_asm.values():
        if len(v) > 1:
            flags.append(("similar_assemblies", sorted(v)[0], f"{sheet}: probably the same assembly: " + " | ".join(sorted(v))))
    dataset = "parts" if "pump" in cols or "assembly" in cols else ("pricing" if prices and "desc" in cols else "parts")
    return {
        "sheet": sheet, "usable": len(recs) > 0, "header_row": hdr + 1, "rows": len(body),
        "records": recs, "oem": oem, "dataset": dataset, "flags": flags,
        "columns": {k: str(header[v]).replace("\n", " ").strip() for k, v in cols.items()},
        "price_columns": [p["label"] for p in prices],
        "extra_columns": [str(header[j]).strip() for j in range(len(header)) if header[j] is not None
                          and j not in cols.values() and j not in {p["col"] for p in prices}],
    }


SIG_FIELDS = ("oem", "key", "desc", "qty", "assembly", "pump", "common", "location", "pb", "gnum")


def record_sig(r: dict) -> tuple:
    """What makes two source rows 'the same fact' (prices excluded — they are tracked as history)."""
    return tuple((r.get(f) or "").strip().lower() if isinstance(r.get(f), str) else (r.get(f) or "") for f in SIG_FIELDS)


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #

SCHEMA = """
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY, file TEXT, sheet TEXT, oem TEXT, dataset TEXT,
  imported_at TEXT, rows INTEGER, new_parts INTEGER, existing_parts INTEGER,
  price_changes INTEGER, raw_path TEXT, columns TEXT, skipped INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY, import_id INTEGER, oem TEXT, part TEXT, key TEXT, desc TEXT,
  qty TEXT, assembly TEXT, pump TEXT, pump_key TEXT, common TEXT, location TEXT, src_row INTEGER, raw TEXT,
  model TEXT, model_key TEXT, variant TEXT, pb TEXT, gnum TEXT);
CREATE TABLE IF NOT EXISTS common_pumps (record_id INTEGER, pump TEXT, pump_key TEXT, kind TEXT DEFAULT 'common');
CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY, record_id INTEGER, import_id INTEGER, key TEXT, oem TEXT,
  label TEXT, value REAL, currency TEXT, date TEXT, imported_at TEXT);
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY, import_id INTEGER, kind TEXT, subject TEXT, detail TEXT,
  status TEXT DEFAULT 'open', created_at TEXT);
CREATE TABLE IF NOT EXISTS edits (
  id INTEGER PRIMARY KEY, record_id INTEGER, part TEXT, field TEXT, old TEXT, new TEXT,
  edited_at TEXT, undone INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY, kind TEXT, subject TEXT, title TEXT, text TEXT, created_at TEXT, updated_at TEXT);
CREATE INDEX IF NOT EXISTS ix_notes ON notes(kind, subject);
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
    if cols and "pb" not in cols:
        con.execute("ALTER TABLE records ADD COLUMN pb TEXT")
        con.execute("ALTER TABLE records ADD COLUMN gnum TEXT")
        con.commit()
    imp_cols = {r[1] for r in con.execute("PRAGMA table_info(imports)")}
    if imp_cols and "skipped" not in imp_cols:
        con.execute("ALTER TABLE imports ADD COLUMN skipped INTEGER DEFAULT 0")
        con.commit()
    cp_cols = {r[1] for r in con.execute("PRAGMA table_info(common_pumps)")}
    if cp_cols and "kind" not in cp_cols:
        con.execute("ALTER TABLE common_pumps ADD COLUMN kind TEXT DEFAULT 'common'")
        for rid, pump in con.execute("SELECT id, pump FROM records WHERE instr(pump, '_') > 0").fetchall():
            multi = multi_pumps(pump)
            if multi:
                con.execute("UPDATE records SET model=NULL, model_key=NULL WHERE id=?", (rid,))
                con.execute(f"DELETE FROM common_pumps WHERE record_id=? AND pump_key IN ({','.join('?' * len(multi))})",
                            [rid] + [pump_key(p) for p in multi])
                con.executemany("INSERT INTO common_pumps VALUES(?,?,?,'pump')", [(rid, p, pump_key(p)) for p in multi])
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
        # rows already in the database with identical content are not imported twice (re-uploading a sheet is safe)
        unchanged = 0
        for r in a["records"]:
            r["_dup"] = _already_stored(con, r)
            unchanged += r["_dup"]
        flag_counts: dict[str, int] = {}
        for k, _s, _d in a["flags"]:
            flag_counts[k] = flag_counts.get(k, 0) + 1
        sheets.append({
            "sheet": name, "usable": True, "oem": a["oem"], "dataset": a["dataset"],
            "header_row": a["header_row"], "columns": a["columns"], "price_columns": a["price_columns"],
            "rows": len(a["records"]), "distinct_parts": len(keys),
            "existing_parts": len(existing), "new_parts": len(keys - existing),
            "price_changes": changes, "duplicates": dupes, "unmatched_pumps": unmatched,
            "similar_pumps": near, "missing_desc": missing_desc,
            "unchanged_rows": unchanged, "extra_columns": a["extra_columns"],
            "flags": a["flags"], "flag_counts": flag_counts,
            "_records": a["records"],
        })
    pid = f"{int(time.time()*1000)}"
    PREVIEWS[pid] = {"path": str(path), "sheets": sheets}
    return {"preview_id": pid, "file": path.name,
            "sheets": [{k: v for k, v in s.items() if k != "_records"} for s in sheets]}


def _already_stored(con: sqlite3.Connection, r: dict) -> bool:
    rows = con.execute(
        "SELECT oem,key,desc,qty,assembly,pump,common,location,pb,gnum FROM records WHERE key=? AND IFNULL(pump,'')=IFNULL(?,'') "
        "AND IFNULL(assembly,'')=IFNULL(?,'')", (r["key"], r["pump"], r["assembly"])).fetchall()
    if not rows:
        return False
    sig = record_sig(r)
    for row in rows:
        d = dict(row)
        # a row whose OEM was inferred from the sheet still matches the stored explicit OEM
        if r["oem"] is None:
            d["oem"] = None
        if record_sig(d) == sig:
            return True
    return False


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
        skip_dups = ch.get("skip_unchanged", True)
        cur = con.execute(
            "INSERT INTO imports(file,sheet,oem,dataset,imported_at,rows,new_parts,existing_parts,price_changes,raw_path,columns,skipped) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (path.name, s["sheet"], oem, dataset, ts, s["rows"], s["new_parts"], s["existing_parts"],
             len(s["price_changes"]), str(raw_dest.relative_to(DATA)), json.dumps(s["columns"]),
             s.get("unchanged_rows", 0) if skip_dups else 0))
        iid = cur.lastrowid
        for r in s["_records"]:
            ro = oem if override else (r["oem"] or oem)
            if skip_dups and r.get("_dup"):
                # identical row already stored: only record prices that changed
                for p in r["prices"]:
                    same = con.execute(
                        "SELECT 1 FROM prices WHERE key=? AND label=? AND IFNULL(currency,'')=IFNULL(?,'') AND abs(value-?)<0.005 LIMIT 1",
                        (r["key"], p["label"], p["currency"], p["value"])).fetchone()
                    if same is None:
                        rid0 = con.execute("SELECT id FROM records WHERE key=? ORDER BY id DESC LIMIT 1", (r["key"],)).fetchone()[0]
                        con.execute(
                            "INSERT INTO prices(record_id,import_id,key,oem,label,value,currency,date,imported_at) VALUES(?,?,?,?,?,?,?,?,?)",
                            (rid0, iid, r["key"], ro, p["label"], p["value"], p["currency"], p["date"], ts))
                continue
            # a pump cell like 'PP66S12_PP66S14_PP88S12' is a list of pumps, not a model of its own
            multi = multi_pumps(r["pump"])
            model, variant = (None, None) if multi else split_pump(r["pump"])
            c2 = con.execute(
                "INSERT INTO records(import_id,oem,part,key,desc,qty,assembly,pump,pump_key,common,location,src_row,raw,model,model_key,variant,pb,gnum) "
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (iid, ro, r["part"], r["key"], r["desc"], r["qty"], r["assembly"], r["pump"],
                 pump_key(r["pump"]) if r["pump"] else None, r["common"], r["location"], r["row"],
                 json.dumps(r["raw"], default=str), model, pump_key(model) if model else None, variant,
                 r.get("pb"), r.get("gnum")))
            rid = c2.lastrowid
            mk = {pump_key(p) for p in multi}
            con.executemany("INSERT INTO common_pumps VALUES(?,?,?,'pump')", [(rid, p, pump_key(p)) for p in multi])
            con.executemany("INSERT INTO common_pumps VALUES(?,?,?,'common')",
                            [(rid, p, pump_key(p)) for p in sorted(set(r["commonPumps"])) if pump_key(p) not in mk])
            con.executemany(
                "INSERT INTO prices(record_id,import_id,key,oem,label,value,currency,date,imported_at) VALUES(?,?,?,?,?,?,?,?,?)",
                [(rid, iid, r["key"], ro, p["label"], p["value"], p["currency"], p["date"], ts) for p in r["prices"]])
            if r.get("comments"):
                con.execute("INSERT INTO notes(kind,subject,title,text,created_at,updated_at) VALUES('part',?,?,?,?,?)",
                            (r["key"], f"Comment from {path.name} / {s['sheet']}", r["comments"], ts, ts))
        # issues
        iss = list(s.get("flags", []))
        for col in s.get("extra_columns", []):
            iss.append(("unmapped_column", col, f"{s['sheet']}: column '{col}' not understood — kept in the raw source row only"))
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
        "pumps": con.execute("SELECT COUNT(*) FROM (SELECT DISTINCT model_key FROM records WHERE model_key IS NOT NULL "
                             "UNION SELECT DISTINCT pump_key FROM common_pumps)").fetchone()[0],
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
    text_clause = " AND ".join(["(LOWER(part)||' '||LOWER(IFNULL(desc,''))||' '||LOWER(IFNULL(assembly,''))"
                                "||' '||LOWER(IFNULL(pb,''))||' '||LOWER(IFNULL(gnum,''))) LIKE ?"] * len(like))
    ident = "LOWER(REPLACE(REPLACE(REPLACE(IFNULL({0},''),'-',''),' ',''),'_',''))"
    where.append(f"(key LIKE ? OR {ident.format('pb')} LIKE ? OR {ident.format('gnum')} LIKE ? OR ({text_clause}))")
    params += ["%" + nk + "%"] * 3 + like
    rows = con.execute(
        f"SELECT key, MIN(part) part, MAX(desc) desc, GROUP_CONCAT(DISTINCT oem) oems, "
        f"COUNT(DISTINCT pump_key) pumps FROM records WHERE {' AND '.join(where)} "
        f"GROUP BY key ORDER BY (key=?) DESC, (key LIKE ?) DESC, part LIMIT 300",
        params + [nk, nk + "%"]).fetchall()
    pumps = [r[0] for r in con.execute(
        "SELECT DISTINCT pump FROM records WHERE pump_key LIKE ? AND model_key IS NOT NULL "
        "UNION SELECT DISTINCT pump FROM common_pumps WHERE pump_key LIKE ? LIMIT 60",
        ("%" + nk + "%", "%" + nk + "%"))]
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
    listed = [(c[0], c[1]) for c in con.execute(
        "SELECT DISTINCT cp.pump, cp.kind FROM common_pumps cp JOIN records r ON r.id=cp.record_id WHERE r.key=?", (key,))]
    pumps = sorted({r["pump"] for r in rows if r["pump"] and r["model_key"]} | {p for p, k in listed if k == "pump"})
    assemblies = sorted({r["assembly"] for r in rows if r["assembly"]})
    common = sorted({p for p, k in listed if k == "common"})
    prices = rec_dicts(con.execute(
        "SELECT MIN(p.id) id, p.record_id, p.oem, p.label, p.value, p.currency, p.date, p.imported_at, i.file, i.sheet FROM prices p "
        "JOIN imports i ON i.id=p.import_id "
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
            f"SELECT key, MIN(part) part, MAX(desc) desc, MIN(pump) pump, MIN(assembly) assembly FROM records "
            f"WHERE pump_key IN ({ph}) AND key<>?{asm_clause} GROUP BY key, pump, assembly ORDER BY pump, assembly, part LIMIT 60", params))
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
            "pumps": sorted({p for r in orows if r["pump"] for p in (multi_pumps(r["pump"]) or [r["pump"]])}),
            "assemblies": sorted({r["assembly"] for r in orows if r["assembly"]}),
            "prices": [p for p in prices if p["oem"] == o],
            "rows": len(orows)})
    return {"found": True, "key": key, "part": rows[0]["part"], "variants": sorted({r["part"] for r in rows}),
            "by_oem": by_oem, "shared": len(by_oem) > 1,
            "oems": sorted({r["oem"] for r in rows if r["oem"]}), "descs": sorted({r["desc"] for r in rows if r["desc"]}),
            "pumps": pumps, "assemblies": assemblies, "common": common,
            "common_raw": sorted({r["common"] for r in rows if r["common"]}),
            "pb": sorted({r["pb"] for r in rows if r["pb"]}), "gnum": sorted({r["gnum"] for r in rows if r["gnum"]}),
            "prices": prices, "related": related, "alternates": alts, "rows": rows,
            "notes": q_notes(con, "part", key)}


def q_pump(con, pump: str) -> dict:
    pk = pump_key(pump)
    direct = rec_dicts(con.execute(
        "SELECT r.* FROM records r WHERE r.pump_key=? OR r.model_key=? "
        "OR r.id IN (SELECT record_id FROM common_pumps WHERE pump_key=? AND kind='pump') ORDER BY r.assembly, r.part", (pk, pk, pk)))
    via = rec_dicts(con.execute(
        "SELECT r.* FROM records r JOIN common_pumps cp ON cp.record_id=r.id WHERE cp.pump_key=? AND cp.kind='common' "
        "ORDER BY r.assembly, r.part", (pk,)))
    direct_ids = {r["id"] for r in direct}
    rows = direct + [r for r in via if r["id"] not in direct_ids]
    names = sorted({r["pump"] for r in direct if r["model_key"]})
    if not names:
        names = sorted({c[0] for c in con.execute("SELECT DISTINCT pump FROM common_pumps WHERE pump_key=?", (pk,))}) or [pump]
    variants = sorted({r["variant"] for r in direct if r["variant"]})
    ids = [r["id"] for r in rows]
    common: set[str] = set()
    row_common: dict[int, list[str]] = {}
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        for rid, cpump in con.execute(
                f"SELECT r.id, cp.pump FROM common_pumps cp JOIN records r ON r.id=cp.record_id "
                f"WHERE r.id IN ({','.join('?' * len(chunk))}) AND cp.pump_key<>? AND cp.pump_key<>IFNULL(r.pump_key,'') "
                f"AND cp.pump_key<>IFNULL(r.model_key,'')", chunk + [pk]):
            common.add(cpump)
            row_common.setdefault(rid, []).append(cpump)
    common = sorted(common)
    # parts unique to this pump (appear on no other pump)
    unique = [r for r in rows if con.execute(
        "SELECT 1 FROM records WHERE key=? AND model_key IS NOT NULL AND model_key<>? AND pump_key<>? LIMIT 1", (r["key"], pk, pk)).fetchone() is None
        and con.execute("SELECT 1 FROM records r JOIN common_pumps cp ON cp.record_id=r.id WHERE r.key=? AND cp.pump_key<>? LIMIT 1",
                        (r["key"], pk)).fetchone() is None]
    seen, parts = set(), []
    by_key: dict[str, dict] = {}
    for r in rows:
        if r["key"] not in seen:
            seen.add(r["key"])
            r["common_with"] = []
            by_key[r["key"]] = r
            parts.append(r)
        by_key[r["key"]]["common_with"] = sorted(set(by_key[r["key"]]["common_with"]) | set(row_common.get(r["id"], [])))
    ukeys = {r["key"] for r in unique}
    model = next((r["model"] for r in direct if r["model"]), names[0] if names else pump)
    also_on = sorted({p for r in via if r["pump"] and r["id"] not in direct_ids
                      for p in (multi_pumps(r["pump"]) or [r["pump"]])})
    return {"pump": model if len(names) > 1 else names[0], "names": names, "variants": variants, "via_common": len(via),
            "also_on": also_on,
            "oems": sorted({r["oem"] for r in rows if r["oem"]}), "direct": bool(direct),
            "common": common, "parts": parts, "unique_keys": sorted(ukeys), "notes": q_notes(con, "pump", pk)}


def q_oem(con, oem: str) -> dict:
    tree = next((o for o in q_browse(con) if o["oem"] == oem), None)
    models = tree["models"] if tree else []
    asm = [r[0] for r in con.execute("SELECT DISTINCT assembly FROM records WHERE oem=? AND assembly IS NOT NULL ORDER BY assembly", (oem,))]
    return {"oem": oem,
            "rows": con.execute("SELECT COUNT(*) FROM records WHERE oem=?", (oem,)).fetchone()[0],
            "parts": con.execute("SELECT COUNT(DISTINCT key) FROM records WHERE oem=?", (oem,)).fetchone()[0],
            "models": models, "assemblies": asm,
            "imports": rec_dicts(con.execute("SELECT * FROM imports WHERE oem=? ORDER BY id DESC", (oem,))),
            "notes": q_notes(con, "oem", oem)}


def q_browse(con) -> list[dict]:
    """OEM -> pump model -> variants, for the BROWSE page."""
    out: dict[str, dict] = {}
    for r in con.execute(
            "SELECT oem, model, model_key, pump, variant, COUNT(DISTINCT key) parts FROM records "
            "WHERE model_key IS NOT NULL GROUP BY oem, model_key, pump_key ORDER BY oem, model, variant"):
        o = out.setdefault(r["oem"] or "Unknown", {"oem": r["oem"] or "Unknown", "models": {}})
        m = o["models"].setdefault(r["model_key"], {"model": r["model"], "variants": [], "parts": 0})
        m["variants"].append({"pump": r["pump"], "variant": r["variant"], "parts": r["parts"]})
    # pumps named in a multi-pump cell ('PP66S12_PP66S14') or only in Common fields are models in their own right
    for r in con.execute(
            "SELECT r.oem, cp.pump, cp.pump_key, MIN(cp.kind) kind FROM common_pumps cp JOIN records r ON r.id=cp.record_id "
            "GROUP BY r.oem, cp.pump_key ORDER BY r.oem, cp.pump"):
        o = out.setdefault(r["oem"] or "Unknown", {"oem": r["oem"] or "Unknown", "models": {}})
        if r["pump_key"] not in o["models"] and not any(v["pump"] and pump_key(v["pump"]) == r["pump_key"]
                                                        for m in o["models"].values() for v in m["variants"]):
            o["models"][r["pump_key"]] = {"model": r["pump"], "variants": [], "parts": 0, "common": r["kind"] == "common"}
    for o in out.values():
        for mk, m in o["models"].items():
            m["parts"] = con.execute(
                "SELECT COUNT(DISTINCT key) FROM records WHERE model_key=? OR pump_key=? "
                "OR id IN (SELECT record_id FROM common_pumps WHERE pump_key=?)", (mk, mk, mk)).fetchone()[0]
        o["models"] = sorted(o["models"].values(), key=lambda m: m["model"].lower())
        o["parts"] = con.execute("SELECT COUNT(DISTINCT key) FROM records WHERE oem=?", (o["oem"],)).fetchone()[0]
    return sorted(out.values(), key=lambda o: o["oem"].lower())


# --------------------------------------------------------------------------- #
# Manual edits, notes
# --------------------------------------------------------------------------- #

EDITABLE = ("oem", "part", "desc", "qty", "assembly", "pump", "common", "location", "pb", "gnum")
FIELD_LABELS = {"oem": "Company", "part": "OEM Part Number", "desc": "Description", "qty": "Quantity",
                "assembly": "Assembly", "pump": "Pump", "common": "Common with", "location": "Location",
                "pb": "PB Number", "gnum": "G-Number"}


def _derive(con: sqlite3.Connection, rid: int) -> None:
    """Recompute key / pump_key / model / common_pumps for one record after its text fields changed."""
    r = con.execute("SELECT part, pump, common FROM records WHERE id=?", (rid,)).fetchone()
    multi = multi_pumps(r["pump"])
    model, variant = (None, None) if multi else split_pump(r["pump"])
    con.execute("UPDATE records SET key=?, pump_key=?, model=?, model_key=?, variant=? WHERE id=?",
                (part_key(r["part"] or ""), pump_key(r["pump"]) if r["pump"] else None, model,
                 pump_key(model) if model else None, variant, rid))
    con.execute("UPDATE prices SET key=? WHERE record_id=?", (part_key(r["part"] or ""), rid))
    con.execute("DELETE FROM common_pumps WHERE record_id=?", (rid,))
    mk = {pump_key(p) for p in multi}
    con.executemany("INSERT INTO common_pumps VALUES(?,?,?,'pump')", [(rid, p, pump_key(p)) for p in multi])
    con.executemany("INSERT INTO common_pumps VALUES(?,?,?,'common')",
                    [(rid, p, pump_key(p)) for p in sorted(set(split_common(r["common"]))) if pump_key(p) not in mk])


def _log(con, rid: int | None, part: str | None, field: str, old, new) -> int:
    cur = con.execute("INSERT INTO edits(record_id,part,field,old,new,edited_at) VALUES(?,?,?,?,?,?)",
                      (rid, part, field, old, new, now()))
    return cur.lastrowid


def edit_field(con: sqlite3.Connection, rid: int, field: str, value, log: bool = True) -> dict:
    if field not in EDITABLE:
        raise ValueError(f"field '{field}' cannot be edited")
    value = str(value).strip() if value is not None and str(value).strip() != "" else None
    with LOCK:
        r = con.execute("SELECT * FROM records WHERE id=?", (rid,)).fetchone()
        if not r:
            raise ValueError("row no longer exists")
        if field == "part" and not value:
            raise ValueError("a part number is required")
        old = r[field]
        if old == value:
            return {"ok": True, "key": r["key"], "unchanged": True}
        con.execute(f"UPDATE records SET {field}=? WHERE id=?", (value, rid))
        if field == "oem":
            con.execute("UPDATE prices SET oem=? WHERE record_id=?", (value, rid))
        _derive(con, rid)
        eid = _log(con, rid, r["part"], field, old, value) if log else None
        key = con.execute("SELECT key FROM records WHERE id=?", (rid,)).fetchone()[0]
        con.commit()
    return {"ok": True, "key": key, "edit_id": eid}


def manual_import_id(con: sqlite3.Connection) -> int:
    row = con.execute("SELECT id FROM imports WHERE file='Manual entries' LIMIT 1").fetchone()
    if row:
        return row[0]
    cur = con.execute("INSERT INTO imports(file,sheet,oem,dataset,imported_at,rows,new_parts,existing_parts,price_changes,raw_path,columns) "
                      "VALUES('Manual entries','typed in the app',NULL,'parts',?,0,0,0,0,'',?)", (now(), json.dumps({})))
    return cur.lastrowid


def add_record(con: sqlite3.Connection, fields: dict) -> dict:
    part = str(fields.get("part") or "").strip()
    if not part:
        raise ValueError("a part number is required")
    vals = {f: (str(fields.get(f)).strip() or None) if fields.get(f) is not None else None for f in EDITABLE}
    vals["part"] = part
    with LOCK:
        iid = manual_import_id(con)
        cur = con.execute(
            "INSERT INTO records(import_id,oem,part,key,desc,qty,assembly,pump,common,location,src_row,raw,pb,gnum) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)",
            (iid, vals["oem"], part, part_key(part), vals["desc"], vals["qty"], vals["assembly"], vals["pump"],
             vals["common"], vals["location"], json.dumps({"manual": True}), vals["pb"], vals["gnum"]))
        rid = cur.lastrowid
        _derive(con, rid)
        con.execute("UPDATE imports SET rows=rows+1 WHERE id=?", (iid,))
        _log(con, rid, part, "_added", None, json.dumps(vals))
        con.commit()
    return {"ok": True, "id": rid, "key": part_key(part)}


def delete_record(con: sqlite3.Connection, rid: int) -> dict:
    with LOCK:
        r = con.execute("SELECT * FROM records WHERE id=?", (rid,)).fetchone()
        if not r:
            raise ValueError("row no longer exists")
        snap = {"record": dict(r),
                "prices": rec_dicts(con.execute("SELECT * FROM prices WHERE record_id=?", (rid,)))}
        con.execute("DELETE FROM prices WHERE record_id=?", (rid,))
        con.execute("DELETE FROM common_pumps WHERE record_id=?", (rid,))
        con.execute("DELETE FROM records WHERE id=?", (rid,))
        _log(con, rid, r["part"], "_deleted", json.dumps(snap, default=str), None)
        con.commit()
    return {"ok": True, "key": r["key"]}


def _restore_record(con: sqlite3.Connection, snap: dict) -> None:
    rec = snap["record"]
    cols = ",".join(rec)
    con.execute(f"INSERT OR REPLACE INTO records({cols}) VALUES({','.join('?' * len(rec))})", list(rec.values()))
    for p in snap["prices"]:
        con.execute(f"INSERT OR REPLACE INTO prices({','.join(p)}) VALUES({','.join('?' * len(p))})", list(p.values()))
    _derive(con, rec["id"])


def add_price(con: sqlite3.Connection, rid: int, label: str, value, currency: str | None, date: str | None) -> dict:
    try:
        v = float(str(value).replace(",", "").replace("$", ""))
    except ValueError as e:
        raise ValueError("price must be a number") from e
    with LOCK:
        r = con.execute("SELECT key, oem, part, import_id FROM records WHERE id=?", (rid,)).fetchone()
        if not r:
            raise ValueError("row no longer exists")
        cur = con.execute(
            "INSERT INTO prices(record_id,import_id,key,oem,label,value,currency,date,imported_at) VALUES(?,?,?,?,?,?,?,?,?)",
            (rid, r["import_id"], r["key"], r["oem"], label.strip() or "Price (typed in)", v, (currency or "").upper() or None,
             date or None, now()))
        _log(con, rid, r["part"], "_price_added", None, json.dumps({"id": cur.lastrowid, "label": label, "value": v,
                                                                       "currency": currency, "date": date}))
        con.commit()
    return {"ok": True}


def delete_price(con: sqlite3.Connection, pid: int) -> dict:
    with LOCK:
        p = con.execute("SELECT * FROM prices WHERE id=?", (pid,)).fetchone()
        if not p:
            raise ValueError("price no longer exists")
        part = con.execute("SELECT part FROM records WHERE id=?", (p["record_id"],)).fetchone()
        con.execute("DELETE FROM prices WHERE id=?", (pid,))
        _log(con, p["record_id"], part[0] if part else None, "_price_deleted", json.dumps(dict(p), default=str), None)
        con.commit()
    return {"ok": True}


def rename_pump(con: sqlite3.Connection, old: str, new: str) -> dict:
    """Rename a pump everywhere it appears (pump cells and Common lists), logged as one edit per row."""
    new = new.strip()
    if not new:
        raise ValueError("new name is required")
    ok, nk = pump_key(old), pump_key(new)
    n = 0
    with LOCK:
        ids = {r[0] for r in con.execute(
            "SELECT id FROM records WHERE pump_key=? OR model_key=? OR id IN (SELECT record_id FROM common_pumps WHERE pump_key=?)",
            (ok, ok, ok))}
        for rid in ids:
            r = con.execute("SELECT part, pump, common, model, model_key FROM records WHERE id=?", (rid,)).fetchone()
            if r["pump"] and pump_key(r["pump"]) == ok:
                con.execute("UPDATE records SET pump=? WHERE id=?", (new, rid))
                _log(con, rid, r["part"], "pump", r["pump"], new)
            elif r["pump"] and r["model_key"] == ok and r["model"] and r["model"] in r["pump"]:
                np_ = r["pump"].replace(r["model"], new, 1)
                con.execute("UPDATE records SET pump=? WHERE id=?", (np_, rid))
                _log(con, rid, r["part"], "pump", r["pump"], np_)
            elif r["pump"] and ok in {pump_key(p) for p in multi_pumps(r["pump"])}:
                np_ = "_".join(new if pump_key(p) == ok else p for p in multi_pumps(r["pump"]))
                con.execute("UPDATE records SET pump=? WHERE id=?", (np_, rid))
                _log(con, rid, r["part"], "pump", r["pump"], np_)
            if r["common"] and ok in {pump_key(p) for p in split_common(r["common"])}:
                nc = ", ".join(new if pump_key(p) == ok else p for p in split_common(r["common"]))
                con.execute("UPDATE records SET common=? WHERE id=?", (nc, rid))
                _log(con, rid, r["part"], "common", r["common"], nc)
            _derive(con, rid)
            n += 1
        con.commit()
    return {"ok": True, "rows": n, "pump": new, "key": nk}


def undo_edit(con: sqlite3.Connection, eid: int) -> dict:
    e = con.execute("SELECT * FROM edits WHERE id=?", (eid,)).fetchone()
    if not e:
        raise ValueError("edit not found")
    if e["undone"]:
        return {"ok": True, "already": True}
    f = e["field"]
    with LOCK:
        if f in EDITABLE:
            con.execute(f"UPDATE records SET {f}=? WHERE id=?", (e["old"], e["record_id"]))
            if f == "oem":
                con.execute("UPDATE prices SET oem=? WHERE record_id=?", (e["old"], e["record_id"]))
            if con.execute("SELECT 1 FROM records WHERE id=?", (e["record_id"],)).fetchone():
                _derive(con, e["record_id"])
        elif f == "_added":
            con.execute("DELETE FROM prices WHERE record_id=?", (e["record_id"],))
            con.execute("DELETE FROM common_pumps WHERE record_id=?", (e["record_id"],))
            con.execute("DELETE FROM records WHERE id=?", (e["record_id"],))
        elif f == "_deleted":
            _restore_record(con, json.loads(e["old"]))
        elif f == "_price_added":
            con.execute("DELETE FROM prices WHERE id=?", (json.loads(e["new"])["id"],))
        elif f == "_price_deleted":
            p = json.loads(e["old"])
            con.execute(f"INSERT OR REPLACE INTO prices({','.join(p)}) VALUES({','.join('?' * len(p))})", list(p.values()))
        con.execute("UPDATE edits SET undone=1 WHERE id=?", (eid,))
        con.commit()
    return {"ok": True}


def q_edits(con, limit: int = 300) -> list[dict]:
    out = rec_dicts(con.execute("SELECT * FROM edits ORDER BY id DESC LIMIT ?", (limit,)))
    for e in out:
        e["label"] = FIELD_LABELS.get(e["field"], {"_added": "Row added", "_deleted": "Row deleted",
                                                    "_price_added": "Price added", "_price_deleted": "Price deleted"}.get(e["field"], e["field"]))
    return out


def save_note(con: sqlite3.Connection, body: dict) -> dict:
    text = str(body.get("text") or "").strip()
    kind, subject = body.get("kind"), body.get("subject")
    if kind not in ("part", "pump", "oem", "general") or (kind != "general" and not subject):
        raise ValueError("note needs a kind and subject")
    if not text:
        raise ValueError("note is empty")
    ts = now()
    with LOCK:
        if body.get("id"):
            con.execute("UPDATE notes SET text=?, updated_at=? WHERE id=?", (text, ts, body["id"]))
            nid = body["id"]
        else:
            nid = con.execute("INSERT INTO notes(kind,subject,title,text,created_at,updated_at) VALUES(?,?,?,?,?,?)",
                              (kind, subject or "", body.get("title") or subject or "", text, ts, ts)).lastrowid
        con.commit()
    return {"ok": True, "id": nid}


def q_notes(con, kind: str | None, subject: str | None) -> list[dict]:
    if kind and subject is not None:
        return rec_dicts(con.execute("SELECT * FROM notes WHERE kind=? AND subject=? ORDER BY id DESC", (kind, subject)))
    return rec_dicts(con.execute("SELECT * FROM notes ORDER BY updated_at DESC, id DESC LIMIT 500"))


def flush_all(con: sqlite3.Connection) -> None:
    """Empty the database (raw/ copies and your notes are kept)."""
    with LOCK:
        for t in ("prices", "common_pumps", "records", "issues", "imports", "edits"):
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

SCREENS_HTML = r"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PartsFinder — Screens</title>
<style>
:root,[data-theme=light]{--bg:#e9ebf2;--panel:#f6f7fb;--line:#cfd5e3;--txt:#111827;--dim:#6b7280;--acc:#0a3ad6}
[data-theme=dark]{--bg:#06070a;--panel:#10131a;--line:#2a2f3a;--txt:#e5e7eb;--dim:#8b93a3;--acc:#5b8cff}
*{box-sizing:border-box}html,body{height:100%;margin:0}body{background:var(--bg);color:var(--txt);font:13px system-ui,Segoe UI,sans-serif;overflow:hidden}
#bar{height:40px;display:flex;align-items:center;gap:10px;padding:0 12px;background:var(--panel);border-bottom:1px solid var(--line);font:12px ui-monospace,Consolas,monospace}
#bar img{height:22px}[data-theme=dark] #bar img{filter:brightness(0) invert(1)}#bar .t{letter-spacing:.25em;color:var(--acc);font-weight:600}
#bar button{background:none;border:1px solid var(--line);color:var(--txt);border-radius:6px;padding:3px 9px;cursor:pointer;font:inherit}#bar button:hover{border-color:var(--acc);color:var(--acc)}#bar .sp{margin-left:auto;color:var(--dim)}
#desk{position:absolute;top:40px;left:0;right:0;bottom:0;overflow:auto}
.scr{position:absolute;display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);min-width:320px;min-height:220px;resize:both;overflow:hidden}
.scr.on{border-color:var(--acc);z-index:5}.scr.max{position:fixed!important;top:40px!important;left:0!important;width:100%!important;height:calc(100% - 40px)!important;border-radius:0;z-index:9;resize:none}
.tb{height:30px;display:flex;align-items:center;gap:6px;padding:0 8px;background:var(--panel);border-bottom:1px solid var(--line);cursor:move;user-select:none;font:11px ui-monospace,Consolas,monospace}
.tb .n{color:var(--acc);font-weight:600;letter-spacing:.1em}.tb .ti{flex:1;color:var(--txt);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tb button{background:none;border:0;color:var(--dim);cursor:pointer;font-size:12px;padding:2px 5px;border-radius:4px}.tb button:hover{background:var(--bg);color:var(--txt)}.tb button.x:hover{color:#f87171}
.scr iframe{flex:1;border:0;width:100%;background:#fff}[data-theme=dark] .scr iframe{background:#0b0d12}
.scr.drag iframe{pointer-events:none}
.empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--dim)}
</style></head><body>
<div id="bar"><a href="/" title="Back to the single-screen view"><img src="/logo.png" alt="PartsBender"></a><span class="t">SCREENS</span>
<button onclick="add('#/')">+ Add screen</button><button onclick="tile()" title="Arrange all screens side-by-side">Tile</button><button onclick="if(confirm('Close all screens?'))closeAll()">Close all</button>
<span class="sp">Drag a title bar to move · drag the bottom-right corner to resize · each screen searches and navigates on its own</span><a href="/" style="color:var(--dim)">single screen →</a></div>
<div id="desk"><div class="empty" id="empty">No screens open — click “+ Add screen”.</div></div>
<script>
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));document.documentElement.dataset.theme=localStorage.pfTheme||'light';
window.addEventListener('storage',e=>{if(e.key==='pfTheme'&&e.newValue)document.documentElement.dataset.theme=e.newValue});
let scr=[];try{scr=JSON.parse(localStorage.pfScreens||'[]')}catch(e){scr=[]}
let n=0;const save=()=>{scr.forEach(s=>{const el=document.getElementById(s.id);if(el&&!el.classList.contains('max')){s.x=el.offsetLeft;s.y=el.offsetTop;s.w=el.offsetWidth;s.h=el.offsetHeight}});localStorage.pfScreens=JSON.stringify(scr)};
function add(hash,from){const i=scr.length;const s={id:'s'+Date.now()+Math.floor(Math.random()*1e4),hash:hash||'#/',x:from?from.x+30:20+(i%4)*40,y:from?from.y+30:20+(i%4)*30,w:from?from.w:Math.min(640,innerWidth-60),h:from?from.h:Math.min(560,innerHeight-100),title:''};scr.push(s);draw(s);focus(s.id);save()}
function draw(s){const d=document.createElement('div');d.className='scr';d.id=s.id;d.style.cssText=`left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px`;n++;
 d.innerHTML=`<div class="tb"><span class="n">${scr.indexOf(s)+1}</span><span class="ti" title="">${esc(s.title||s.hash)}</span><button title="Duplicate this screen" onclick="dup('${s.id}')">⧉</button><button title="Maximise / restore" onclick="max('${s.id}')">□</button><button class="x" title="Close this screen" onclick="close_('${s.id}')">✕</button></div><iframe src="/${esc(s.hash)}" name="${s.id}"></iframe>`;
 $('#desk').appendChild(d);$('#empty').style.display='none';
 const tb=d.querySelector('.tb');tb.onmousedown=e=>{if(e.target.tagName==='BUTTON'||d.classList.contains('max'))return;focus(s.id);const ox=e.clientX-d.offsetLeft,oy=e.clientY-d.offsetTop;d.classList.add('drag');const mv=ev=>{d.style.left=Math.max(0,ev.clientX-ox)+'px';d.style.top=Math.max(0,ev.clientY-oy)+'px'};const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);d.classList.remove('drag');save()};document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up)};
 d.onmousedown=()=>focus(s.id);new ResizeObserver(()=>save()).observe(d);d.querySelector('iframe').addEventListener('load',()=>{try{d.querySelector('iframe').contentWindow.focus()}catch(e){}})}
function focus(id){document.querySelectorAll('.scr').forEach(e=>e.classList.toggle('on',e.id===id))}
function hashOf(s){try{return document.getElementById(s.id).querySelector('iframe').contentWindow.location.hash||s.hash}catch(e){return s.hash}}
function dup(id){const s=scr.find(x=>x.id===id);if(!s)return;s.hash=hashOf(s);const el=document.getElementById(id);add(s.hash,{x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight})}
function max(id){const el=document.getElementById(id);if(!el)return;save();el.classList.toggle('max');focus(id);el.querySelector('[title="Maximise / restore"]').textContent=el.classList.contains('max')?'❐':'□'}
function close_(id){scr=scr.filter(x=>x.id!==id);const el=document.getElementById(id);if(el)el.remove();renumber();save();if(!scr.length)$('#empty').style.display=''}
function closeAll(){scr.slice().forEach(s=>close_(s.id))}
function renumber(){scr.forEach((s,i)=>{const el=document.getElementById(s.id);if(el)el.querySelector('.n').textContent=i+1})}
function tile(){const k=scr.length;if(!k)return;const W=$('#desk').clientWidth,H=$('#desk').clientHeight;const cols=Math.ceil(Math.sqrt(k)),rows=Math.ceil(k/cols);const g=10;scr.forEach((s,i)=>{const el=document.getElementById(s.id);el.classList.remove('max');const c=i%cols,r=Math.floor(i/cols);el.style.left=(g+c*(W-g)/cols)+'px';el.style.top=(g+r*(H-g)/rows)+'px';el.style.width=((W-g)/cols-g)+'px';el.style.height=((H-g)/rows-g)+'px'});save()}
window.addEventListener('message',e=>{const m=e.data||{};if(!m.pf)return;const s=scr.find(x=>{try{return document.getElementById(x.id).querySelector('iframe').contentWindow===e.source}catch(err){return false}});
 if(m.pf==='add'){const el=s&&document.getElementById(s.id);add(m.hash||'#/',el?{x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight}:null)}
 if(m.pf==='title'&&s){s.hash=m.hash;s.title=m.title;const t=document.getElementById(s.id).querySelector('.ti');t.textContent=m.title;t.title=m.title;save()}});
window.addEventListener('beforeunload',()=>{scr.forEach(s=>{s.hash=hashOf(s)});save()});
const u=new URLSearchParams(location.search).get('u');
if(scr.length){scr.forEach(draw);if(u&&!scr.some(s=>s.hash===u))add(u);else if(u){focus(scr.find(s=>s.hash===u).id)}}else{add(u||'#/')}
if(u)history.replaceState(null,'','/screens');
</script></body></html>"""

HTML = r"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PartsBender Parts Finder</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root,[data-theme=light]{--bg:#ffffff;--panel:#f6f7fb;--line:#e3e6ee;--txt:#111827;--dim:#6b7280;--acc:#0a3ad6;--acc2:#0a3ad6;--field:#ffffff;--edge:#cfd5e3;--hover:#f1f3f9;--btntxt:#fff}
[data-theme=dark]{--bg:#0b0d12;--panel:#10131a;--line:#262a33;--txt:#e5e7eb;--dim:#8b93a3;--acc:#5b8cff;--acc2:#8fb0ff;--field:#171a22;--edge:#3a3f4b;--hover:#171a22;--btntxt:#fff}
header img{height:30px;display:block}[data-theme=dark] header img{filter:brightness(0) invert(1)}.theme{background:none;border:1px solid var(--edge);color:var(--dim);border-radius:6px;padding:3px 8px;cursor:pointer;font:11px ui-monospace,Consolas,monospace}.theme.on{color:var(--acc2);border-color:var(--acc)}
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
h3{margin:0 0 8px;font:13px ui-monospace,Consolas,monospace;letter-spacing:.15em;text-transform:uppercase;color:var(--acc);font-weight:600}
h2{font:26px ui-monospace,Consolas,monospace;color:var(--acc2);margin:0}h2 .lbl{color:var(--dim);font-size:15px;letter-spacing:.1em;text-transform:uppercase;display:block;font-weight:normal}
.facts{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;margin-top:12px;font:14px ui-monospace,Consolas,monospace;align-items:baseline}
.facts .fl{color:var(--dim);font-size:12px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}.facts .fl:after{content:' —'}.facts .fv{color:var(--txt)}.facts .fv b{color:var(--acc2);font-weight:600}
.ed{width:100%;box-sizing:border-box;background:transparent;border:1px solid transparent;border-radius:3px;padding:3px 4px;color:var(--txt);font:13px ui-monospace,Consolas,monospace}
.ed:hover{border-color:var(--edge)}.ed:focus{border-color:var(--acc);background:var(--field);outline:0}.ed.dirty{border-color:#f59e0b}
table.edt{width:auto;min-width:100%}table.edt th{white-space:nowrap}table.edt td{padding:2px 3px}table.edt td.act{white-space:nowrap}
.ed{min-width:110px}.ed[data-f=desc],.ed[data-f=common]{min-width:240px}.ed[data-f=qty]{min-width:50px}.ed[data-f=part],.ed[data-f=pump],.ed[data-f=assembly]{min-width:150px}
.x{background:none;border:0;color:var(--dim);cursor:pointer;font-size:12px;padding:2px 4px}.x:hover{color:#f87171}
.note{border-left:3px solid var(--acc);padding:6px 10px;margin:8px 0;background:var(--field);border-radius:0 6px 6px 0;white-space:pre-wrap}.note .nm{font:11px ui-monospace,Consolas,monospace;color:var(--dim);margin-top:4px;display:flex;gap:10px}
.note .nm button{background:none;border:0;color:var(--dim);cursor:pointer;font:inherit;padding:0;text-decoration:underline}
textarea{width:100%;box-sizing:border-box;background:var(--field);color:var(--txt);border:1px solid var(--edge);border-radius:6px;padding:8px;font:13px system-ui;min-height:60px}
.tools{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.toast a{color:var(--acc2);margin-left:10px;cursor:pointer;text-decoration:underline}
kbd{border:1px solid var(--edge);border-radius:3px;padding:0 4px;font:11px ui-monospace,Consolas,monospace}
@media print{header,aside,.search,.meta,.tools,.x,.chip.act,textarea,.note form,.btn{display:none!important}body.hist main{margin-left:0}main{padding:0}.ed{border:0}section{break-inside:avoid}}
.sub{font-size:18px;margin:2px 0 0}
h3.tog{cursor:pointer;user-select:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap}h3.tog:hover{color:var(--acc2)}
.car{display:inline-block;width:0;height:0;border:5px solid transparent;border-left:7px solid var(--acc);border-right:0;transform:rotate(90deg);transition:transform .12s;margin-right:2px}
section.closed .car{transform:rotate(0)}section.closed .sb{display:none}section.closed h3{opacity:.75}h3 .hint{font-size:10px;letter-spacing:.05em;text-transform:none;color:var(--dim);margin-left:auto;font-weight:normal}
.uses{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-top:14px}
.grp{--h:215;border:1px solid hsl(var(--h) 45% 60% / .55);border-left:5px solid hsl(var(--h) 60% 48%);background:hsl(var(--h) 60% 50% / .07);border-radius:6px;padding:8px 10px;font:13px ui-monospace,Consolas,monospace}
[data-theme=dark] .grp{background:hsl(var(--h) 45% 55% / .12)}
.grp .gp{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}.grp .fl{color:var(--dim);font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-right:6px}.grp .ga{margin-bottom:4px}
.grow{--h:215}tr.grow td:first-child,li.grow{box-shadow:inset 4px 0 0 hsl(var(--h) 60% 48%)}li.grow .row{padding-left:10px}
.gchip{--h:215;display:inline-block;border-radius:5px;padding:2px;background:hsl(var(--h) 60% 50% / .14);box-shadow:inset 3px 0 0 hsl(var(--h) 60% 48%)}.gchip .chip{background:transparent;border-color:transparent}.gchip .chip:hover,.gchip .chip.on{border-color:var(--acc)}
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
.ids{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:6px;font:13px ui-monospace,Consolas,monospace}.ids b{color:var(--acc2);font-weight:600}
.filt{font:12px ui-monospace,Consolas,monospace;color:var(--dim);margin:8px 0 0}.filt b{color:var(--acc2);font-weight:normal}
body.inscreen aside{display:none!important}body.inscreen.hist main{margin-left:0!important}body.inscreen #histbtn,body.inscreen .brand{display:none}body.inscreen header .wrap{padding:6px 10px}body.inscreen nav{gap:8px}
aside{position:fixed;left:0;top:48px;bottom:0;width:230px;overflow:auto;border-right:1px solid var(--line);background:var(--panel);padding:12px;display:none;font:12px ui-monospace,Consolas,monospace}
body.hist aside{display:block}body.hist main{margin-left:230px}@media(max-width:900px){body.hist main{margin-left:0}aside{box-shadow:4px 0 16px rgba(0,0,0,.25)}}
aside h4{margin:0 0 6px;font:11px ui-monospace,Consolas,monospace;letter-spacing:.2em;color:var(--acc);display:flex;justify-content:space-between}aside h4 button{background:none;border:0;color:var(--dim);cursor:pointer;font:inherit;padding:0;letter-spacing:0}
.hi{display:flex;align-items:flex-start;gap:6px;padding:4px 2px;border-radius:4px}.hi:hover{background:var(--hover)}.hi .st{background:none;border:0;cursor:pointer;color:var(--dim);font-size:14px;padding:0;line-height:1.2}.hi .st.on{color:#f59e0b}
.hi a{flex:1;color:var(--txt);word-break:break-word;line-height:1.3}.hi a small{display:block;color:var(--dim);font-size:10px;letter-spacing:.1em}
.hi .rm{background:none;border:0;cursor:pointer;color:var(--dim);padding:0;font-size:11px;visibility:hidden}.hi:hover .rm{visibility:visible}
</style></head><body>
<header><div class="wrap"><a href="#/" onclick="goHome();return false"><img src="/logo.png" alt="PartsBender"></a><span class="brand" onclick="goHome()">PARTS FINDER</span>
<nav><button class="theme" id="scrbtn" onclick="addScreen()" title="Open another independent PartsFinder screen to compare side-by-side">+ SCREEN</button><button class="theme" id="histbtn" onclick="toggleHist()" title="Recently viewed pages">HISTORY</button><a href="#/" id="n-search">SEARCH</a><a href="#/browse" id="n-browse">BROWSE</a><a href="#/data" id="n-data">DATA</a><a href="#/review" id="n-review">REVIEW <span id="issuecount"></span></a><button class="theme" id="theme" onclick="toggleTheme()"></button></nav></div></header>
<aside id="hist"></aside>
<main><div class="wrap" id="app"></div></main>
<script>
const setTheme=t=>{document.documentElement.dataset.theme=t;localStorage.pfTheme=t;document.getElementById('theme').textContent=t==='dark'?'LIGHT':'DARK'};
const toggleTheme=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
setTheme(localStorage.pfTheme||'light');
function goHome(){q='';oemFilter='';sharedOnly=false;if(location.hash&&location.hash!=='#/')location.hash='#/';else render()}
// ---- multiple screens: this page may be one panel inside /screens; tell the workspace what we are showing ----
const inScreens=window.parent!==window;
function addScreen(){if(inScreens)parent.postMessage({pf:'add',hash:location.hash},'*');else location.href='/screens?u='+encodeURIComponent(location.hash||'#/')}
function tellParent(title){if(inScreens)parent.postMessage({pf:'title',hash:location.hash,title},'*')}
if(inScreens){document.body.classList.add('inscreen');window.addEventListener('storage',e=>{if(e.key==='pfColl'){try{coll=JSON.parse(e.newValue||'{}')}catch(x){}document.querySelectorAll('section[data-sec]').forEach(s=>s.classList.toggle('closed',!!coll[s.dataset.sec]))}if(e.key==='pfHist'){try{hist=JSON.parse(e.newValue||'[]')}catch(x){}drawHist()}if(e.key==='pfTheme'&&e.newValue)setTheme(e.newValue)})}
// ---- history sidebar (recent pages, starred ones pinned to the top; kept in this browser) ----
let hist=[];try{hist=JSON.parse(localStorage.pfHist||'[]')}catch(e){hist=[]}
const saveHist=()=>{localStorage.pfHist=JSON.stringify(hist);drawHist()};
function addHist(h,kind,title){if(!title)return;tellParent(kind.toUpperCase()+' · '+title);const i=hist.findIndex(x=>x.h===h);const e=i>=0?hist.splice(i,1)[0]:{h,star:false};e.k=kind;e.t=title;e.ts=Date.now();hist.unshift(e);
 let n=0;hist=hist.filter(x=>x.star||++n<=40);saveHist()}
function starHist(h){const e=hist.find(x=>x.h===h);if(e){e.star=!e.star;saveHist()}}
function rmHist(h){hist=hist.filter(x=>x.h!==h);saveHist()}
function clearHist(){hist=hist.filter(x=>x.star);saveHist()}
function drawHist(){const a=$('#hist');const cur=location.hash;const row=e=>`<div class="hi"><button class="st ${e.star?'on':''}" title="${e.star?'Unstar':'Star — keep at the top'}" onclick="starHist('${esc(e.h).replace(/'/g,'%27')}')">${e.star?'★':'☆'}</button><a href="${esc(e.h)}" style="${e.h===cur?'color:var(--acc2)':''}"><small>${esc(e.k)}</small>${esc(e.t)}</a><button class="rm" title="Remove" onclick="rmHist('${esc(e.h).replace(/'/g,'%27')}')">✕</button></div>`;
 const st=hist.filter(e=>e.star).sort((x,y)=>y.ts-x.ts),re=hist.filter(e=>!e.star);
 a.innerHTML=`<h4>STARRED</h4>${st.map(row).join('')||'<p class="dim" style="margin:0 0 10px">Click ☆ on a page below to pin it here.</p>'}<h4 style="margin-top:14px">RECENT <button onclick="clearHist()">clear</button></h4>${re.map(row).join('')||'<p class="dim" style="margin:0">Pages you open will appear here.</p>'}`}
function setHist(on){document.body.classList.toggle('hist',on);localStorage.pfHistOpen=on?'1':'0';$('#histbtn').classList.toggle('on',on)}
const toggleHist=()=>setHist(!document.body.classList.contains('hist'));
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const api=(p,o)=>fetch('/api'+p,o).then(r=>r.json());
let stats={oems:[]},oemFilter='',q='';
const nav=h=>{location.hash=h};
setHist(localStorage.pfHistOpen?localStorage.pfHistOpen==='1':innerWidth>1100);drawHist();
const money=p=>(p.currency||'')+' '+Number(p.value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
function chip(t,h,on){return `<button class="chip${on?' on':''}" onclick="nav('${esc(h).replace(/'/g,'%27')}')">${esc(t)}</button>`}
function fchip(t,fn,on){return `<button class="chip${on?' on':''}" onclick="${esc(fn)}">${esc(t)}</button>`}
function partRow(r){return `<li class="grow" ${r.pump||r.assembly?gstyle(r.pump,r.assembly):''}><button class="row" onclick="nav('#/part/${encodeURIComponent(r.key)}')"><span class="pn">${esc(r.part)}</span><span>${esc(r.desc||'—')}</span><span class="r">${esc(r.oems||r.oem||'')}${r.assembly?' · '+esc(r.assembly):''}${r.qty?' · qty '+esc(r.qty):''}${r.pumps!=null?' · '+r.pumps+' pump(s)':''}</span></button></li>`}
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
 lastList=d.parts;h+=`<section><h3>Parts · ${d.parts.length}${d.parts.length>=300?'+':''} <button class="chip ${sharedOnly?'on':''}" style="margin-left:8px" onclick="sharedOnly=!sharedOnly;doSearch()">shared by 2+ companies</button> <button class="chip act" onclick="csv(lastList,PCOLS,'search_${esc(s)}')">⬇ CSV</button></h3><ul class="list">${d.parts.map(partRow).join('')||'<li class="dim">No parts match.</li>'}</ul></section>`;put(h)}
let sharedOnly=false;
// ---- collapsible sections: click the blue heading; state is remembered per heading in this browser ----
let coll={};try{coll=JSON.parse(localStorage.pfColl||'{}')}catch(e){coll={}}
const secId=t=>String(t).replace(/<[^>]*>/g,'').replace(/[\d·★⬇].*$/,'').trim().toLowerCase().replace(/[^a-z]+/g,'_').replace(/_+$/,'');
function togSec(id,ev){if(ev&&ev.target.closest('button,a,input,select'))return;coll[id]=!coll[id];localStorage.pfColl=JSON.stringify(coll);document.querySelectorAll(`section[data-sec="${id}"]`).forEach(s=>{s.classList.toggle('closed',!!coll[id]);const h=s.querySelector('h3 .hint');if(h)h.textContent=coll[id]?'collapsed — click to expand':'';s.querySelector('h3').title=coll[id]?'Click to expand':'Click to collapse'})}
function sec(t,b){const id=secId(t);const c=!!coll[id];return `<section data-sec="${id}" class="${c?'closed':''}"><h3 class="tog" onclick="togSec('${id}',event)" title="${c?'Click to expand':'Click to collapse'}"><span class="car"></span>${t}<span class="hint">${c?'collapsed — click to expand':''}</span></h3><div class="sb">${b}</div></section>`}
// ---- consistent colours: the same pump / assembly always gets the same colour, everywhere ----
const HUES=[215,150,20,280,50,340,180,110,0,245,80,320];
const gkey=(pump,asm)=>(String(pump||'')+'|'+String(asm||'')).toLowerCase().replace(/[^a-z0-9|]/g,'');
function hue(k){let h=0;for(const c of k)h=(h*31+c.charCodeAt(0))>>>0;return HUES[h%HUES.length]}
const gstyle=(pump,asm)=>`style="--h:${hue(gkey(pump,asm))}"`;
const NS='<span class="dim">Not specified in imported source.</span>';
const fact=(l,v,b)=>`<span class="fl">${l}</span><span class="fv">${v?(b?`<b>${v}</b>`:v):'<span class="dim">Not specified in imported source</span>'}</span>`;
// one coloured card per pump + assembly the part is used on: quantity and location(s) stay attached to their assembly
function useCards(rows){const g={};rows.forEach(r=>{if(!r.pump&&!r.assembly&&!r.location&&!r.qty)return;const k=gkey(r.pump,r.assembly);(g[k]=g[k]||{pump:r.pump,asm:r.assembly,oem:r.oem,qty:new Set(),loc:new Set()});if(r.qty)g[k].qty.add(r.qty);if(r.location)g[k].loc.add(r.location)});
 const cards=Object.values(g);if(!cards.length)return '';
 return `<div class="uses">${cards.map(c=>`<div class="grp" ${gstyle(c.pump,c.asm)}><div class="gp">${c.pump?chip(c.pump,'#/pump/'+encodeURIComponent(c.pump)):'<span class="dim">Pump not specified</span>'}<span class="dim small">${esc(c.oem||'')}</span></div><div class="ga"><span class="fl">Assembly</span>${esc(c.asm||'—')}</div><div class="gq"><span class="fl">Qty</span>${esc([...c.qty].join(' / ')||'—')}<span class="fl" style="margin-left:14px">Location</span>${esc([...c.loc].join(', ')||'—')}</div></div>`).join('')}</div>`}
async function viewPart(key){const d=await api('/part/'+encodeURIComponent(key));if(!d.found)return `<p class="dim">Part not found.</p>`;lastList=d.rows;
 const qtys=[...new Set(d.rows.filter(r=>r.qty).map(r=>r.qty))],locs=[...new Set(d.rows.filter(r=>r.location).map(r=>r.location))];
 let h=`<div><h2><span class="lbl">OEM Part Number</span>${esc(d.part)}</h2><p class="sub">${esc(d.descs.join(' · ')||'No description')}</p>
 <div class="facts">${fact('OEM Part Number',esc(d.part),1)}${fact('Company',d.oems.map(o=>chip(o,'#/oem/'+encodeURIComponent(o))).join(' '))}${fact('Description',esc(d.descs.join(' · ')))}${fact('PB Number',esc(d.pb.join(', ')),1)}${fact('G-Number',esc(d.gnum.join(', ')),1)}${fact('Used on pumps',d.pumps.map(p=>chip(p,'#/pump/'+encodeURIComponent(p))).join(' '))}${d.variants.length>1?fact('Part number written as',esc(d.variants.join(', '))):''}</div>${useCards(d.rows)}${tools('part_'+d.part)}</div>`;
 if(d.shared)h+=sec(`Shared across ${d.by_oem.length} companies`,`<table><tr><th>Company</th><th>Pumps</th><th>Assembly</th><th>Description</th><th>Prices</th></tr>${d.by_oem.map(o=>`<tr><td class="g">${chip(o.oem,'#/oem/'+encodeURIComponent(o.oem))}</td><td>${o.pumps.map(p=>chip(p,'#/pump/'+encodeURIComponent(p))).join(' ')||'<span class="dim">—</span>'}</td><td>${esc(o.assemblies.join(', ')||'—')}</td><td>${esc(o.descs.join(' · ')||'—')}</td><td>${o.prices.length?o.prices.map(p=>`<div><span class="g">${money(p)}</span> <span class="dim">${esc(p.label)}${p.date?' · '+esc(p.date):''}</span></div>`).join(''):'<span class="dim">none</span>'}</td></tr>`).join('')}</table>`);
 h+=sec('Used on pumps',d.pumps.length?`<div class="chips">${d.pumps.map(p=>chip(p,'#/pump/'+encodeURIComponent(p))).join('')}</div>`:'<span class="dim">Pump compatibility: Not specified in imported source.</span>');
 h+=sec('Common with (also fits these pumps)',d.common.length?`<div class="chips">${d.common.map(p=>chip(p,'#/pump/'+encodeURIComponent(p))).join('')}</div><p class="small">Source value: ${esc(d.common_raw.join(' | '))}</p>`:NS);
 h+=sec(`Pricing found · ${d.prices.length} <button class="chip act" style="margin-left:8px" onclick="addPrice(${d.rows[0].id})">+ Add a price</button>`,d.prices.length?`<table><tr><th>Company</th><th>Price type</th><th>Price</th><th>Price date</th><th>Imported</th><th>Source file</th><th></th></tr>${d.prices.map(p=>`<tr><td>${esc(p.oem||'')}</td><td>${esc(p.label)}</td><td class="g">${money(p)}</td><td class="dim">${esc(p.date||'—')}</td><td class="dim">${esc(p.imported_at)}</td><td class="dim">${esc(p.file)} › ${esc(p.sheet)}</td><td><button class="x" title="Remove this price" onclick="delPrice(${p.id})">✕</button></td></tr>`).join('')}</table>`:'<span class="dim">No pricing in imported source.</span>');
 if(d.alternates.length)h+=sec('Same description, different part number (check — not confirmed alternates)',`<div class="chips">${d.alternates.map(a=>chip(a.part,'#/part/'+encodeURIComponent(a.key))).join('')}</div>`);
 if(d.related.length){const rg={};d.related.forEach(x=>{const k=gkey(x.pump,x.assembly);(rg[k]=rg[k]||{pump:x.pump,asm:x.assembly,items:[]}).items.push(x)});
  h+=sec('Related parts (same pump & assembly)',`<div class="uses">${Object.values(rg).map(g=>`<div class="grp" ${gstyle(g.pump,g.asm)}><div class="gp">${g.pump?chip(g.pump,'#/pump/'+encodeURIComponent(g.pump)):'<span class="dim">Pump not specified</span>'}<span class="dim small">${esc(g.asm||'')}</span></div><div class="chips">${g.items.map(x=>chip(x.part+(x.desc?' — '+x.desc:''),'#/part/'+encodeURIComponent(x.key))).join('')}</div></div>`).join('')}</div>`)}
 h+=notesBlock('part',d.key,d.part,d.notes);
 h+=sec(`Source rows · ${d.rows.length} <span class="dim">· click any cell to edit — every change is logged and can be undone (DATA › Edit history)</span>`,`<div style="overflow:auto"><table class="edt"><tr>${FIELDS.map(f=>`<th>${f[1]}</th>`).join('')}<th>Source</th><th></th></tr>${d.rows.map(r=>`<tr class="grow" ${gstyle(r.pump,r.assembly)}>${FIELDS.map(f=>edCell(r,f[0])).join('')}<td class="dim" style="white-space:nowrap">${esc(r.file)} › ${esc(r.sheet)}${r.src_row?' · row '+r.src_row:''}<br>imported ${esc(r.imported_at)} <details style="display:inline"><summary style="display:inline">raw</summary><code>${esc(JSON.stringify(r.raw))}</code></details></td><td class="act"><button class="x" title="Delete this row" onclick="delRow(${r.id})">✕</button></td></tr>`).join('')}</table></div><div class="tools"><button class="chip act" onclick='showAddRow(${JSON.stringify({part:d.part,oem:d.oems[0]||'',desc:d.descs[0]||''})})'>+ Add another row for this part</button></div><div id="addrow"></div>`);
 return h}
// pump page filters: Common-with and Assembly chips narrow the parts list in place (page/URL unchanged)
let pumpD=null,pumpCur='',asmFilter='',cwFilter='';
function setPF(kind,v){if(kind==='asm')asmFilter=asmFilter===v?'':v;else cwFilter=cwFilter===v?'':v;const el=$('#pumpbody');if(el&&pumpD)el.innerHTML=pumpBody(pumpD)}
function pumpBody(d){const asms={},asmPump={};d.parts.forEach(r=>{const a=r.assembly||'Unspecified';asms[a]=(asms[a]||0)+1;if(r.pump&&!asmPump[a])asmPump[a]=r.pump});
 const cws={};d.parts.forEach(r=>(r.common_with||[]).forEach(c=>{cws[c]=(cws[c]||0)+1}));
 const uk=new Set(d.unique_keys);let h='';
 if(d.common.length)h+=sec(`Common with <span class="dim">· click to keep only the parts shared with that pump</span>`,`<div class="chips">${d.common.map(c=>fchip(`${c} · ${cws[c]||0}`,`setPF('cw',${JSON.stringify(c)})`,cwFilter===c)).join('')}</div>`);
 h+=sec(`Assembly breakdown <span class="dim">· click to keep only that assembly</span>`,`<div class="chips">${fchip(`All · ${d.parts.length}`,"setPF('asm','')",!asmFilter)}${Object.keys(asms).sort().map(a=>`<span class="gchip" ${gstyle(asmPump[a]||d.pump,a==='Unspecified'?'':a)}>${fchip(`${a} · ${asms[a]}`,`setPF('asm',${JSON.stringify(a)})`,asmFilter===a)}</span>`).join('')}</div>`);
 const list=d.parts.filter(r=>(!asmFilter||(r.assembly||'Unspecified')===asmFilter)&&(!cwFilter||(r.common_with||[]).includes(cwFilter)));
 const on=[cwFilter&&`common with <b>${esc(cwFilter)}</b>`,asmFilter&&`assembly <b>${esc(asmFilter)}</b>`].filter(Boolean);
 lastList=list;h+=sec(`Parts found · ${list.length}${on.length?` <span class="dim">of ${d.parts.length}</span>`:''} <span class="dim">(${uk.size} unique to this pump ★)</span> <button class="chip act" style="margin-left:8px" onclick="csv(lastList,PCOLS,'pump_${esc(d.pump)}')">⬇ CSV</button>`,`${on.length?`<p class="filt">Showing parts on ${esc(d.pump)} that are ${on.join(' and ')} — <a href="javascript:void(0)" onclick="asmFilter='';cwFilter='';setPF('asm','')">clear filters</a></p>`:''}<ul class="list">${list.map(r=>partRow({...r,part:(uk.has(r.key)?'★ ':'')+r.part})).join('')||'<li class="dim">No parts match these filters.</li>'}</ul>`);
 return h}
async function viewPump(p){const d=await api('/pump/'+encodeURIComponent(p));if(p!==pumpCur){asmFilter='';cwFilter='';pumpCur=p}pumpD=d;
 let h=`<div><h2><span class="lbl">Pump</span>${esc(d.pump)}</h2><div class="facts">${fact('Pump model',esc(d.pump),1)}${fact('Company',d.oems.map(o=>chip(o,'#/oem/'+encodeURIComponent(o))).join(' '))}${fact('Parts listed',d.parts.length)}</div><div class="tools"><button class="chip act" onclick='renamePump(${JSON.stringify(d.pump)})'>✎ Rename this pump</button><button class="chip act" onclick="showAddRow({pump:${esc(JSON.stringify(d.pump))},oem:${esc(JSON.stringify(d.oems[0]||''))}})">+ Add a part to this pump</button><button class="chip act" onclick="print()">🖨 Print</button></div><div id="addrow"></div>${d.direct?'':`<p class="small">No rows list this pump directly; showing the ${d.via_common} parts whose “Common” field names it${d.also_on.length?' (listed on: '+d.also_on.map(p=>chip(p,'#/pump/'+encodeURIComponent(p))).join(' ')+')':''}.</p>`}${d.variants.length?`<p class="small">Variants: ${d.variants.map((v,i)=>chip(v,'#/pump/'+encodeURIComponent(d.names[i]||v))).join(' ')}</p>`:''}${d.names.length>1&&!d.variants.length?`<p class="small">Name variants: ${esc(d.names.join(' | '))}</p>`:''}</div>`;
 h+=notesBlock('pump',pumpKey(d.pump),d.pump,d.notes);
 h+=`<div id="pumpbody">${pumpBody(d)}</div>`;
 return h}
const pumpKey=p=>String(p).toLowerCase().replace(/[^a-z0-9]/g,'');
let browse=null;
async function viewBrowse(oem,model){browse=browse||await api('/browse');
 let h=`<h2 style="font-size:20px">BROWSE</h2><p class="dim">Pick a company, then a pump model.</p>`;
 h+=sec('Company',`<div class="chips">${browse.map(o=>chip(`${o.oem} · ${o.parts}`,'#/browse/'+encodeURIComponent(o.oem),o.oem===oem)).join('')}</div>`);
 const o=browse.find(x=>x.oem===oem);if(!o)return h;
 h+=sec(`Pump models · ${o.models.length}`,`<div class="chips">${o.models.map(m=>chip(`${m.model} · ${m.parts}`,'#/browse/'+encodeURIComponent(oem)+'/'+encodeURIComponent(m.model),m.model===model)).join('')}</div>`);
 const m=o.models.find(x=>x.model===model);if(!m)return h;
 if(m.common)h+=`<p class="small">${esc(model)} is named in “Common” fields only — parts below are the ones shared with it.</p>`;
 if(m.variants.length&&(m.variants.length>1||m.variants[0].variant))h+=sec('Variants',`<div class="chips">${m.variants.map(v=>chip(`${v.variant||v.pump} · ${v.parts}`,'#/pump/'+encodeURIComponent(v.pump))).join('')}</div><p class="small">Click a variant for just that build, or see all parts for the model below.</p>`);
 h+=`<div style="margin-top:20px">${await viewPump(model)}</div>`;return h}
async function viewOem(o){const d=await api('/oem/'+encodeURIComponent(o));
 let h=`<div><h2><span class="lbl">Company</span>${esc(d.oem.toUpperCase())}</h2><p class="sub">${d.rows.toLocaleString()} rows · ${d.parts.toLocaleString()} distinct part numbers</p><div class="tools"><button class="chip act" onclick='showAddRow(${JSON.stringify({oem:d.oem})})'>+ Add a part for this company</button></div><div id="addrow"></div></div>`;
 h+=notesBlock('oem',d.oem,d.oem,d.notes);
 const cm=d.models.filter(m=>m.common),dm=d.models.filter(m=>!m.common);
 const mchip=m=>chip(`${m.model} · ${m.parts}`,'#/pump/'+encodeURIComponent(m.model));
 const vars=dm.filter(m=>m.variants.length&&(m.variants.length>1||m.variants[0].variant));
 h+=sec(`Pump types · ${d.models.length}`,d.models.length?`<div class="chips">${dm.map(mchip).join('')}</div>${vars.length?`<p class="small" style="margin-top:10px">Variants: ${vars.map(m=>`${esc(m.model)} → ${m.variants.map(v=>chip(v.variant||v.pump,'#/pump/'+encodeURIComponent(v.pump))).join(' ')}`).join(' &nbsp;·&nbsp; ')}</p>`:''}${cm.length?`<p class="small" style="margin-top:10px">Named in “Common” fields (parts shared with them):</p><div class="chips">${cm.map(mchip).join('')}</div>`:''}`:NS);
 h+=sec(`Assemblies · ${d.assemblies.length}`,d.assemblies.length?esc(d.assemblies.slice(0,80).join(' · ')):NS);
 h+=sec('Imports',`<table><tr><th>Date</th><th>File</th><th>Sheet</th><th>Rows</th></tr>${d.imports.map(i=>`<tr><td class="dim">${esc(i.imported_at)}</td><td>${esc(i.file)}</td><td>${esc(i.sheet)}</td><td class="g">${i.rows}</td></tr>`).join('')}</table>`);
 return h}
async function viewData(){const d=await api('/imports');const ed=await api('/edits');const nt=await api('/notes');
 let h=`<h2 style="font-size:20px">DATA</h2><p class="dim">Raw uploads are kept untouched in <code>PartsFinder/raw/</code>. Drop files here or into <code>PartsFinder/inbox/</code> and click Scan inbox.</p>
 <div class="drop" id="drop" onclick="$('#file').click()">Drop Excel / CSV here, or click to choose<input type="file" id="file" multiple accept=".xlsx,.xlsm,.csv" style="display:none"></div>
 <p><button class="btn sec" onclick="scanInbox()">Scan inbox folder</button> <button class="btn sec" style="color:#f87171" onclick="flushAll()">Flush ALL data…</button> <span class="small">${esc(d.inbox.length)} file(s) waiting: ${esc(d.inbox.join(', '))}</span></p><div id="preview"></div>`;
 h+=sec('Import history',d.imports.length?`<table><tr><th>Date</th><th>File</th><th>Sheet</th><th>OEM</th><th>Type</th><th>Rows</th><th>New</th><th>Existing</th><th>Skipped</th><th>Price Δ</th><th>Raw copy</th></tr>${d.imports.map(i=>`<tr><td class="dim">${esc(i.imported_at)}</td><td>${esc(i.file)}</td><td>${esc(i.sheet)}</td><td>${esc(i.oem||'?')}</td><td class="dim">${esc(i.dataset)}</td><td class="g">${i.rows}</td><td>${i.new_parts}</td><td>${i.existing_parts}</td><td class="dim" title="rows identical to ones already loaded">${i.skipped||0}</td><td>${i.price_changes}</td><td class="dim">${esc(i.raw_path)}</td></tr>`).join('')}</table>`:'<span class="dim">Nothing imported yet.</span>');
 const val=v=>v==null?'<span class="dim">(blank)</span>':v.length>60?`<span title="${esc(v)}">${esc(v.slice(0,60))}…</span>`:esc(v);
 h+=sec(`Edit history · ${ed.length} <span class="dim">· changes made in the app; imported source rows are never rewritten</span>`,ed.length?`<table><tr><th>When</th><th>Part</th><th>What changed</th><th>From</th><th>To</th><th></th></tr>${ed.map(e=>`<tr style="${e.undone?'opacity:.45':''}"><td class="dim">${esc(e.edited_at)}</td><td class="g">${e.part?chip(e.part,'#/part/'+encodeURIComponent(e.part.toLowerCase().replace(/[^a-z0-9]/g,''))):''}</td><td>${esc(e.label)}</td><td>${val(e.old)}</td><td>${val(e.new)}</td><td>${e.undone?'<span class="dim">undone</span>':`<button class="chip" onclick="undo(${e.id})">undo</button>`}</td></tr>`).join('')}</table>`:'<span class="dim">No edits yet. Click any cell in a part\'s Source rows table to change it.</span>');
 h+=sec(`All notes · ${nt.length}`,nt.length?`<table><tr><th>Updated</th><th>About</th><th>Note</th></tr>${nt.map(n=>`<tr><td class="dim">${esc(n.updated_at)}</td><td>${n.kind==='part'?chip(n.title,'#/part/'+encodeURIComponent(n.subject)):n.kind==='pump'?chip(n.title,'#/pump/'+encodeURIComponent(n.title)):n.kind==='oem'?chip(n.title,'#/oem/'+encodeURIComponent(n.subject)):esc(n.title)}</td><td style="white-space:pre-wrap">${esc(n.text)}</td></tr>`).join('')}</table>`:'<span class="dim">No notes yet — add them on any part, pump or company page.</span>');
 h+=`<p class="small" style="margin-top:20px">Keyboard: <kbd>/</kbd> jump to search · <kbd>Esc</kbd> clear search · <kbd>Enter</kbd> save a cell you are editing · <kbd>Esc</kbd> cancel the edit</p>`;
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
  <div class="stats"><div class="stat"><b>${s.rows}</b><span>rows found</span></div><div class="stat"><b>${s.existing_parts}</b><span>existing parts</span></div><div class="stat"><b>${s.new_parts}</b><span>new parts</span></div><div class="stat"><b class="${s.price_changes.length?'warn':''}">${s.price_changes.length}</b><span>price changes</span></div><div class="stat"><b class="${s.duplicates.length?'warn':''}">${s.duplicates.length}</b><span>possible duplicates</span></div><div class="stat"><b class="${s.unmatched_pumps.length?'warn':''}">${s.unmatched_pumps.length}</b><span>new pump names</span></div><div class="stat"><b>${s.missing_desc}</b><span>no description</span></div><div class="stat"><b>${s.unchanged_rows||0}</b><span>already loaded (skipped)</span></div><div class="stat"><b class="${(s.flags||[]).length?'warn':''}">${(s.flags||[]).length}</b><span>flagged for review</span></div></div>
  ${(s.extra_columns||[]).length?`<p class="small warn">Columns not understood (kept in the raw row only): ${esc(s.extra_columns.join(', '))}</p>`:''}
  ${(s.flags||[]).length?`<details><summary>Flagged for review — nothing is changed automatically, these become REVIEW items</summary>${Object.entries(s.flag_counts||{}).map(([k,n])=>`<p class="small"><b>${n}</b> ${esc(FLAG_LABEL[k]||k)}</p>`).join('')}<table>${s.flags.slice(0,300).map(f=>`<tr><td class="dim">${esc(FLAG_LABEL[f[0]]||f[0])}</td><td class="g">${esc(f[1])}</td><td>${esc(f[2])}</td></tr>`).join('')}${s.flags.length>300?`<tr><td colspan=3 class="dim">… ${s.flags.length-300} more (all listed on REVIEW after import)</td></tr>`:''}</table></details>`:''}
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
const FLAG_LABEL={duplicate_part:'possible duplicate part numbers',unknown_pump:'new / unknown pump models',similar_pumps:'pump names that may be the same model',price_change:'price changes detected',missing_description:'descriptions need review',
 duplicate_row:'identical rows in the sheet (imported once)',conflicting_description:'same part number, different descriptions',no_oem_part_number:'no OEM part number (listed under PB / G number)',blank_part_number:'row with no identifier at all (skipped)',whitespace_part_number:'part number had stray spaces',non_numeric_price:'text in a price cell (not imported as a price)',non_numeric_qty:'quantity is not a number',sell_below_cost:'sell price below cost',placeholder_assembly:'assembly was a worksheet name (treated as blank)',similar_assemblies:'assembly names that may be the same',unrecognised_oem:'OEM column value not recognised',unmapped_column:'spreadsheet column not understood'};
async function viewReview(){const d=await api('/issues');const kinds={};d.forEach(i=>{kinds[i.kind]=(kinds[i.kind]||0)+1});
 const label=FLAG_LABEL;
 let h=`<h2 style="font-size:20px">REVIEW · ${d.length} open</h2><p class="dim">Nothing here is merged automatically. Resolve items when you have time; the source rows are never altered.</p>`;
 h+=`<div class="stats">${Object.entries(kinds).map(([k,n])=>`<div class="stat"><b class="warn">${n}</b><span>${label[k]||k}</span></div>`).join('')}</div>`;
 h+=`<table><tr><th>Kind</th><th>Subject</th><th>Detail</th><th>Found</th><th></th></tr>${d.map(i=>`<tr><td class="dim">${esc(label[i.kind]||i.kind)}</td><td class="g">${esc(i.subject)}</td><td>${esc(i.detail)}</td><td class="dim">${esc(i.created_at)}</td><td><button class="chip" onclick="resolve(${i.id})">resolve</button></td></tr>`).join('')}</table>`;
 return h}
async function resolve(id){await api('/issues/'+id+'/resolve',{method:'POST'});await loadStats();render()}
function toast(m,err,undoId){const t=document.createElement('div');t.className='toast'+(err?' err':'');t.textContent=m;if(undoId){const a=document.createElement('a');a.textContent='Undo';a.onclick=()=>{undo(undoId);t.remove()};t.appendChild(a)}document.body.appendChild(t);setTimeout(()=>t.remove(),undoId?8000:3500)}
async function post(p,body){const d=await api(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});if(d.error){toast(d.error,true);throw new Error(d.error)}return d}
async function undo(id){await post('/edits/'+id+'/undo');toast('Undone');browse=null;await loadStats();render()}
// ---- editing ----
const FIELDS=[['oem','Company'],['part','OEM Part Number'],['desc','Description'],['qty','Qty'],['assembly','Assembly'],['pump','Pump'],['common','Common with'],['location','Location'],['pb','PB Number'],['gnum','G-Number']];
function edCell(r,f){return `<td><input class="ed" value="${esc(r[f]??'')}" data-rid="${r.id}" data-f="${f}" data-o="${esc(r[f]??'')}" title="Click to edit — Enter or click away to save, Esc to cancel" oninput="this.classList.toggle('dirty',this.value!==this.dataset.o)" onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){this.value=this.dataset.o;this.classList.remove('dirty');this.blur()}" onblur="saveCell(this)"></td>`}
async function saveCell(el){if(el.value===el.dataset.o)return;const f=el.dataset.f;try{const d=await post('/edit',{record_id:+el.dataset.rid,field:f,value:el.value});el.dataset.o=el.value;el.classList.remove('dirty');
 toast(`Saved ${FIELDS.find(x=>x[0]===f)[1]}`,false,d.edit_id);browse=null;await loadStats();if(location.hash.startsWith('#/part/')&&d.key!==decodeURIComponent(location.hash.slice(7)))nav('#/part/'+encodeURIComponent(d.key));else render()}catch(e){el.focus()}}
async function delRow(id){if(!confirm('Delete this source row? (It stays in the edit history and can be undone.)'))return;const d=await post('/record/'+id+'/delete');toast('Row deleted',false,d.edit_id);browse=null;await loadStats();render()}
function addRowForm(pre){const id='nr'+Date.now();return `<div class="card" id="${id}"><h3>Add a row (typed in manually)</h3><table class="edt"><tr>${FIELDS.map(([f,l])=>`<th>${l}</th>`).join('')}</tr><tr>${FIELDS.map(([f])=>`<td><input class="ed" style="border-color:var(--edge)" data-f="${f}" value="${esc(pre[f]||'')}"></td>`).join('')}</tr></table><p><button class="btn" onclick="addRow('${id}')">SAVE ROW</button> <button class="btn sec" onclick="$('#${id}').remove()">Cancel</button></p></div>`}
async function addRow(id){const b={};$('#'+id).querySelectorAll('input').forEach(i=>b[i.dataset.f]=i.value);const d=await post('/record',b);toast('Row added');browse=null;await loadStats();if(location.hash.startsWith('#/part/'))nav('#/part/'+encodeURIComponent(d.key));else render()}
function showAddRow(pre){const a=$('#addrow');if(a){a.innerHTML=addRowForm(pre||{});a.querySelector('input').focus()}}
async function delPrice(id){if(!confirm('Remove this price?'))return;const d=await post('/price/'+id+'/delete');toast('Price removed',false,d.edit_id);render()}
async function addPrice(rid){const value=prompt('Price (number only):');if(value==null||!value.trim())return;const label=prompt('What price is this? (e.g. List Price AUD, Cost USD, Quote)','List Price')||'Price';const currency=prompt('Currency (AUD / USD / EUR…):','AUD')||'';const date=prompt('Price date (optional, e.g. Sep 2026):','')||'';await post('/price',{record_id:rid,label,value,currency,date});toast('Price added');render()}
async function renamePump(old){const nw=prompt(`Rename pump “${old}” everywhere it appears (pump cells and Common lists):`,old);if(!nw||nw===old)return;const d=await post('/rename_pump',{old,new:nw});toast(`Renamed on ${d.rows} row(s) — see DATA › Edit history to undo`);browse=null;await loadStats();nav('#/pump/'+encodeURIComponent(d.pump))}
// ---- notes ----
function notesBlock(kind,subject,title,notes){const s=JSON.stringify(subject),k=JSON.stringify(kind),t=JSON.stringify(title);
 return sec(`Notes · ${notes.length}`,`${notes.map(n=>`<div class="note">${esc(n.text)}<div class="nm"><span>${esc(n.updated_at)}${n.updated_at!==n.created_at?' (edited)':''}</span><button onclick='editNote(${n.id},${JSON.stringify(n.text)})'>edit</button><button onclick="delNote(${n.id})">delete</button></div></div>`).join('')}
 <form onsubmit='return addNote(event,${k},${s},${t})'><textarea name="t" placeholder="Add a note about this ${kind==='oem'?'company':kind}… (e.g. supersedes X, call Dave for stock, watch the o-ring size)"></textarea><p style="margin:6px 0 0"><button class="btn">ADD NOTE</button></p></form>`)}
async function addNote(ev,kind,subject,title){ev.preventDefault();const ta=ev.target.t;if(!ta.value.trim())return false;await post('/note',{kind,subject,title,text:ta.value});toast('Note saved');render();return false}
async function editNote(id,old){const t=prompt('Edit note:',old);if(t==null||t===old)return;await post('/note',{id,kind:'general',text:t});toast('Note updated');render()}
async function delNote(id){if(!confirm('Delete this note?'))return;await post('/note/'+id+'/delete');toast('Note deleted');render()}
// ---- export / print / keyboard ----
function csv(rows,cols,name){const q=v=>{v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};const s=[cols.map(c=>q(c[1])).join(',')].concat(rows.map(r=>cols.map(c=>q(typeof c[0]==='function'?c[0](r):r[c[0]])).join(','))).join('\r\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+s],{type:'text/csv'}));a.download=name.replace(/[^\w.-]+/g,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
let lastList=[];const PCOLS=[['part','OEM Part Number'],['desc','Description'],['oem','Company'],['pump','Pump'],['assembly','Assembly'],['qty','Qty'],['common','Common with'],['location','Location'],['pb','PB Number'],['gnum','G-Number']];
function tools(name){return `<div class="tools"><button class="chip act" onclick="csv(lastList,PCOLS,'${esc(name)}')">⬇ Export list to CSV (Excel)</button><button class="chip act" onclick="print()">🖨 Print</button></div>`}
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;if(e.key==='/'){e.preventDefault();const i=$('#q');if(i)i.focus();else{q='';nav('#/')}}if(e.key==='Escape'&&$('#q')){q='';render()}});
async function render(){const h=location.hash||'#/';const app=$('#app');['search','browse','data','review'].forEach(n=>$('#n-'+n).classList.toggle('on',h.startsWith('#/'+n)||(n==='search'&&!/^#\/(browse|data|review)/.test(h))));
 const parts=h.slice(2).split('/');const kind=parts[0]||'';const arg=decodeURIComponent(parts.slice(1).join('/'));
 if(kind==='data'){app.innerHTML=await viewData();drawHist();return}if(kind==='browse'){const bo=parts[1]?decodeURIComponent(parts[1]):'',bm=parts[2]?decodeURIComponent(parts[2]):'';app.innerHTML=await viewBrowse(bo,bm);window.scrollTo(0,0);if(bm)addHist(h,'BROWSE',bo+' › '+bm);else drawHist();return}if(kind==='review'){app.innerHTML=await viewReview();drawHist();return}
 let body='';if(kind==='part')body=await viewPart(arg);else if(kind==='pump')body=await viewPump(arg);else if(kind==='oem')body=await viewOem(arg);
 app.innerHTML=searchBox()+(body?`<div style="margin-top:20px">${body}</div>`:'<div id="results" style="margin-top:20px"></div>');bindSearch();if(!body)doSearch();window.scrollTo(0,0);
 if(body){const t=$('#app h2')?.lastChild?.textContent;const sub=kind==='part'?$('#app .sub')?.textContent||'':'';addHist(h,{part:'PART',pump:'PUMP',oem:'COMPANY'}[kind]||kind,t?t+(sub?' — '+sub.slice(0,40):''):'')}else drawHist()}
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
                data = (SCREENS_HTML if p == "/screens" else HTML).encode()
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
            if p == "/api/edits":
                return self.send_json(q_edits(con))
            if p == "/api/notes":
                return self.send_json(q_notes(con, qs.get("kind"), qs.get("subject")))
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
            if p == "/api/edit":
                return self.send_json(edit_field(con, int(body["record_id"]), body["field"], body.get("value")))
            if p == "/api/record":
                return self.send_json(add_record(con, body))
            m = re.match(r"^/api/record/(\d+)/delete$", p)
            if m:
                return self.send_json(delete_record(con, int(m.group(1))))
            if p == "/api/price":
                return self.send_json(add_price(con, int(body["record_id"]), body.get("label") or "", body.get("value"),
                                                body.get("currency"), body.get("date")))
            m = re.match(r"^/api/price/(\d+)/delete$", p)
            if m:
                return self.send_json(delete_price(con, int(m.group(1))))
            if p == "/api/rename_pump":
                return self.send_json(rename_pump(con, body["old"], body["new"]))
            m = re.match(r"^/api/edits/(\d+)/undo$", p)
            if m:
                return self.send_json(undo_edit(con, int(m.group(1))))
            if p == "/api/note":
                return self.send_json(save_note(con, body))
            m = re.match(r"^/api/note/(\d+)/delete$", p)
            if m:
                con.execute("DELETE FROM notes WHERE id=?", (m.group(1),))
                con.commit()
                return self.send_json({"ok": True})
            self.send_json({"error": "not found"}, 404)
        except (ValueError, KeyError) as e:
            self.send_json({"error": str(e)}, 400)
        except Exception as e:  # noqa: BLE001
            self.send_json({"error": f"{type(e).__name__}: {e}"}, 500)


def seed_if_empty(con: sqlite3.Connection) -> None:
    """Load the bundled workbooks: everything on first run, and on later runs any bundled sheet that has
    never been imported (so newly un-held sheets such as Cornell / Atlas Copco appear without a flush)."""
    if not SEED.is_dir():
        return
    done = {(r[0].lower(), (r[1] or "").lower()) for r in con.execute("SELECT file, sheet FROM imports")}
    for f in sorted(SEED.iterdir()):
        if f.suffix.lower() not in (".xlsx", ".xlsm", ".csv") or f.name.lower().startswith("cleaned"):
            continue
        if f.suffix.lower() == ".csv":
            names = [f.stem]
        else:
            wb = openpyxl.load_workbook(f, read_only=True)
            try:
                names = list(wb.sheetnames)
            finally:
                wb.close()
        wanted = [n for n in names if seed_sheet_wanted(f.name, names, n) and (f.name.lower(), n.lower()) not in done]
        if not wanted:
            continue
        pv = preview_file(f, con)
        choices = {s["sheet"]: {"import": s["sheet"] in wanted} for s in pv["sheets"]}
        if any(c["import"] for c in choices.values()):
            print(f"  loading bundled {f.name}: {', '.join(n for n, c in choices.items() if c['import'])} ...")
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
