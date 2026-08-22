# Excel Import / Export API

Postman testing reference for the Product, Farmer, Customer and Vendor Excel endpoints.

- **Base URL:** `http://localhost:4000` (no global route prefix; port comes from `PORT`, default `4000`)
- **Auth:** every endpoint below sits behind `deserializeUser` + `requireUser`
- **Ready-made Postman collection:** [`postman/`](postman/) — import the two JSON files instead of building these requests by hand

---

## 1. Get an access token first

All twelve endpoints return `401` without a token.

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/auth/login` |
| **Headers** | `Content-Type: application/json` |

**Request body**

```json
{
  "uid": "your-employee-id-or-email",
  "password": "your-password"
}
```

**Response `200`**

```json
{
  "status": "success",
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "id": "9f1c2e44-...",
  "userName": "Admin Admin",
  "roles": ["admin"],
  "currentWorkLocation": "1a2b...",
  "employeeId": "EMP0001",
  "permissions": [],
  "hasChild": true
}
```

### Postman setup

Create an environment with `baseUrl = http://localhost:4000` and `token`. Add this to the login request's **Tests** tab so the token is captured automatically:

```javascript
pm.environment.set("token", pm.response.json().access_token);
```

Then on the collection set **Authorization → Bearer Token → `{{token}}`**, or add the header manually to every request:

```
Authorization: Bearer {{token}}
```

> A `access_token` cookie also works — the login response sets one, so if you test in the browser you are already authenticated.

---

## 2. Endpoint summary

| Module | Download template | Export data | Import data |
|---|---|---|---|
| Product | `GET /products/download/template` | `GET /products/export/excel` | `POST /products/upload-product` |
| Farmer | `GET /farmers/download/template` | `GET /farmers/export/excel` | `POST /farmers/upload-farmer` |
| Customer | `GET /customers/download/template` | `GET /customers/export/excel` | `POST /customers/upload/customerdata` |
| Vendor | `GET /vendors/download/template` | `GET /vendors/export/excel` | `POST /vendors/upload-vendor` |

All three shapes behave identically across the four modules, so they are documented once below with the per-module differences called out.

---

## 3. Download template

Generates an empty workbook containing exactly the headers the importer reads, plus an **Instructions** sheet that lists every column, its type and its allowed values. Columns with a fixed set of values get a **dropdown** in the sheet itself, so those cells are pick-only. Uploads it to Spaces and returns the URL.

The template deliberately **omits the columns the system fills in itself** — the record code, `Status`, and `Created By`. Those still appear on an export so you can read them, but there is no point typing them into a template because the import ignores them.

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/products/download/template` |
| **Headers** | `Authorization: Bearer {{token}}` |
| **Query params** | none |
| **Body** | none |

**Response `200`**

```json
{
  "status": "success",
  "message": "Template URL generated successfully",
  "data": {
    "downloadUrl": "https://prime-fresh-storage.sgp1.digitaloceanspaces.com/exports/Product_Template_2026-08-21T09-14-22-511Z.xlsx",
    "fileName": "Product_Template_2026-08-21T09-14-22-511Z.xlsx"
  }
}
```

Open `downloadUrl` in a browser to download the file. Each of the four modules returns its own stem: `Product_Template_…`, `Farmer_Template_…`, `Customer_Template_…`, `Vendor_Template_…`.

**Errors**

| Status | When | Body |
|---|---|---|
| `401` | No / invalid token | `{ "status": "fail", "message": "You are not logged in" }` |
| `500` | `DO_SPACES_BUCKET` not set | `{ "status": "error", "message": "Internal Server Error" }` |

---

## 4. Export data

Writes every record matching the filters to a workbook, uploads it to Spaces, returns the URL. **Page and limit are deliberately ignored** — you get the whole filtered set, not one page.

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/products/export/excel` |
| **Headers** | `Authorization: Bearer {{token}}` |
| **Body** | none |

**Query params** (both optional)

| Param | Type | Description |
|---|---|---|
| `search` | string | Free-text match across the record, same behaviour as the list page |
| `sort` | string | `field:ASC` or `field:DESC`; comma-separate for multiple, e.g. `name:ASC,createdAt:DESC` |

Valid `sort` fields are entity property names:

