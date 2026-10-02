# StrikeScan

A phone-friendly bowling league tracker designed for GitHub Pages.

## Features
- Separate seasons so leagues can be recreated each year
- Multiple leagues and teams per season
- Team rosters
- Three-game league nights
- Frame-by-frame standard bowling scoring and validation
- Score history plus average, high game, and high series
- Scoreboard photo OCR in the browser using Tesseract.js
- OCR review before saving
- JSON export/import backup
- Installable PWA shell and offline caching for core app files

## Scoreboard OCR
Choose the correct season, league, and team first. Upload or take a photo of the bowling scoreboard, run **Read Scoreboard**, review the detected row/frame information, then use **Apply OCR to Score Sheet**. Every frame remains editable before saving.

Bowling scoring screens vary a lot, so OCR is intentionally treated as a draft rather than silently saving uncertain results.

## Storage
Data is stored in browser local storage in this version. Use the Backup tab to export a JSON backup periodically.

## GitHub Pages
This repository is ready to serve from the repository root using GitHub Pages.
