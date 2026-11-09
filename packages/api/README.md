# @durable/api (Orbit Control Plane HTTP API)

Production-ready HTTP Control Plane API for Orbit durable execution engine, built with [Bun](https://bun.sh), [Hono](https://hono.dev), [Zod](https://zod.dev), and [PostgreSQL](https://www.postgresql.org/) via `@durable/storage`.

---

## 1. Architecture

The Orbit Control Plane API manages workflow metadata, version declarations, execution dispatches, schedules, and run observability.

```text
packages/api/
  src/
    app.ts                   # Hono application factory & route mounting
    server.ts                # Bun HTTP server entrypoint & graceful shutdown
    config/
      env.ts                 # Environment variable validation & schema
    middleware/
      request-id.ts          # Correlation ID injection (x-request-id)
      logger.ts              # Structured request logging & duration tracking
      authentication.ts      # API key verification & SHA-256 hash lookup
      tenant-context.ts      # Tenant isolation & security boundary
      error-handler.ts       # Central error sanitizer & standardized error responses
    routes/
      health.routes.ts       # Liveness (/health) and readiness (/ready) checks
      workflow.routes.ts     # Workflow CRUD
      version.routes.ts      # Version management & activation
      run.routes.ts          # Idempotent run dispatch, cancellation, retry, & inspection
      schedule.routes.ts     # One-time and recurring cron schedules
      auth.routes.ts         # API key creation, listing, and revocation
    services/
      auth.service.ts        # API key generation (cryptographic SHA-256), verification, revocation
      workflow.service.ts    # Workflow definition lifecycle orchestration
      version.service.ts     # Version registration, SHA-256 checksums, and activation
      run.service.ts         # Atomic transactional run creation & deduplication
      schedule.service.ts    # Scheduling orchestration with recurrence validation
    schemas/                 # Zod validation schemas for all requests and parameters
    errors/
      api-errors.ts          # Typed HTTP error classes (BadRequest, NotFound, Conflict, etc.)
    types.ts                 # Hono context variables & dependency container definitions
    index.ts                 # Package exports
  tests/                     # Integration tests against PostgreSQL
```

### Function-Based Workflow Architecture Compatibility

Orbit workflows are defined in code using the upcoming TypeScript SDK. In accordance with durable execution architecture:
- **No Function Serialization:** Functions are never serialized via `Function.toString()`.
- **Clean Separation:**
  1. **Metadata & Versioning:** The Control Plane registers workflow definitions (step graph identifiers, timeouts, retry configurations).
  2. **Code Execution:** The worker/runtime environment executes the registered code matching the workflow version.
  3. **Run Dispatch:** The API receives execution requests, creates `WorkflowRun` records in PostgreSQL, and enqueues jobs in the `jobs` table for worker claiming.
  4. **Inspection & Control:** The API inspects run status, step states, event streams, and orchestrates cancellation/retry.

---

## 2. Installation & Setup

### Prerequisites

- [Bun](https://bun.sh) (v1.2+)
- PostgreSQL (v14+)

### Workspace Setup

```bash
# Install dependencies across workspace
bun install

# Run database migrations
bun run db:push

# Generate Prisma Client
bun run db:generate
```

---

## 3. Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | number | `3000` | Port for the HTTP server |
| `HOST` | string | `0.0.0.0` | Host interface to bind |
| `DATABASE_URL` | string | - | PostgreSQL connection URL |
| `NODE_ENV` | string | `development` | Environment (`development`, `test`, `production`) |
| `LOG_LEVEL` | string | `info` | Minimum log level (`debug`, `info`, `warn`, `error`) |
| `API_LOG` | boolean | `false` | Enable verbose HTTP access logging during tests |

---

## 4. Security & Multi-Tenancy

### API Key Authentication

- All `/v1/*` routes require API-key authentication.
- Keys use the format `orb_live_<hex(24)>`.
- **Hashed Storage:** Keys are stored as SHA-256 hashes (`key_hash`). Plaintext keys are returned only once upon creation and never stored or logged.
- Credentials can be passed via:
  - Header: `Authorization: Bearer orb_live_...`
  - Header: `X-API-Key: orb_live_...`

### Strict Multi-Tenancy

- Tenant identity is resolved solely from authenticated credentials.
- Tenant IDs supplied in request bodies or query parameters are ignored.
- Every database query and mutation is strictly scoped to the authenticated `tenantId`.
- Accessing or modifying a resource belonging to another tenant returns `404 Not Found`, preventing tenant enumeration.

### Key Revocation & Expiration

- Keys support optional `expiresAt` timestamps.
- Keys can be revoked via `DELETE /v1/auth/api-keys/:id`. Revoked keys are rejected immediately with `401 Unauthorized`.

---

## 5. Endpoints Reference

### Platform

#### Liveness Check
```http
GET /health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2026-11-09T14:00:00.000Z"
}
```

#### Readiness Check
```http
GET /ready
```
Response (200 OK / 503 Service Unavailable):
```json
{
  "status": "ready",
  "database": true,
  "timestamp": "2026-11-09T14:00:00.000Z"
}
```

---

### Workflow Management

#### Create Workflow
```http
POST /v1/workflows
Content-Type: application/json
Authorization: Bearer orb_live_...

{
  "key": "process-order",
  "name": "Order Processing",
  "metadata": { "department": "logistics" }
}
```
Response (`201 Created`):
```json
{
  "data": {
    "id": "11111111-2222-3333-4444-555555555555",
    "tenantId": "99999999-8888-7777-6666-555555555555",
    "key": "process-order",
    "name": "Order Processing",
    "metadata": { "department": "logistics" },
    "createdAt": "2026-11-09T14:00:00.000Z",
    "updatedAt": "2026-11-09T14:00:00.000Z"
  }
}
```

#### List Workflows
```http
GET /v1/workflows?limit=20&offset=0
Authorization: Bearer orb_live_...
```

#### Get Workflow
```http
GET /v1/workflows/:workflowId
Authorization: Bearer orb_live_...
```

#### Update Workflow
```http
PATCH /v1/workflows/:workflowId
Content-Type: application/json
Authorization: Bearer orb_live_...

{
  "name": "Updated Workflow Name",
  "metadata": { "status": "verified" }
}
```

#### Delete Workflow (Soft Delete)
```http
DELETE /v1/workflows/:workflowId
Authorization: Bearer orb_live_...
```
Response: `204 No Content`

---

### Workflow Versions

#### Register Workflow Version
```http
POST /v1/workflows/:workflowId/versions
Content-Type: application/json
Authorization: Bearer orb_live_...

{
  "version": 1,
  "definition": {
    "name": "process-order",
    "steps": [
      { "id": "charge-card", "retries": 3 },
      { "id": "ship-item", "retries": 2 }
    ]
  },
  "isActive": true
}
```
Response (`201 Created`):
```json
{
  "data": {
    "id": "22222222-3333-4444-5555-666666666666",
    "workflowId": "11111111-2222-3333-4444-555555555555",
    "version": 1,
    "checksum": "a7b3c...",
    "isActive": true,
    "activatedAt": "2026-11-09T14:00:00.000Z",
    "createdAt": "2026-11-09T14:00:00.000Z"
  }
}
```

#### List Versions
```http
GET /v1/workflows/:workflowId/versions?limit=20&offset=0
Authorization: Bearer orb_live_...
```

#### Activate Version
```http
POST /v1/workflows/:workflowId/versions/:versionId/activate
Authorization: Bearer orb_live_...
```

---

### Workflow Runs & Execution Control

#### Create Workflow Run (Idempotent)
```http
POST /v1/workflows/:workflowId/runs
Content-Type: application/json
Authorization: Bearer orb_live_...
Idempotency-Key: checkout-order-12345

{
  "input": {
    "orderId": 12345,
    "amount": 99.99
  }
}
```
Response (`201 Created` for first request, `200 OK` with `x-idempotent-replay: true` on replay):
```json
{
  "data": {
    "id": "33333333-4444-5555-6666-777777777777",
    "tenantId": "99999999-8888-7777-6666-555555555555",
    "workflowId": "11111111-2222-3333-4444-555555555555",
    "versionId": "22222222-3333-4444-5555-666666666666",
    "status": "PENDING",
    "input": { "orderId": 12345, "amount": 99.99 },
    "output": null,
    "error": null,
    "revision": 1,
    "idempotencyKey": "checkout-order-12345",
    "createdAt": "2026-11-09T14:00:00.000Z"
  },
  "isIdempotentReplay": false
}
```

#### List Runs
```http
GET /v1/runs?workflowId=11111111-2222-3333-4444-555555555555&status=PENDING&from=2026-11-01T00:00:00Z&limit=20&offset=0
Authorization: Bearer orb_live_...
```

#### Get Run
```http
GET /v1/runs/:runId
Authorization: Bearer orb_live_...
```

#### Cancel Run
```http
POST /v1/runs/:runId/cancel
Authorization: Bearer orb_live_...
```

#### Retry Run
```http
POST /v1/runs/:runId/retry
Authorization: Bearer orb_live_...
```
*(Only runs in `FAILED` status can be retried. Resets run to `PENDING` and enqueues a dispatch job).*

#### Inspect Run Steps
```http
GET /v1/runs/:runId/steps
Authorization: Bearer orb_live_...
```

#### Inspect Run Events
```http
GET /v1/runs/:runId/events
Authorization: Bearer orb_live_...
```

---

### Scheduling

#### Create Schedule (Recurring Cron or Delayed)
```http
POST /v1/schedules
Content-Type: application/json
Authorization: Bearer orb_live_...

{
  "workflowId": "11111111-2222-3333-4444-555555555555",
  "cronExpression": "0 9 * * 1-5",
  "timezone": "America/New_York",
  "missedExecutionPolicy": "SKIP",
  "input": { "reportType": "daily" }
}
```
Response (`201 Created`):
```json
{
  "data": {
    "id": "44444444-5555-6666-7777-888888888888",
    "tenantId": "99999999-8888-7777-6666-555555555555",
    "workflowId": "11111111-2222-3333-4444-555555555555",
    "cronExpression": "0 9 * * 1-5",
    "timezone": "America/New_York",
    "status": "ACTIVE",
    "nextRunAt": "2026-11-10T14:00:00.000Z"
  }
}
```

#### List Schedules
```http
GET /v1/schedules?limit=20&offset=0
Authorization: Bearer orb_live_...
```

#### Get Schedule
```http
GET /v1/schedules/:scheduleId
Authorization: Bearer orb_live_...
```

#### Update Schedule
```http
PATCH /v1/schedules/:scheduleId
Content-Type: application/json
Authorization: Bearer orb_live_...

{
  "cronExpression": "0 12 * * *",
  "status": "PAUSED"
}
```

#### Cancel Schedule
```http
DELETE /v1/schedules/:scheduleId
Authorization: Bearer orb_live_...
```

---

## 6. Idempotency Behavior

- When the `Idempotency-Key: <key>` header is provided on `POST /v1/workflows/:workflowId/runs`:
  1. The API checks for an existing run with that key for the authenticated tenant.
  2. If found, the existing record is returned with HTTP status `200 OK`, header `x-idempotent-replay: true`, and payload property `"isIdempotentReplay": true`.
  3. If not found, a new run and corresponding dispatch job are created atomically in a single PostgreSQL transaction.
  4. Concurrent identical requests hitting the API concurrently are protected by the database unique constraint `uq_tenant_run_idempotency` (`tenant_id`, `idempotency_key`), ensuring exactly one run is created and duplicate attempts resolve safely to the created run.

---

## 7. Error Format

Every error response follows a uniform JSON schema:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "path": "key",
        "message": "Workflow key cannot be empty",
        "code": "too_small"
      }
    ]
  }
}
```

### Standard Error Codes

| Status | Code | Description |
| :--- | :--- | :--- |
| `400` | `BAD_REQUEST` | Malformed request or invalid parameters |
| `400` | `VALIDATION_ERROR` | Request payload failed Zod schema validation |
| `401` | `UNAUTHORIZED` | Missing, invalid, expired, or revoked API key |
| `403` | `FORBIDDEN` | Valid credentials, but operation is unauthorized |
| `404` | `NOT_FOUND` | Resource does not exist or belongs to another tenant |
| `409` | `CONFLICT` | Unique key violation or invalid state transition |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server failure (internal details sanitized) |
| `503` | `SERVICE_UNAVAILABLE` | Database unreachable or platform not ready |

---

## 8. Local Development Commands

```bash
# Start server in watch mode
bun run --cwd packages/api dev

# Run API unit & integration tests
bun test packages/api/tests

# Run complete workspace tests
bun test packages

# Typecheck workspace in strict mode
bun run typecheck
```
