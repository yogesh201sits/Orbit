# Orbit

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## PostgreSQL and Prisma

Copy `packages/storage/.env.example` to `packages/storage/.env` and set
`DATABASE_URL` to your PostgreSQL connection string. The Prisma 7 configuration
and migrations are kept in the storage workspace.

From the repository root, run:

```bash
bun run db:generate
bun run db:migrate:dev
bun run typecheck
```

The generated Prisma client uses the PostgreSQL adapter. Workflow event
sequence allocation, run revisions, job leases, workflow activation, and
outbox writes must be performed in their transaction-aware repository paths.
Tenant and workflow deletion is soft deletion; permanent cleanup belongs to a
separate retention process.
