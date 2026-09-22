@echo off
rem Run PartsBender Parts Finder from source (needs Python 3.10+). Prefer PartsFinder.exe if you have it.
cd /d "%~dp0"
python -c "import openpyxl" 2>nul || pip install openpyxl
python partsfinder.py
pause
