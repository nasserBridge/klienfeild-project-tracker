# Project Tracker

Internal hours & budget dashboard. Replaces a 16-tab Excel master tracker for projects exported from Deltek (PM Web) and K-Fasts.

The app runs entirely in the browser. Excel parsing happens client-side; all data is persisted in IndexedDB (Dexie). No backend, no server-side database.

## Stack

- Next.js 14 (App Router) + TypeScript (strict)
- Tailwind CSS, hand-written UI primitives on Radix
- SheetJS (`xlsx`) for parsing & export
- Dexie + dexie-react-hooks for IndexedDB
- Recharts for charts
- `@tanstack/react-virtual` for the Transactions table
- `lucide-react` for icons

## Project layout

```
app/
  layout.tsx                root layout (sidebar wrapper)
  page.tsx                  empty-state / first-project redirect
  [projectId]/page.tsx      project view
components/
  sidebar/Sidebar.tsx       project list, add/delete, Cmd+U
  upload-dialog.tsx         drag-drop, detection, save to IndexedDB
  project-shell.tsx         header + tabs
  stat-card.tsx, status-badge.tsx
  tabs/                     Summary, Task Budget, Hours by Staff,
                            Hours by Task, Revenue by Period, Transactions
  ui/                       button, card, dialog, tabs, input, dropdown-menu
lib/
  db.ts                     Dexie schema + helpers
  types.ts                  shared types
  utils.ts                  formatters, date helpers, cn()
  parsers/
    detect.ts               scans workbook for PM Web vs Trans signatures
    pmweb.ts                PM Web All-Data Export parser
    kfasts.ts               K-Fasts Proj Trans Detail parser (multi-row header)
  calculations.ts           pivots, health, aggregations
  export.ts                 xlsx export
styles/globals.css          fonts (Fraunces / Inter Tight / JetBrains Mono), theme
sample-data/                live sample workbooks used during development
```

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

## Detection logic (so you can re-verify against new exports)

- **PM Web**: scan first 10 rows of every sheet for the columns
  `Project Number & Name`, `Task Number & Name`, `Total Fee`, `JTD Hours` —
  the highest-scoring row becomes the header. Data starts on the next row.
- **K-Fasts Proj Trans Detail**: scan first 12 rows for the *machine* token row
  (`WBS2`, `TaskName`, `TransDate`, `EmpVenUnitName`, `HrsQty`). Falls back to
  the human-label row (`Transaction Date`, `Employee, Vendor, or Unit Name`,
  `Hours or Qty`) and translates to machine names so the rest of the app uses
  one schema.

Detection is by structure, never by filename.

## Deploying to Vercel via GitHub

1. Push this repo to a new GitHub repo:
   ```bash
   git remote add origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```
2. Go to https://vercel.com/new, click **Import Project**, pick the repo.
3. Framework preset = **Next.js** (auto-detected). Leave build command and
   output directory as defaults. No environment variables needed.
4. Click **Deploy**. Subsequent `git push` to `main` redeploys automatically.

The app is fully client-side, so the Vercel free tier is plenty.

## Assumptions to verify

These are the calls I made while building. Worth confirming before sharing:

1. **Project ID parsing**: I take everything before the first ` - ` in the
   PM Web `Project Number & Name` field as the project identifier
   (e.g. `26003153.001A`). If your project numbers ever contain a literal
   ` - ` before the dash that separates the name, this breaks.
2. **Summary task detection**: I treat any task whose code matches
   `XX-0000` as a summary roll-up and exclude it from the Task Budget view.
   The full task list is still in the underlying data.
3. **Labor vs non-labor split**: A transaction is treated as labor if its
   `Category` starts with `L-`, falling back to "employee name has lowercase
   letters and isn't all caps." Vendors like `GRAINGER` are excluded from the
   Hours pivots but still contribute to revenue/period charts.
4. **Health calc**: Green when `% spent ≤ % time elapsed AND multiplier ≥ target`.
   Amber when one is breached. Red when both breached or `Remaining Total Fee < 0`.
   `% spent` is `Net Rev / Total Fee`, not `Labor Cost / Total Fee` — let me know
   if you'd rather it be cost-based.
5. **Fiscal periods**: Periods come through as `YYYYPP` strings. I display
   them as `FY{YY} P{PP}` since I don't know your firm's fiscal calendar.
   Easy to swap if you want calendar months instead.
6. **Re-uploading without PM Web first**: If you try to re-upload only the
   Trans file before a project has been registered (no PM Web ever parsed),
   the dialog will refuse — it needs PM Web at least once to learn the
   project ID.
7. **No web worker**: Parsing runs on the main thread. With ~5MB / ~10k-row
   inputs it stays smooth on a modern laptop. If real-world files are bigger,
   the parsing should move into a Web Worker.

## Keyboard

- `Cmd/Ctrl+U` — open upload dialog
- (Cmd+K project switcher is on the polish backlog.)

## Polish backlog (deliberately deferred)

- Cmd+K project switcher palette
- Web Worker for parsing
- Service worker for offline-after-first-load
