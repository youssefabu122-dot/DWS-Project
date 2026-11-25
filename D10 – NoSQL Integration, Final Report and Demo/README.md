# ROSCA — D5 Project (with D9 security and D10 MongoDB feed)

React dashboard connected to an Express API and MySQL database, with JWT login and organizer/member roles.

**D10 final documents** are in [`D10-Final-Reports/`](D10-Final-Reports/): `FINAL_REPORT.pdf`, `STEP_BY_STEP_SETUP_AND_USER_GUIDE.pdf` and `BIDDING_ANALYTICS_EXPLAINED.pdf`.

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

## Activity feed — MongoDB document store (D10)

MySQL stays the source of truth for all money (contributions, bids, payouts, discount shares). MongoDB (`mongo` service, database `rosca_feed`, collection `activity_events`) only stores a read-only activity feed as JSON documents.

- **Documents:** every event shares a small envelope (`_id`, `type`, `circle_id`, `occurred_at`, `actor`). The `data` part differs by type. For example, `cycle.closed` has a nested `winner` and a `discount_shares` array, while `bid.placed` only has a rate. Event types: `bid.placed`, `bid.raised`, `contribution.recorded`, `cycle.opened`, `bidding.extended`, `bidding.reopened`, `cycle.awaiting_decision`, `cycle.decision` (with the random-draw audit), `cycle.closed`, `cycle.expired`. The `$jsonSchema` validator checks the envelope only (`mongo/init-feed.js`).
- **Newest first:** index `{circle_id: 1, occurred_at: -1, seq: -1}`.
- **Transactional outbox:** each business write also inserts a row into the MySQL table `ActivityOutbox` in the **same transaction** (`database/migrations/001-activity-outbox.sql`). A worker in the backend copies committed rows to MongoDB every second, using the outbox `event_id` as the document `_id`.
  - A rollback leaves no event.
  - If MongoDB is down, the rows wait and are retried with backoff (2 s, 4 s, … up to 60 s).
  - A retry never creates a duplicate.
- **Reading the feed:** `GET /circles/:id/activity?limit=20&before=<ISO time>`. It uses the same access rule as the other circle routes.
  - **Open bidding (Track B):** like the bid ranking, every member of the circle sees each `bid.placed` and `bid.raised` event with the bidder's name and discount rate, also while bidding is open. Actors only contain `role`, `member_id` and `name`, never an e-mail address.
  - Members only see their own discount share of a payout (payout records are organizer-only since D9). The organizer sees everything.
  - If MongoDB is down, only this route returns 503.
- **Dashboard:** the "Activity" panel shows each event as a plain sentence (for example "Cycle 3 closed. Ali Samir received the payout."). The full JSON documents are not shown in the UI but stay in MongoDB (`rosca_feed.activity_events`) for inspection and export.
- **Upgrading an existing stack:** add `MONGO_ROOT_PASSWORD` and `MONGO_APP_PASSWORD` to `.env` (see `.env.example`), then run `docker compose up --build -d`. The one-shot `db-migrate` service adds the outbox table to the existing MySQL volume without changing any data, and backfills past payouts, expired cycles and open bids once. You don't need to run `down -v`.

## Cycle statuses (D10)

Users only see three statuses. The stored values in `Cycle.status` are unchanged, and the API sends `display_status` and `outcome` next to them.

| Shown | Stored | Meaning |
|---|---|---|
| **Open** | `open` | Active. The *bidding window* is reported separately (`bidding_open`, shown as "Open · bidding closed"). If bidding ended with a valid bid but contributions are still missing, the cycle stays **Open**. It is never shown as Closed or as "no bids". |
| **Closed** | `closed` | Payout made, discount shares final (`outcome: payout`). |
| **Closed · no winner** | `expired` | Ended without a winner after the organizer chose "close without winner". Contributions were carried forward to the next cycle (`outcome: no_winner`). Doesn't count toward `total_cycles`. |
| **Expired** | `awaiting_decision` | The bidding deadline passed without any bid. The organizer must act: reopen bidding, close without a winner (carry contributions forward to a new cycle), or draw a random winner (only when everyone has paid). No new cycle is created automatically. |
| *(hidden)* | `pending` | A cycle created in advance that hasn't started. It isn't listed. `POST /circles/:id/cycles` opens it. |