| Module | Examples |
|---|---|
| Product | `name`, `productCode`, `packingType`, `shelfLife`, `createdAt` |
| Farmer | `farmerfName`, `farmerCode`, `primaryMobileNo`, `status`, `createdAt` |
| Customer | `organisationName`, `customerCode`, `emailPrimary`, `status`, `createdAt` |
| Vendor | `companyName`, `vendorCode`, `gstn`, `status`, `createdAt` |

**Example requests**

```
GET {{baseUrl}}/products/export/excel
GET {{baseUrl}}/farmers/export/excel?search=Nashik
GET {{baseUrl}}/vendors/export/excel?search=onion&sort=companyName:ASC
GET {{baseUrl}}/customers/export/excel?sort=createdAt:DESC
```

**Response `200`**

```json
{
  "status": "success",
  "message": "128 product(s) exported successfully",
  "data": {
    "downloadUrl": "https://prime-fresh-storage.sgp1.digitaloceanspaces.com/exports/Products_2026-08-21T09-20-04-882Z.xlsx",
    "fileName": "Products_2026-08-21T09-20-04-882Z.xlsx",
    "totalRecords": 128
  }
}
```

When nothing matches you still get `200` with `totalRecords: 0` and a header-only file — not a `404`.

**Errors**

| Status | When | Body |
|---|---|---|
| `401` | No / invalid token | `{ "status": "fail", "message": "You are not logged in" }` |
| `401` | Farmer / Customer / Vendor only, when the token has no resolvable user | `{ "status": "fail", "message": "User not authenticated" }` |
| `500` | Spaces upload failed | `{ "status": "error", "message": "Internal Server Error" }` |

### Row visibility

Farmer, Customer and Vendor exports apply the same rules as their list pages:

- **Admin / Verifier** — all records
- **Verifier (not admin)** — drafts are excluded
- **Anyone else** — only records they created

Product export has no per-user filtering — everyone gets every product.

---

## 5. Import data

