# Horic Autos Backend

Python backend scaffold for:

- AI buyer advisor trained from database inventory, prices, and running costs
- Customer enquiry capture
- Admin notification feed
- Push-subscription storage for future Web Push delivery
- SQLite database design
- Basic security headers, request validation, token-protected admin routes, and rate limiting

## Run

```powershell
$env:HORIC_ADMIN_TOKEN="replace-with-a-long-random-token"
$env:HORIC_ALLOWED_ORIGIN="http://127.0.0.1:4173"
python backend/app.py
```

## API

- `POST /api/enquiries`: public customer enquiry intake
- `POST /api/ai/chat`: Python AI bot response from current inventory data
- `GET /api/admin/enquiries`: admin-only enquiry list, requires `X-Admin-Token`
- `GET /api/admin/notifications`: admin-only notification list, requires `X-Admin-Token`
- `POST /api/admin/push-subscriptions`: stores browser push subscription details for a later Web Push sender

## Security Notes

- Change `HORIC_ADMIN_TOKEN` before exposing the server.
- Use HTTPS in production; browser push notifications require a secure context.
- Keep customer phone/email data in the backend, not localStorage, once this is deployed.
- Add a real Web Push sender such as `pywebpush` when network/package installation is available.
