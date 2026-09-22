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
   the unclean per-OEM tabs, planning tabs and `Cleaned Pump Data.xlsx` are not loaded — import
   them yourself from DATA if you want them). Takes ~20 s; the console shows progress.
   Pump names like `CP150i-285mm` / `BA100E D265` are split into model + variant, and common
   values like `BA_100_150_180_200_300` or `CD100M_150M_200M` expand to every pump listed.
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
every price ever imported (never overwritten), related parts in the same assembly, and the
source rows. Missing data is shown as _Not specified in imported source_ – nothing is invented.

## Importing more spreadsheets

Any `.xlsx` / `.xlsm` / `.csv`. The program finds the header row, maps columns by name
(Part Number / Description / Qty / Assembly / Pump Type / Common / Location / OEM, plus any
cost / list / dealer price columns with their currency and year), and guesses the OEM from the
sheet name or OEM column. You can correct the OEM and dataset type in the preview before importing.
Import history is listed on the DATA page; anomalies (possible duplicate part numbers, new pump
names, price changes, missing descriptions) go to **REVIEW** where they can be resolved gradually.

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
