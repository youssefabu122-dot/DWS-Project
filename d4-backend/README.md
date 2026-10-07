# D4 REST API - Track B

Express and MySQL backend for savings circles. Includes CRUD for members, circles, contributions and payouts, circle members/cycles reads, bid ranking, automatic settlement, input validation, CORS and rate limiting.

The default API address is `http://localhost:3000`. Keep `.env` private.

## Documentation

- API documentation: `docs/D4-API-Documentation.pdf`.
- Postman collection: `docs/D4-Track-B.postman_collection.json`. Import it into Postman and set `base_url` to the API address.

Use the IDs returned by POST for PUT and DELETE. The collection includes illustrative responses; those are examples rather than executed test evidence. Financial writes need suitable memberships and cycles. Automatic settlement changes financial records, so use separate test data.

## Track B behavior

When all eligible members have bid and all circle members have contributed, the highest discount wins; equal rates use the earliest bid ID. Settlement creates the payout and discount shares and closes the cycle in one transaction. A previous winner cannot bid again in the same circle. The last unpaid member receives the fully funded pot without bidding. The backend checks ready cycles at startup and periodically.

There is no authentication or automatic next-cycle creation in this implementation.
