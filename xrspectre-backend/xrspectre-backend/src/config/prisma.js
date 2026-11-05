import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// Driver-adapter setup (Prisma 7+): at runtime, the query engine runs
// as pure TypeScript/WASM and talks to Postgres via node-postgres
// directly — no native engine binary needed to RUN the app. Note that
// `prisma generate` and `prisma migrate` still fetch a separate schema
// engine binary from Prisma's CDN; if that's blocked on your network,
// see the Troubleshooting section in README.md.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// A single shared PrismaClient instance — avoids exhausting DB
// connections from creating a new client per request/module.
export const prisma = new PrismaClient({ adapter });
