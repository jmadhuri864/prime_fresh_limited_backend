# Postman collection — Excel Import / Export

Two files to import into the **Postman for VS Code** extension (already installed as `postman.postman-for-vscode`):

| File | What it is |
|---|---|
| `PrimeFresh-Excel.postman_collection.json` | 13 requests — login + template/export/import for Product, Farmer, Customer, Vendor |
| `PrimeFresh-Local.postman_environment.json` | `baseUrl`, `uid`, `password`, `token` |

## Import

1. Open the **Postman** icon in the VS Code activity bar (left sidebar).
2. Sign in when prompted — the extension keeps collections in your Postman account.
3. Click **Import** (the icon at the top of the Postman panel, or `Ctrl+Shift+P` → **Postman: Import**).
4. Choose **Files**, select **both** JSON files from this folder, and confirm.

## First run

1. Pick **Prime Fresh — Local** in the environment dropdown at the top right of the Postman panel.
2. Fill in `uid` and `password` (your normal login).
3. Run **0. Login** — its test script writes `access_token` into the `token` variable.
4. Everything else inherits that token through collection-level Bearer auth, so no further setup.

If your API is not on port 4000, change `baseUrl` in the environment.

## What each folder does

Each of the four module folders has the same three requests:

- **download template** — empty workbook with the exact headers the importer reads, plus an Instructions sheet explaining every column
- **export to Excel** — all records matching `search` / `sort` (both query params start disabled — tick them to use)
- **import from Excel** — `form-data`, one key `file` of type **File**

Every request carries its full description, sample response and error list in the Postman **Documentation** pane, so you do not need to keep the reference doc open beside it.

## Sheets in a downloaded file

| Sheet | Purpose |
|---|---|
| Data sheet | Row 1 is the header row; required headers are shaded dark red |
| `Instructions` | Column Name / Type / Allowed Values & Notes |
| `Lists` | Hidden — backs the dropdowns, never needs opening |

Columns with a fixed set of values are **pick-only**: click the cell and a dropdown appears. That covers every enum and every Yes/No column, including inside repeating blocks — `Parameter1.Type` through `Parameter5.Type` all offer `good | bad | average`. The dropdown extends 500 rows past the last record.

## The test worth running

In any module folder, in order:

1. **download template** → open `data.downloadUrl`, fill 2–3 rows
2. **import from Excel** → `created` should match your row count, `unknownColumns` should be `[]`
3. **export to Excel** → open `data.downloadUrl`, confirm your rows came back with all their fields
4. **import from Excel** again, this time with the **exported** file → every row should land in `skipped` as a duplicate, `created: 0`

Step 4 is the real check: it proves the export, the template and the importer still agree on the headers. If a header drifts, that step fails loudly instead of silently dropping data.

## Regenerating

These files are generated, not hand-edited:

```bash
npm run postman:build
```

The source is `src/scripts/buildPostmanCollection.ts` — endpoint facts, descriptions and test scripts all live there, so every module stays consistent. Edit that, re-run, and re-import.

Full written reference: [`../excel-import-export-api.md`](../excel-import-export-api.md)

## Not using Postman?

The endpoints are plain REST — the reference doc has every method, URL, header, body and response, so `curl`, Thunder Client or the REST Client extension work just as well. The Postman VS Code extension does require signing into a Postman account; if that is not wanted, say so and a `.http` file that runs fully offline can be generated instead.
