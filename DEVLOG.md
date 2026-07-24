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