Uploads a spreadsheet to Spaces, parses it, creates records, then **deletes the uploaded file from Spaces** — whether the import succeeded, partly succeeded, or threw.

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/products/upload-product` |
| **Headers** | `Authorization: Bearer {{token}}` — do **not** set `Content-Type` manually, Postman adds the multipart boundary |
| **Body** | `form-data` |

**Body — form-data**

| Key | Type | Value |
|---|---|---|
| `file` | File | your `.xlsx` file |

The field name is `file` for all four modules.

**Constraints**

- Max size **10 MB**
- Accepted file types:

  | Type | Product | Farmer | Vendor | Customer |
  |---|---|---|---|---|
  | `.xlsx` | yes | yes | yes | yes |
  | `.xls` (legacy) | yes | yes | yes | yes |
  | `.csv` | yes | yes | yes | **no** — rejected by the upload filter |

- You can upload the exact file the export endpoint produced — the `Instructions` and hidden `Lists` sheets are skipped automatically

**Response `200`**

```json
{
  "status": "success",
  "message": "12 product(s) imported, 2 skipped, 1 failed",
  "data": {
    "totalRows": 15,
    "created": 12,
    "skipped": [
      { "row": 4, "reason": "Product \"Onion\" already exists (ONI0001)" },
      { "row": 9, "reason": "Product Name is empty" }
    ],
    "failed": [
      { "row": 11, "reason": "Crop \"Bananna\" did not match any product and was not imported" }
    ],
    "unknownColumns": ["Extra Notes"],
    "missingColumns": []
  }
}
```

**Reading the summary**

| Field | Meaning |
|---|---|
| `totalRows` | Non-empty data rows found in the sheet |
| `created` | Records actually saved |
| `skipped` | Rows deliberately not imported — duplicate, or a required cell was empty. `row` is the Excel row number so you can jump straight to it |
| `failed` | Something in the row could not be resolved. **A row can appear here and still have been created** — e.g. a crop or product name that matches nothing is left off, but the rest of the record is saved |
| `unknownColumns` | Headers in your file the importer does not recognise — usually a typo |
| `missingColumns` | Required headers absent from the file. If this is non-empty the request fails with `400` and nothing is imported |

**Duplicate handling** — an existing record is **skipped and reported**, never updated:

| Module | Matched on |
|---|---|
| Product | `Product Name` (case-insensitive) |
| Farmer | `Primary Mobile No` |
| Customer | `Organisation Name` (case-insensitive) |
| Vendor | `Company Name` (case-insensitive) |

**Required columns** — the upload fails with `400` if one of these headers is missing from the file, and a row that leaves one blank is skipped:

| Module | Required |
|---|---|
| Product | `Product Name`, `Product Code Prefix` |
| Farmer | `First Name`, `Primary Mobile No` |
| Customer | `Organisation Name`, and both addresses: `Billing Address1` / `City` / `State` / `Pincode` and `Delivery Address1` / `City` / `State` / `Pincode` |
| Vendor | `Company Name`, `Vendor Category` |

**Errors**

| Status | When | Body |
|---|---|---|
| `400` | No file part in the form-data | `{ "status": "fail", "message": "No file uploaded" }` |
| `400` | Required header missing from the sheet | `{ "status": "fail", "message": "The uploaded file is missing required column(s): Product Name" }` |
| `401` | No / invalid token | `{ "status": "fail", "message": "You are not logged in" }` |
| `500` | Wrong file type, corrupt workbook, or Spaces read failure | `{ "status": "error", "message": "Internal Server Error" }` |

> The Customer import endpoint historically returned a plain-text body. It now returns the same JSON summary as the other three.

---

## 6. Suggested test order

Run this once per module to exercise the whole loop:

1. **`POST /auth/login`** → token saved to `{{token}}`
2. **`GET /{module}/download/template`** → open `downloadUrl`, confirm the **Instructions** sheet describes every column, and that clicking an enum cell (e.g. `Parameter1.Type`) shows a dropdown
3. Fill 2–3 rows in the template and save
4. **`POST /{module}/upload-…`** with that file → check `created` matches your row count and `unknownColumns` is `[]`
5. **`GET /{module}/export/excel`** → open `downloadUrl`, confirm the rows you just imported are present with all their fields
6. **`POST /{module}/upload-…`** with the **exported** file → every row should land in `skipped` as a duplicate, `created: 0`. This proves export and import agree on the headers
7. Edit one row in the exported file, change its name/mobile so it is no longer a duplicate, re-upload → `created: 1`

Step 6 is the important one — it is the check that the export, the template and the importer are still in sync.

---

## 7. Repeating column blocks

Some records hold a list of children. Those are written as numbered blocks, `Prefix1.Column`, `Prefix2.Column`, and so on.

| Module | Prefix | Blocks written on export | Columns |
|---|---|---|---|
| Product | `Variant` | 5 | `Variant Name`, `Variant Code`, `Count`, `Size`, `Variety`, `Origin`, `Brand` |
| Product | `Parameter` | 5 | `Name`, `Type` (`good` / `bad` / `average`) |
| Farmer | `Crop` | 5 | `Crop`, `Variety`, `No_Of_Plants`, `Pruning Date`, `Expected Harvest Date`, `Expected Quantity (Tonnes)` |
| Customer | `Spec` | 5 | `Article Name`, `Specifications`, `Packing Material Spec`, `Packing Parameters`, `Rejection Criteria`, `Comment` |

The importer reads up to **20** blocks, so you can add `Crop6.Crop` … `Crop20.Crop` by hand even though an export only writes 5. A block is read as soon as **any** of its columns has a value.

---

## 8. What is inside a template / export file

Every generated workbook has three sheets:

| Sheet | Purpose |
|---|---|
| `Products` / `Farmers` / `Customers` / `Vendors` | The data. Row 1 is the header row; required headers are shaded dark red, the rest dark blue |
| `Instructions` | One row per column: **Column Name**, **Type**, **Allowed Values / Notes**. Required columns are shaded red on the data sheet rather than listed here |
| `Lists` | Hidden. Holds the dropdown choices the data sheet points at — you never need to open it |

An **export** is wider than a **template**: it adds the system-filled columns listed below. The Instructions sheet in each file describes only the columns that file actually carries.

### Dropdowns

Any column with a fixed set of values is **pick-only** in Excel: click the cell and a dropdown appears. Typing something else raises *"Not an allowed value — Pick one of: …"*.

This covers every `enum` column and every `Yes`/`No` column, including the ones inside repeating blocks — `Parameter1.Type` through `Parameter5.Type` all get the same `good | bad | average` list.

The dropdown extends 500 rows past the last record, so it is already there on the blank rows you type into. If you paste beyond that the dropdown stops, but the import still rejects unknown values, so nothing bad gets in.

---

## 9. Cell formats

| Type | Accepted input | Notes |
|---|---|---|
| Date | `DD-MM-YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`, or a real Excel date cell | Day-first, so `03-04-2024` is 3 April. Impossible dates like `31-02-2024` are rejected, not rolled over |
| Boolean | Pick `Yes` or `No` from the dropdown. `True`/`False`, `Y`/`N`, `1`/`0` are also accepted | Blank means "not set", not `false` |
| Number | `1250.5`, `1,250.50`, `₹1250` | Separators and currency symbols are stripped |
| Enum | Pick from the cell's dropdown. Typed values also work in any case or spacing — `Fresh Fruits` matches `fresh fruits` |
| List | `Onion, Potato; Tomato` | Comma / semicolon / pipe separated, duplicates removed |
| Blank | Empty cell, whitespace, or `-` | All read as "no value" |

### How the product code is generated

`Product Code Prefix` drives it. The next code is the highest existing code **for that prefix**, plus one:

| Existing | You import | You get |
|---|---|---|
| `Onion` — prefix `ONI`, code `ONI0001` | `Red Onion`, prefix `ONI` | `ONI0002` |
| — | two `ONI` rows in one file | `ONI0002`, then `ONI0003` |
| — | prefix `TOM`, nothing yet | `TOM0001` |

The prefix is stored upper-cased, so typing `oni` still continues the `ONI` series rather than starting a second one.

Two things to know:

- **Rows without a prefix are skipped**, with `Product Code Prefix is empty` in `skipped`. The create form rejects them too, so this keeps import and form consistent.
- **Deleted products keep their code.** The lookup includes soft-deleted rows, so a code is never handed out twice.
- The number is read numerically, not as text, so the series carries on past `ONI9999` into `ONI10000` instead of repeating.

### Columns the system fills in

These appear on an **export** but not in the **template**, and are ignored if present in an uploaded file:

| Column | Set to |
|---|---|
| `Product Code` / `Farmer Code` / `Customer Code` / `Vendor Code` | Generated on save, next in the code series |
| `Product Image` | Uploaded through the app, never typed as a URL |
| `Variant Code`, `Variant Name` | Built from the product and the variant's count / size / variety / origin / brand |
| `Status` (Farmer / Customer / Vendor) | Always `pending` on import — the approval flow moves it from there |
| `Created By` (Farmer / Customer / Vendor) | **The logged-in user who ran the import**, not a name in the sheet |

Because `Created By` comes from the token, an import only ever creates records owned by the person who uploaded the file. That also means a non-privileged user will see exactly the rows they just imported when they next open the list or run an export.

---

## 10. Things worth knowing while testing

- **Export files are public.** The URL needs no login. Customer and Vendor exports contain PAN, Aadhar and bank account numbers, so treat the links as sensitive.
- **Exports are purged after 7 days** by a nightly job at 01:30. A `downloadUrl` from an old test run will eventually 404.
- **Import uploads are deleted immediately** after parsing, so re-testing the same file means uploading it again from your machine.
- **Lookup values are matched loosely, then created.** `Category`, `Classification`, `UOM`, `Subcategory`, `Customer Category`, `Customer Type`, `Vendor Category` and `Vendor Subcategory` are matched on their letters and digits only — case, spaces and punctuation are ignored — so a sheet saying `Fresh Produce`, `Fresh-Produce` or `freshproduce` all reuse an existing `fresh produce` row. A row is created only when nothing matches, and it stores the name exactly as typed. Subcategories are matched **within their parent category**, so two categories can each have a `Premium`.
- **Products, packing materials and users are not created.** An unmatched name there is reported in `failed` and the field is left blank.
- **Old header spellings still work.** Sheets written against the previous templates import unchanged; `Storage Temp (C)`, `Middl Name`, `Contact Mddele Name` and the old camelCase customer headers (`bankAccHolderFName`, `organisationName`, …) are all accepted as aliases.
- **Caches are invalidated only when at least one record was created**, so an all-skipped import will not refresh the list endpoints.

---

## 11. Where the columns are defined

If a column needs adding or renaming, edit the column map — export, template and import all read the same file, so they cannot drift apart.

| Module | File |
|---|---|
| Product | `src/product/createproduct/excel/product.columns.ts` |
| Farmer | `src/farmer/excel/farmer.columns.ts` |
| Customer | `src/customer/addcustomer/excel/customer.columns.ts` |
| Vendor | `src/vendor/createVendor/excel/vendor.columns.ts` |

Shared machinery lives in `src/excel/`. The contract is guarded by `src/test/service/excel.columns.spec.ts` — run `npx jest excel.columns` after any change to that map.
