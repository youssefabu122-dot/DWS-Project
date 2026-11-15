# ROSCA — D5 Project (with D9 security)

React dashboard connected to an Express API and MySQL database, with JWT login and organizer/member roles.

## Run with Docker

Open Docker Desktop, then run:

```bash
cp .env.example .env
# Set JWT_SECRET in .env to a private random value, e.g. the output of: openssl rand -hex 32
docker compose up --build -d
```

Open the dashboard: http://localhost:8080 and sign in.

If you already have a database volume from before D9, reset it once so the new schema and seed load: `docker compose down -v`. This deletes all data in the volume.

## Security (D9)

- **Login:** `POST /login` with `email` and `password` returns a JWT (HS256, valid for 1 hour). Send it as `Authorization: Bearer <token>`. Every other route returns 401 without a valid token.
- **Passwords** are stored only as bcrypt hashes (cost 12). `JWT_SECRET` comes from `.env`, which is not committed.
- **Roles:** `organizer` (one global organizer account) and `member`. The role is read from the database, never from the request. A member who tries an organizer action gets 403.
- **Members** can only see their own circles. They can bid and record contributions only for themselves, and they can't see other members' e-mail addresses.
- **Database account:** the app's account has only `SELECT, INSERT, UPDATE, DELETE` (`database/03-privileges.sql`).
- **Dashboard:** nginx sends a Content-Security-Policy header.

Demo accounts (local testing only). Every seed account uses the password `RoscaDemo#2026`:

| Role | E-mail |
|---|---|
| Organizer | `organizer@example.com` |
| Member (circle 1) | `ahmed@example.com`, `omar@example.com`, … (members 1–10) |

The full authorization matrix, the vulnerability log and the privacy note are in `../D9-Security and Authorization/`.

## Bidding rules (Track B)

1. The highest discount bid wins.
2. If only one member submits a valid bid, that member wins.
3. Bids must be greater than 0%; 0% bids are rejected.
4. If no valid bid is submitted before the deadline, the cycle is marked `expired`. It stays expired until the organizer creates the next cycle.
5. Tied bids: the earliest submitted bid wins.

The organizer sets `total_cycles` when creating a circle (`POST /circles` now requires it). The circle is complete when that many cycles are `closed`. Expired cycles do not count.

The system never creates cycles automatically. The organizer starts the next cycle with `POST /circles/:id/cycles` (no body). This is allowed only when the circle has no open cycle. It opens the earliest `pending` cycle, or creates a new one if none is pending. A new cycle can only be created while the number of non-expired cycles is below `total_cycles`, so an expired cycle can be replaced. Contributions recorded on an expired cycle move to it, so members are not charged again.

Seed data (`total_cycles` = 10): cycles 1–3 `closed` (bids, payouts, discount shares), cycle 4 `expired` (no bids), cycle 5 `open` (created by the organizer, with carried-over contributions and some bids), cycle 6 `pending`.

## Ports

| Service | Local port | Container port |
|---|---|---|
| Frontend (React / Nginx) | 8080 | 80 |
| Backend (Express) | 3001 | 3000 |
| Database (MySQL) | 3307 | 3306 |

Docker Compose builds and runs all three services. MySQL data is saved in a Docker volume.

## Stop

```bash
docker compose down
```