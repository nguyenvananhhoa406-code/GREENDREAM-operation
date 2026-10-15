# GREEN DREAM — Google Sheets inventory setup

Branch is a non-production preview. New page: /inventory.html. API: /api/inventory (GET, POST). The application does not yet auto-push Google Sheets edits; use the refresh button for Sheets -> platform. Do not merge before testing.

## Google Cloud
1. Enable Google Sheets API in Google Cloud project.
2. Create a dedicated service account, and an access key. Do not commit credentials.
3. Share the operational Google Sheet with its service-account email as **Editor**.

## Vercel settings (Preview)
Add environment variables:
- GOOGLE_SERVICE_ACCOUNT_EMAIL = email from service account
- GOOGLE_PRIVATE_KEY = private key (keep newline characters or escaped \\n)
- GREEN_DREAM_SHEET_ID = 1wEhP_UFi-3V2dbmRo-sWCF1DDEIXCXrpAKPVumhyExU
- INVENTORY_SYNC_TOKEN = long random passphrase (restricted to authorized staff)

Redeploy a Preview deployment, visit /inventory.html, and test POST with a disposable, new row. Confirm G (total), I (material code), J (entry code), L/M/N (unit normalized), P (validation), LỊCH SỬ NHẬP, LỊCH SỬ GIÁ, and monthly totals. Remove test row after checking.

## Limitations to resolve before production
- No automatic realtime refresh; edits in Sheets are visible on the platform only after clicking reload.
- POST appends to next free row; concurrent submissions may collide without database transaction/lock.
- Formula-based row IDs may change when users reorder/move source rows. Do not reorder transaction rows.
- Import form is create-only; corrections are done in Sheets.
- Requires proper authorization, input validation, and auditing before broader staff access.
- Current live website index.html is intentionally unchanged to avoid replacing Firebase configuration. Link to /inventory.html can be added after successful preview verification.