**After receiving the payout**, a member:
- can't bid or raise a bid in that circle again;
- still pays the **full** contribution in every remaining cycle (the cycle isn't settled without it);
- stays a member of the circle.

A member can receive only one payout per circle. The application enforces this, and so do database triggers (migration `004-one-payout-per-member.sql`). The dashboard marks those members as "Received the pot · still pays each cycle".

## Bidding rules (Track B)

Open bidding: every member of the circle sees the ranking and the bid history (names and rates, never e-mails).

1. **Rates:** a bid is a discount from **0% to 50%** (at most two decimals). A 0% bid is a real bid: the member takes the pot without a discount. It is different from "no bids".
2. **Winner:** the highest discount wins. If only one eligible member bids (even at 0%), that member wins. The discount is split equally among the other members (integer cents, leftover cents to the lowest IDs).
3. **Ties:** the earliest *effective* bid wins. A raise gets a new time, so it ranks after bids that already had that rate.
4. **Raise:** `POST /cycles/:id/bids` again with a higher rate (response `200`, `"action": "raised"`). Bids can't be lowered or repeated at the same rate, and nobody can raise after the deadline. Every submit and raise is kept in `BidHistory` (`GET /cycles/:id/bids/history`).
5. **No early close:** with two or more eligible members, a cycle is settled only after the deadline, once every member has paid. This holds even if everyone already bid. The last unpaid member still receives the full pot automatically once funded.
6. **No bids by the deadline:** the cycle becomes **Expired** (stored as `awaiting_decision`). Nothing happens automatically: no payout and no new cycle. Contributions can still be recorded.

**Organizer controls:** `POST /cycles/:id/bidding`. Only the organizer can use it.

| Body | When | Effect |
|---|---|---|
| `{"action":"extend","minutes":n}` | bidding open | moves the deadline `n` minutes later (1–10080) |
| `{"action":"reopen","minutes":n}` | after the deadline, not settled | a new bidding round; allowed any number of times until the payout. Existing bids stay valid |
| `{"action":"new_cycle"}` | Expired | closes the cycle without a winner (shown as Closed · no winner), opens the next cycle, contributions carry over |
| `{"action":"random_winner"}` | Expired, all contributions recorded | draws one eligible (never-paid) member with `crypto.randomInt`. That member gets the full pot at 0% |

Each action runs in one MySQL transaction under the Circle → Cycle locks. Decisions are stored in `CycleDecision` with `UNIQUE(cycle_id, round_no)`, so each decision runs once and can't be replaced. The random draw stores its candidate list, the drawn index and the winner for auditing. After a payout, every action returns `409`. Migration `002-bidding-rounds.sql` adds these tables and columns. It keeps existing bids in their old tie order.

The organizer sets `total_cycles` when creating a circle (`POST /circles` now requires it). The circle is complete when that many cycles are `closed`. Expired cycles do not count.

The system never creates cycles automatically. The organizer starts the next cycle with `POST /circles/:id/cycles` (no body). This is allowed only when the circle has no open cycle. It opens the earliest `pending` cycle, or creates a new one if none is pending. A new cycle can only be created while the number of non-expired cycles is below `total_cycles`, so an expired cycle can be replaced. Contributions recorded on an expired cycle move to it, so members are not charged again.

Seed data (`total_cycles` = 10): cycles 1–3 `closed` (bids, payouts, discount shares), cycle 4 `expired` (no bids), cycle 5 `open` (created by the organizer, with carried-over contributions and some bids), cycle 6 `pending`.

## Recording payments (D10)

The app never moves money. It records contributions that members paid outside the app. In **Contribution status**, unpaid rows have a **Record payment** button:

- **Members** see it only on their own row. **The organizer** sees it on every unpaid row.
- It appears only while the cycle takes contributions (Open or Expired).
- An inline confirmation says that no money is transferred. If this is the last missing payment and bidding has closed, it also warns that the payout will be made immediately.
- After confirming, the button calls the existing `POST /contributions` (same rules, transaction and D9 checks), refreshes the dashboard, and adds a `contribution.recorded` event to the activity feed through the outbox.
- The button is disabled while saving. The database's `UNIQUE(member_id, cycle_id)` rejects any duplicate with `409`.

Tests: `frontend/src/components/ContributionStatus/ContributionStatus.test.jsx` (`npm test` in `frontend/`).

## Bidding analytics (Track B, D10)

`GET /circles/:id/analytics` serves the "Bidding analytics" panel. Only members of the circle and the organizer can read it (401 without login, 403 for other members). It's calculated from **MySQL only** (`Bid`, `Payout`, `DiscountShare`, `CycleDecision`), in integer cents, and rounded to 2 decimals for display.

**A. Average discount rate**
- `average = sum of final rates / number of bids`, over the bids in **completed** cycles (`closed`).
- Each member has one bid per cycle (`Bid` holds the latest rate). A raised bid therefore counts once, at its final rate. `BidHistory` isn't used here, so raises are never double-counted.
- 0% bids are included.
- Bids in the cycle that is still open can still change, so they are reported separately as `current`.

**B. Winning-bid distribution**
- For every completed payout, the winning discount and how the winner was chosen:
  - `bid`: the winner's bid;
  - `random_draw`: the organizer's random-winner decision, always 0%;
  - `final_member`: the last member, paid automatically at 0%.
- Cycles are counted in the ranges 0%, 0–5%, 5–10%, 10–20% and 20–50%. Upper bounds are inclusive, and 0% is its own range so 0% wins are visible.
- The average winning discount only includes real bids.

**C. Effective cost of credit.** A member paid out in completed cycle *k* (counted in payout order; expired cycles don't count) of a circle with *n* members and contribution *C*:

| Quantity | Formula |
|---|---|
| Pot | *n·C* |
| Discount paid, *D* | the sum of the recorded `DiscountShare` amounts for that payout |
| Received | *n·C − D* |
| Received early (the credit), *A* | *n·C − D − k·C*. The winner has already paid *k* contributions |
| Repayment | the remaining *m = n − k* contributions of *C*, one per cycle |
| Cost over the whole advance | *D / A* |
| Cost per cycle *r* | the rate where *A = C · (1 − (1+r)^−m) / r*, solved numerically (the internal rate of return of the advance) |

- *Example (seed cycle 1):* n = 10, C = 1,000, k = 1, D = 1,000 gives A = 8,000, repaid as 9 × 1,000. The cost is 12.50% over the advance, or **2.42% per cycle**.
- Members with *A ≤ 0* or *m = 0* (for example the last member) didn't borrow, so they show no cost. A 0% winner borrows at 0%.
- **Assumptions:**
  - The circle completes all *n* payouts and the winner pays *C* every remaining cycle.
  - Discount shares the winner receives in other cycles are income from lending and aren't subtracted.
  - Cycles are opened by the organizer and have no fixed calendar length, so the rate is **per cycle** and is **not** converted to a yearly (annualised) rate.

## Ports

| Service | Local port | Container port |
|---|---|---|
| Frontend (React / Nginx) | 8080 | 80 |
| Backend (Express) | 3001 | 3000 |
| Database (MySQL) | 3307 | 3306 |
| Document store (MongoDB) | 27018 | 27017 |

Docker Compose builds and runs all four services (plus the one-shot `db-migrate`). MySQL data is saved in a Docker volume.

## Stop

```bash
docker compose down
```