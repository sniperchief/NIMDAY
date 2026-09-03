/**
 * Dev-only PostgreSQL with zero external infra: an in-process PGlite database
 * exposed over a TCP socket so Prisma talks to it like any Postgres.
 * Production uses a real PostgreSQL via DATABASE_URL — never this.
 *
 *   npm run db:dev                      # listens on localhost:5433, persists to ./.pglite
 *   # then, in another shell, point Prisma at it (note the pgbouncer flag):
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/postgres?pgbouncer=true&connection_limit=1" npm run db:push
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/postgres?pgbouncer=true&connection_limit=1" npm run dev
 *
 * The `pgbouncer=true` flag is required: it stops Prisma using named prepared
 * statements, which the single PGlite instance does not isolate per connection.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.DEV_DB_PORT ?? 5433);
const dataDir = process.argv[2];

const db = await PGlite.create(dataDir ? { dataDir } : {});
await db.waitReady;

const server = new PGLiteSocketServer({
  db,
  port,
  host: "127.0.0.1",
  maxConnections: 20,
});
await server.start();

console.log(
  `[dev-db] PGlite on postgresql://postgres:postgres@localhost:${port}/postgres` +
    (dataDir ? ` (persisted: ${dataDir})` : " (in-memory)"),
);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
}
