# D3 – Backend Skeleton: Node.js/Express

## Project Overview

This is Deliverable 3 (D3) for the Databases and Web Services course.

The backend is implemented using Node.js and Express with a three-tier architecture. It connects to the existing D2 MySQL database of the ROSCA project and exposes two REST-style API endpoints that return JSON data.

The project topic is ROSCA , Track B (bidding model).

For D3, the required backend functionality focuses on retrieving:

- the members of a given circle
- the cycles of a given circle

## Technologies Used

- Node.js
- Express.js
- MySQL
- mysql2
- dotenv
- Postman for API testing

## Folder Structure

d3-backend/
├── src/
│   ├── app.js
│   ├── routes/
│   │   └── circles.routes.js
│   ├── controllers/
│   │   └── circles.controller.js
│   ├── services/
│   │   └── circles.service.js
│   └── db/
│       ├── connection.js
│       └── circles.repository.js
├── server.js
├── .env
├── package.json
└── package-lock.json