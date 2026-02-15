# NetWorth Tracker

A finance cockpit for real people, not accountants.

This app helps you answer one high-value question quickly:  
**"Is my net worth getting better, and why?"**

You can track assets, liabilities, and monthly progression with a clean mobile + desktop UI, theme toggle, and category-level month-over-month analysis.

## Why This App Exists

Most finance tools are either:
- too shallow (just totals), or
- too overwhelming (enterprise-style complexity).

NetWorth Tracker sits in the middle: fast manual entry, useful trends, and enough structure to support meaningful decisions.

## What You Can Do

- Track assets and liabilities with category grouping
- Assign entries to a specific month at time of entry
- Capture monthly snapshots for historical trend tracking
- Visualize:
  - Net worth trend line
  - Asset allocation donut chart
  - MoM asset growth bar chart (positive/negative color logic)
- Filter MoM view by asset class (`All`, `Real Estate`, `Retirement`, etc.)
- Use dark/light theme (dark by default)

## UX Highlights

- Mobile-first responsive layout
- Professional dark palette with high-contrast charts
- Clean form hierarchy with labeled fields
- Visual consistency across cards, controls, and chart panels

## Tech Stack

- `Next.js 16` (App Router)
- `React 19` + `TypeScript`
- `Tailwind CSS 4`
- Local persistence with `localStorage` (`networth-tracker-state-v1`)

## Project Structure

```text
src/
  app/
    page.tsx          # Main dashboard + UI components
    globals.css       # Design tokens + theme styling
    layout.tsx
  lib/
    networth.ts       # Financial calculations and chart series builders
    storage.ts        # LocalStorage load/save + seeded demo state
  types/
    finance.ts        # Domain types (assets, liabilities, snapshots)
```

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How Data Works

- Source of truth is browser `localStorage`
- Entries are stored in `assets` and `liabilities`
- Snapshot history powers trend charts and MoM analytics
- Deleting entries updates snapshot totals so charts stay consistent

## How To Enter Historical Data

When adding an asset or liability, choose the target month in the form's `Month` field.  
The app updates snapshot totals for that month automatically.

## Scripts

```bash
npm run dev     # Start local dev server
npm run lint    # Lint checks
npm run build   # Production build
npm run start   # Run production server
```

## Current Limitations

- Data is local to one browser/device
- No authentication or multi-user backend yet
- No external bank sync yet

## Roadmap

- Backend persistence (PostgreSQL + Prisma)
- Auth + user isolation
- CSV import/export
- Automated monthly snapshot jobs
- Investment-level valuation feeds

## License

Private project for now.
