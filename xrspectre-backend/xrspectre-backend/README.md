# XRSpectre API

Express 5 + Prisma 7 (PostgreSQL via the `@prisma/adapter-pg` driver adapter).
See the [repository README](../../README.md) for deployment and setup.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start with auto-reload (nodemon) |
| `npm start` | Start the server |
| `npm run start:prod` | `prisma migrate deploy` → seed admin → start (what Render runs) |
| `npm run seed` | Create/update the single admin account from `ADMIN_*` env vars |
| `npm run prisma:migrate` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run prisma:deploy` | Apply pending migrations |

## Layout

```
src/
  app.js              Express app: security headers, rate limits, routes, SPA serving
  server.js           HTTP server + graceful shutdown
  config/             Environment validation, Prisma client
  middleware/         Auth (JWT + live account check), error handling
  routes/             URL → controller wiring (role checks live here)
  controllers/        Request handlers
  services/           Code execution (judge0 / piston / docker / stub), grading, AI evaluation
  utils/              Validation schemas, code wrappers/templates, mentor scoping
prisma/
  schema.prisma       Data model
  migrations/         SQL migrations (applied with `prisma migrate deploy`)
  seed.js             Single admin account
sandbox-runner/       Docker image used by EXECUTION_PROVIDER=docker
scripts/              Helper to install language runtimes into a local Piston
```

## Roles

- **ADMIN** — manages organisations, students, mentors, question pools and tests.
- **STUDENT** — self-signup (or bulk upload by an admin); takes tests whose
  audience matches their institution **and** department **and** batch.
- **MENTOR** — read-only view of students in their institution/departments/batches.
