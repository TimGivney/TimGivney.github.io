# PartsBender Parts Finder (local Windows program)

Searchable knowledge base over PartsBender's pump-part spreadsheets. Runs entirely on your PC:
one `PartsFinder.exe`, a local SQLite database, and a browser tab. No internet, no install.

## Run it

1. Download `PartsFinder.exe` (built by the **Build PartsFinder.exe** GitHub Action — open the
   workflow run and grab the `PartsFinder-windows` artifact) and put it in a folder of its own,
   e.g. `C:\PartsFinder\`.
2. Double-click it. A console window stays open (that is the server) and your browser opens
   `http://localhost:8765/`. Close the console window to stop.
3. First run only: the exe loads the **Master** sheets of the bundled `Parts_Rev4.xlsx`
   (`Godwin/Sykes/BBA/Pioneer/Cornell Master`, `50CFM_Pioneer`, `50CFM Cornell`, `Atlas Copco`;
   the unclean per-OEM tabs, planning tabs and `Cleaned Pump Data.xlsx` are not loaded).
   Takes ~30 s; the console shows progress. On later runs any bundled sheet that has never been
   imported into your data folder is added automatically (nothing already there is touched).
   Pump names like `CP150i-285mm` / `BA100E D265` are split into model + variant, a pump cell
   like `PP66S12_PP66S14_PP88S12` becomes three separate pumps, and common values like
   `BA_100_150_180_200_300` or `CD100M_150M_200M` expand to every pump listed — each of those
   pumps gets its own entry under the company's Pump types.
