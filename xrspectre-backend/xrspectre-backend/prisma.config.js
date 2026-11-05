// Prisma 7 reads the database URL used by the Prisma CLI (`generate`,
// `migrate`, `studio`, …) from this file. The running app connects via
// the PrismaPg driver adapter in src/config/prisma.js using the same
// DATABASE_URL.
//
// `process.env` is used instead of Prisma's env() helper so that
// `prisma generate` (run on `npm install`) also works where no database
// URL is configured, e.g. in CI or a fresh checkout.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
