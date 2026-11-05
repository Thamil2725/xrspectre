# XRSpectre

Online coding-assessment platform: admins build tests (hand-written questions
or random draws from question pools), students take them in a proctored
in-browser editor, mentors review the students in their departments/batches.

| Folder | What it is |
|---|---|
| `xrspectre-backend/xrspectre-backend` | Express 5 API, Prisma 7 + PostgreSQL, code-execution adapters |
| `xrspectre-platform/xrspectre-platform` | React 19 + Vite single-page app |
| `render.yaml` | Render Blueprint (one web service + one PostgreSQL database) |

In production the API also serves the built frontend, so the whole app runs
as a single service on a single origin.

---

## Deploying to Render

1. Push this folder to a GitHub/GitLab repository (it must be the repo root,
   i.e. `render.yaml` at the top level).
2. Render dashboard → **New → Blueprint** → select the repository.
3. Fill in the prompted values:

   | Variable | Value |
   |---|---|
   | `ADMIN_PASSWORD` | Password for the admin account (≥ 12 chars). If left empty, a random one is generated and printed once in the deploy log. |
   | `JUDGE0_URL` | Your Judge0 CE endpoint — see *Code execution* below. |
   | `JUDGE0_AUTH_TOKEN` / `JUDGE0_RAPIDAPI_KEY` | Whichever your Judge0 needs (or leave empty). |
   | `AI_API_KEY` | Only if you switch `AI_EVALUATION_PROVIDER` to `openai-compatible`. |

4. **Apply**. Each deploy builds the frontend, installs the API, runs
   `prisma migrate deploy`, creates/updates the admin account and starts the
   server. Health check: `GET /health`.
5. Sign in at `https://<your-service>.onrender.com` with `ADMIN_EMAIL`
   (default `admin@xrspectre.com`) and `ADMIN_PASSWORD`.

**Admin account.** Exactly one admin is created, from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` / `ADMIN_NAME`. To rotate the password, change
`ADMIN_PASSWORD` in the Render dashboard and redeploy.

**Free plan notes.** Free web services sleep after ~15 minutes idle (the
first request then takes ~1 minute) and free PostgreSQL databases expire after
30 days. Use paid instances for real exams.

### Code execution

Render web services cannot run Docker or privileged sandboxes, so student code
runs on an external executor:

- **Judge0 CE (recommended)** — `EXECUTION_PROVIDER=judge0`.
  - *Self-hosted:* run Judge0 on a Linux VM using the official release package
    (docker-compose + `judge0.conf`) from
    <https://github.com/judge0/judge0/releases>. Set `JUDGE0_URL` to it and, if
    you enable `AUTHN_TOKEN` in `judge0.conf`, the same value in
    `JUDGE0_AUTH_TOKEN`. Expose it only over HTTPS / a private network.
  - *Hosted (RapidAPI):* `JUDGE0_URL=https://judge0-ce.p.rapidapi.com` and
    `JUDGE0_RAPIDAPI_KEY=<key>`.
- **Piston** — `EXECUTION_PROVIDER=piston`, `PISTON_URL=<your instance>`
  (`PISTON_API_KEY` is sent as the `Authorization` header if set).
- **docker** — throw-away containers from `sandbox-runner/`; only for VM
  deployments where the API can reach a Docker daemon.
- **stub** — runs nothing and passes every test case; refused in production
  unless `ALLOW_STUB_EXECUTION=true` (demo only).

If the executor is unreachable the student gets a "try again" error — nothing
is recorded as a wrong answer.

### Subjective answers

`AI_EVALUATION_PROVIDER=stub` (the default) awards full marks to every
non-empty answer. For real grading set `AI_EVALUATION_PROVIDER=openai-compatible`
plus `AI_ENDPOINT`, `AI_MODEL` and `AI_API_KEY` (works with OpenAI and other
OpenAI-compatible APIs). If the AI call fails, the answer gets 0 points and is
flagged "needs review".

### Other settings

| Variable | Default | Purpose |
|---|---|---|
| `TRUST_PROXY` | `1` | Reverse proxies in front of the app |
| `ENFORCE_ATTEMPT_IP_LOCK` | `true` | Lock an attempt to the IP it started from (anti-cheat). Set `false` if students' IPs change mid-test (mobile/dual-stack networks). |
| `CLIENT_ORIGIN` | — | Only if the frontend is hosted on a different origin |
| `STATIC_DIR` | `../../xrspectre-platform/xrspectre-platform/dist` | Built frontend location |

---

## Local development

Requirements: Node.js ≥ 20.19 and a PostgreSQL database.

```bash
# 1. Database (or use any Postgres and set DATABASE_URL)
cd xrspectre-backend/xrspectre-backend
docker compose up -d postgres

# 2. API  →  http://localhost:4000
cp .env.example .env              # set JWT_SECRET and ADMIN_PASSWORD
npm install                       # also runs `prisma generate`
npx prisma migrate deploy
npm run seed                      # creates the admin account
npm run dev

# 3. Frontend  →  http://localhost:5173  (proxies /api to :4000)
cd ../../xrspectre-platform/xrspectre-platform
npm install
npm run dev
```

For real code execution locally, build the sandbox image
(`docker compose build sandbox-runner`) and set `EXECUTION_PROVIDER=docker`,
or use `EXECUTION_PROVIDER=stub` while working on the UI.

To try the production layout locally: `npm run build` in the frontend, then
`npm start` in the backend and open <http://localhost:4000>.
