# ROSCA — D5 Project

React dashboard connected to an Express API and MySQL database.

## Run with Docker

Open Docker Desktop, then run:

```bash
cp .env.example .env
docker compose up --build -d
```

Open the dashboard: http://localhost:8080

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