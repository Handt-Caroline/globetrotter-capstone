\# GlobeTrotter Capstone — Development Log



\## July 23, 2026

\- Forked Engineer Moune's repo, removed Flask files (app/, requirements.txt),

&#x20; set up Node.js + Express project instead (approved by lecturer).

\- Built safe JSON data layer (src/db.js) — queues writes to prevent

&#x20; file corruption when multiple real users act at once.

\- Built authentication (src/routes/auth.routes.js) — passwords hashed

&#x20; with bcrypt, JWT tokens issued on login, valid 7 days.

\- Tested: register, login, and posting a comment on a site — all working

&#x20; via curl. Confirmed passwords are hashed in db.json, not plain text.

\- Seeded data/db.json with 20 real, verified Yaoundé tourist sites

&#x20; (Musée National, Monument de la Réunification, Mvog-Betsi Zoo, etc.)

## July 24, 2026
- Built bookings feature (src/routes/bookings.routes.js) — pulls price
  from the site itself so users can't tamper with the amount.
- Built manual MoMo/Orange Money payment flow (src/routes/payments.routes.js)
  — booking response now includes both real payment numbers automatically.
- Added admin verification (src/routes/admin.routes.js), protected by a
  secret key (ADMIN_KEY) — confirms payment after checking real SMS.
- Tested full flow end-to-end via curl: create booking -> see both MoMo/OM
  numbers -> submit payment reference -> admin verifies -> booking status
  becomes "confirmed". All working correctly.