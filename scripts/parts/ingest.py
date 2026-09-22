#!/usr/bin/env python3
"""PartsBender Parts Finder — ingestion.

Reads the raw OEM workbooks in data/parts/raw (never modified) and maps each
sheet into a common record shape, writing client/public/parts/parts.json.

Each sheet gets its own small column map. Missing fields stay null — nothing
is guessed. Every record keeps its source file / sheet / row so it can be
traced back to the original spreadsheet.

    pip install openpyxl
    python3 scripts/parts/ingest.py
"""
from __future__ import annotations

import json
import re
import warnings
from pathlib import Path

import openpyxl

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "parts" / "raw"
OUT = ROOT / "client" / "public" / "parts" / "parts.json"

# Sheet definitions. `cols` maps a normalised field -> 0-based column index.
# `prices` lists (label, column, currency, date) tuples preserved verbatim.
SOURCES = [
    {
        "file": "Cleaned Pump Data.xlsx", "sheet": "Godwin", "oem": "Godwin", "header_rows": 1,
        "cols": {"location": 1, "part": 2, "desc": 3, "qty": 4, "assembly": 5, "pump": 6, "common": 7},
        "prices": [("Unit Cost Estimate", 8, "USD", None), ("Unit List Price", 9, "USD", None),
                   ("Unit Dealer Price", 10, "AUD", None)],
    },
    {
        "file": "Cleaned Pump Data.xlsx", "sheet": "Sykes", "oem": "Sykes", "header_rows": 1,
        "cols": {"location": 1, "part": 2, "desc": 3, "qty": 4, "assembly": 5, "pump": 6, "common": 7},
        "prices": [("Unit Cost", 8, "USD", "Jan 2018"), ("Dealer Unit List Price", 9, "USD", None),
                   ("Dealer Unit List Price", 10, "AUD", None)],
    },
    {
        "file": "Cleaned Pump Data.xlsx", "sheet": "BBA", "oem": "BBA", "header_rows": 1,
        "cols": {"location": 1, "part": 2, "desc": 3, "qty": 4, "assembly": 5, "pump": 6, "common": 7},
        "prices": [("Cost (estimated)", 8, "EUR", None), ("Dealer Price", 9, "EUR", "valid until Jan 2018"),
                   ("Dealer Price", 10, "AUD", "valid until Jan 2019")],
    },
    {
        "file": "Cleaned Pump Data.xlsx", "sheet": "Pioneer", "oem": "Pioneer", "header_rows": 1,
        "cols": {"location": 1, "part": 2, "desc": 3, "qty": 4, "assembly": 5, "pump": 6, "common": 7},
        "prices": [("Cost Estimate", 8, "USD", None), ("List", 9, "USD", "2016"), ("List", 10, "AUD", "2016")],
    },
    {
        "file": "Cleaned Pump Data.xlsx", "sheet": "Cornell", "oem": "Cornell", "header_rows": 0,
        "cols": {"location": 1, "part": 2, "desc": 3, "qty": 4, "assembly": 5, "pump": 6, "common": 7},
        "prices": [("Cost Estimate", 8, "USD", None), ("List Price", 9, "USD", None), ("List Price", 10, "AUD", None)],
    },
    {
        "file": "Parts_Rev4.xlsx", "sheet": "50CFM_Pioneer", "oem": "Pioneer", "header_rows": 1,
        "cols": {"location": 1, "part": 2, "desc": 3, "qty": 4, "assembly": 5, "pump": 6, "common": 7},
        "prices": [("Cost", 8, "USD", None), ("List", 9, "USD", "2016"), ("List", 10, "AUD", "2016")],
    },
    {
        "file": "Parts_Rev4.xlsx", "sheet": "50CFM Cornell", "oem": "Cornell", "header_rows": 1,
        "cols": {"location": 1, "part": 2, "desc": 3, "qty": 4, "assembly": 5, "pump": 6, "common": 7},
        "prices": [("Cost Estimate", 8, "USD", None), ("List Price", 9, "USD", None), ("List Price", 10, "AUD", None)],
    },
    {
        "file": "Parts_Rev4.xlsx", "sheet": "Atlas Copco", "oem": "Atlas Copco", "header_rows": 1,
        "cols": {"location": 0, "part": 1, "desc": 2, "qty": 3},
        "prices": [],
    },
]


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = str(v).strip()
    return s or None


def num(v):
    if isinstance(v, (int, float)) and v != 0:
        return round(float(v), 2)
    return None


def part_key(p: str) -> str:
    """Normalised key so 12-0282-3065 / 1202823065 / 12 0282 3065 match."""
    return re.sub(r"[^a-z0-9]", "", p.lower())


def split_common(s: str | None) -> list[str]:
    """BA100_180_200 -> [BA100, BA180, BA200]; CP100i_CP150i_CP220i -> [...]."""
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


def ingest():
    records, sources = [], []
    for src in SOURCES:
        wb = openpyxl.load_workbook(RAW / src["file"], data_only=True, read_only=True)
        ws = wb[src["sheet"]]
        c, n = src["cols"], 0
        for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
            if i <= src["header_rows"]:
                continue
            row = list(row) + [None] * 12
            part = clean(row[c["part"]])
            if not part or part.lower() in ("part number", "part  number", "part no."):
                continue
            prices = []
            for label, col, cur, date in src["prices"]:
                val = num(row[col])
                if val is not None:
                    prices.append({"label": label, "value": val, "currency": cur, "date": date})
            rec = {
                "oem": src["oem"],
                "part": part,
                "key": part_key(part),
                "desc": clean(row[c["desc"]]),
                "qty": clean(row[c["qty"]]) if "qty" in c else None,
                "assembly": clean(row[c["assembly"]]) if "assembly" in c else None,
                "pump": clean(row[c["pump"]]) if "pump" in c else None,
                "common": clean(row[c["common"]]) if "common" in c else None,
                "location": clean(row[c["location"]]) if "location" in c else None,
                "prices": prices,
                "src": f"{src['file']} › {src['sheet']}",
                "row": i,
            }
            rec["commonPumps"] = split_common(rec["common"])
            records.append(rec)
            n += 1
        sources.append({"file": src["file"], "sheet": src["sheet"], "oem": src["oem"], "records": n})
        print(f"{src['sheet']:>16}: {n} rows")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"sources": sources, "records": records}, separators=(",", ":")))
    print(f"wrote {len(records)} records -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    ingest()
