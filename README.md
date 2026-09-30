# Event Manager AI — Docker-ready

## Start from a fresh clone

Requirements:
- Docker Desktop with Docker Compose
- Git

Run:

```bash
git clone <repository-url>
cd <repository-folder>
docker compose up -d --build
```

No `.env` file is required for the default development/demo setup.

Open:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Backend health: http://localhost:8000/api/health/database

Check containers:

```bash
docker compose ps
docker compose logs -f
```

Stop:

```bash
docker compose down
```

Stop and remove the development database volume too:

```bash
docker compose down -v
```

## Demo login

The default Compose configuration enables demo seeding:

- Email: `admin@example.com`
- Password: `demo12345`

The same password is used for the demo accounts unless a role-specific password is supplied.

## Configuration

The stack has usable defaults directly in `docker-compose.yml`. You may optionally create `.env` from `.env.example` to override them.

For a non-demo deployment, change at least:
- `JWT_SECRET_KEY`
- MySQL passwords
- `SEED_DEMO=false`

If AI mode uses OpenAI, also set:
- `AI_MODE`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Cloudinary is optional. Event image upload also has the application's existing fallback behavior.

## Architecture

```text
Browser
  |
  +--> frontend :5173
  |
  +--> backend :8000
          |
          +--> db :3306
```

Compose waits for MySQL health before starting the backend, and waits for backend health before starting the frontend. The backend creates the SQLAlchemy schema automatically at startup and retries DB initialization while MySQL is becoming ready.

## Rebuild after code changes

```bash
docker compose up -d --build
```

For a completely fresh local database:

```bash
docker compose down -v
docker compose up -d --build
```