4. To add more spreadsheets: **DATA** → drop the file on the page (or copy into `PartsFinder\inbox\`
   and click **Scan inbox folder**), check the preview for each sheet (OEM guess, column mapping,
   new / existing / price changes / duplicates / new pumps), untick anything you don't want, then
   **Import**. Imports only ever *add* — nothing already in the database is removed or overwritten,
   and old prices stay as history.
5. To start over with a brand-new sheet: **DATA** → **Flush ALL data…** (type `FLUSH` to confirm)
   empties the database; the raw copies in `PartsFinder\raw\` are kept. Then drop the new file.
6. **BROWSE**: pick a company → pump model → (optional) variant → parts list. A part used by more
   than one company shows a "Shared across N companies" table on its page with each company's
   pumps, assembly and prices side by side.

Windows SmartScreen may warn because the exe is unsigned: _More info → Run anyway_.

**LIGHT / DARK** button (top right) switches the theme; the choice is remembered in the browser.
**HISTORY** toggles a sidebar of recently viewed pages — ☆ star one to pin it at the top.
Clicking the logo goes home and clears the search box.

On a pump page, the **Common with** chips keep only the parts shared with that pump and the
**Assembly breakdown** chips keep only that assembly — both filter in place without leaving the page.

## Where your data lives

```
C:\PartsFinder\
  PartsFinder.exe
  PartsFinder\
    partsfinder.db   <- everything imported (back this file up)
    raw\             <- untouched copies of every imported spreadsheet
    inbox\           <- drop new spreadsheets here, then "Scan inbox folder"
```

Original spreadsheets are never modified. Every imported row keeps its file, sheet and row number.

## What you can search

- Part numbers, including variations: `12-0282-3065`, `1202823065`, `12 0282 3065` all match.
- Pump models (`BA200E D328`, `CP150i`), OEMs, descriptions, assemblies.
- `common BA150 BA200` – parts shared by two pumps.
- `where is 3911650100SP`, `show me everything for CP150i`.

A part page shows: used-on pumps, assembly, common-with pumps (parsed from `BA100_180_200`),
PartsBender (PB) and G-numbers when the sheet has them, every price ever imported (never overwritten), related parts in the same assembly, and the
source rows. Missing data is shown as _Not specified in imported source_ – nothing is invented.

## Editing, notes, history

- **Edit anything**: on a part page, click any cell in *Source rows* (company, part number, description,
  qty, assembly, pump, common-with, location, PB/G number), type, press Enter or click away to save.
  Esc cancels. Keys, pump variants and common-with links are recalculated automatically.
- **Add / remove rows**: "+ Add another row for this part" (or "+ Add a part" on a pump/company page);
  the × at the end of a row deletes it. Prices can be added or removed under *Pricing found* too.
- **Rename a pump** everywhere it appears (pump, variants, common-with) from the pump page.
- **Notes** on any part, pump or company – stored with the data, shown on the page and listed on DATA.
- Every change is logged under **DATA → Edit history** with an **Undo** button. Your original
  spreadsheets and the `raw/` copies are never modified – edits live only in `partsfinder.db`.
- **Export list to CSV** (opens in Excel) and **Print** buttons on part, pump and search pages.
- Keyboard: `/` jumps to the search box, `Esc` clears it.

## Reading a part page

- **Collapsible sections**: click any blue heading (Used on pumps, Pricing found, Source rows, …) to
  fold it away; the arrow turns sideways and the heading says *collapsed*. The state is remembered per
  heading in this browser, so a section you close stays closed on every part until you open it again.
- **Coloured cards**: each pump + assembly combination a part is used on gets its own card, with the
  quantity and location that belong to that combination. The colour is derived from the pump/assembly
  name, so the same pump/assembly is always the same colour everywhere (source rows, related parts,
  the assembly chips on a pump page). Colours are only a hint – with 12 colours two different
  combinations can share one, so read the card.

## Screens (side-by-side comparison)

**+ SCREEN** in the header opens the Screens workspace (`/screens`) with the page you were on as
screen 1. Each screen is a fully independent PartsFinder: search, browse and edit in one without
affecting the others. Title bar buttons: ⧉ duplicate, □ maximise/restore, ✕ close. Drag the title
bar to move, drag the bottom-right corner to resize, **Tile** arranges them all in a grid. The layout
and what each screen shows is remembered in this browser. *single screen →* goes back to the normal view.

## Importing more spreadsheets

Any `.xlsx` / `.xlsm` / `.csv`. The program finds the header row, maps columns by name
(Part Number / Description / Qty / Assembly / Pump Type / Common / Location / OEM / PB Number /
G-Number, plus any
cost / list / dealer price columns with their currency and year), and guesses the OEM from the
sheet name or OEM column. You can correct the OEM and dataset type in the preview before importing.
Import history is listed on the DATA page; anomalies (possible duplicate part numbers, new pump
names, price changes, missing descriptions) go to **REVIEW** where they can be resolved gradually.

### The standardized workbook format (Standardized_Pump_Data…)

One sheet per company with the columns *PB Number, PB Description, G-Number, OEM Description,
OEM Part Number, OEM List Price, Our Costs Price, Sell Price, OEM, Location #, Qty, Assembly, Pump Type,
Common, Discount* imports directly. Rules the importer follows – questionable data is **flagged on
REVIEW, never silently corrected**:

- Part numbers are identifiers: leading zeros (`001-0003`, `00150 1000`) and decimal-looking values
  (`18799.123`) are kept exactly as written; stray spaces are trimmed and flagged
  (`whitespace_part_number`). Punctuation-only variants (`35-0399-8402/110` vs `35-0399-8402110`)
  are the same part.
- Rows with no OEM part number but a PB/G number are kept under that number and flagged; rows with
  no identifier at all are skipped and flagged (`blank_part_number`).
- `Cornell, Pioneer` in the OEM column means the part is shared: one record per company.
- An OEM Part Number cell listing several numbers (`30500107; 31900404; …`, a kit) is stored under the
  row's PB/G number with the list kept as a note (`multi_part_number`). One PB number used for different
  items is flagged (`pb_conflict`).
- The `Document`/`Document Name` column (the exploded-view drawing the Location # callout belongs to) is
  imported as `document` and shown on each pump/assembly card — editable like any other field.
- A **Register Part Numbers** workbook (sheets headed `PartsBender Part Number` mapping each PB number to
  per-OEM part numbers and descriptions) imports as PartsBender parts. Its other tabs (Category etc.) are
  lookup legends and are skipped. After every import, any row still missing a PB number whose OEM part
  number the Register maps is filled in (`pb_from_register`). On a conflict the non-assembly PB is picked
  automatically (assembly/kit-style numbers are `ASM-…`, `KIT-…`, `G4C07-…`); still-ambiguous matches are
  flagged `register_conflict`. Kit rows get a note resolving each component OEM number to its PB/G number.
  Rows with no identifier at all stay skipped — no PB/G number is ever invented.
- Text in a price column (`on demand`, `2016 List`) is not imported as a price – flagged
  (`non_numeric_price`). Sell price below cost is flagged. `Discount` and any other unknown column is
  kept in the row's raw data and listed as an `unmapped_column` issue.
- Non-numeric quantities (`A/R`, `AIR`, `1m`) are kept as text and flagged; the same part with
  different descriptions and near-duplicate assembly names are flagged for you to decide. Assembly
  cells that are just a worksheet name (`Sheet1`, `Data`) are treated as blank (and flagged once).
- Exact duplicate rows inside a sheet are imported once. Re-importing the same file adds nothing
  (the preview shows the rows as *unchanged*); only prices that actually changed are added as history.
- Nothing pre-existing is touched: an import is one transaction and is appended to the database.

## Running from source

`run.bat` (needs Python 3.10+; installs `openpyxl` if missing). Or `python partsfinder.py`.
Set `PARTSFINDER_PORT` to change the port.

## Building the exe

`.github/workflows/partsfinder-exe.yml` builds `PartsFinder.exe` with PyInstaller on Windows
whenever `tools/partsfinder/**` changes (or manually via _Run workflow_). Locally:

```
pip install pyinstaller openpyxl
pyinstaller --onefile --name PartsFinder partsfinder.py
```
