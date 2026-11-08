-- Align the original schema with the current Prisma model.
CREATE TYPE "workflow_run_status" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE "workflow_step_status" AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped', 'cancelled');
CREATE TYPE "job_status" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE "worker_status" AS ENUM ('active', 'paused', 'inactive');

ALTER TABLE "workflow_runs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "workflow_runs"
  ALTER COLUMN "status" TYPE "workflow_run_status"
  USING "status"::text::"workflow_run_status";
ALTER TABLE "workflow_runs"
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "workflow_steps" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "workflow_steps"
  ALTER COLUMN "status" TYPE "workflow_step_status"
  USING "status"::text::"workflow_step_status";
ALTER TABLE "workflow_steps"
  ALTER COLUMN "status" SET DEFAULT 'pending';

UPDATE "jobs" SET "status" = 'running' WHERE "status" = 'processing';
ALTER TABLE "jobs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "jobs"
  ALTER COLUMN "status" TYPE "job_status"
  USING "status"::text::"job_status";
ALTER TABLE "jobs"
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "workers" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "workers"
  ALTER COLUMN "status" TYPE "worker_status"
  USING "status"::text::"worker_status";
ALTER TABLE "workers"
  ALTER COLUMN "status" SET DEFAULT 'active';

ALTER TABLE "tenants" ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "workflows" ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "jobs"
  ADD COLUMN "lease_owner" UUID,
  ADD COLUMN "lease_expires_at" TIMESTAMPTZ,
  ADD COLUMN "fencing_token" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "claimed_at" TIMESTAMPTZ;

DROP INDEX "idx_run_tenant_status";
DROP INDEX "idx_run_created";
CREATE INDEX "idx_run_tenant_status_created"
  ON "workflow_runs"("tenant_id", "status", "created_at");

DROP INDEX "idx_event_run_sequence";
CREATE UNIQUE INDEX "workflow_events_run_id_sequence_key"
  ON "workflow_events"("run_id", "sequence");

DROP INDEX "idx_job_scheduled";
CREATE INDEX "idx_job_scheduled"
  ON "jobs"("status", "scheduled_at", "priority", "created_at");
CREATE INDEX "idx_job_lease_expiry"
  ON "jobs"("status", "lease_expires_at");

CREATE UNIQUE INDEX "workflows_id_tenant_id_key"
  ON "workflows"("id", "tenant_id");
CREATE UNIQUE INDEX "workflow_versions_id_workflow_id_key"
  ON "workflow_versions"("id", "workflow_id");

-- Only one active version per workflow
CREATE UNIQUE INDEX "uq_workflow_one_active_version"
ON "workflow_versions" ("workflow_id")
WHERE "is_active" = true;

-- Efficient pending job claiming
CREATE INDEX "idx_job_claimable"
ON "jobs" (
    "queue",
    "scheduled_at" ASC,
    "priority" DESC,
    "created_at" ASC
)
WHERE "status" = 'pending';

-- Efficient expired lease recovery
CREATE INDEX "idx_job_expired_leases"
ON "jobs" ("lease_expires_at")
WHERE "status" = 'running'
AND "lease_expires_at" IS NOT NULL;

ALTER TABLE "workflows" DROP CONSTRAINT "workflows_tenant_id_fkey";
ALTER TABLE "workflow_versions" DROP CONSTRAINT "workflow_versions_workflow_id_fkey";
ALTER TABLE "workflow_runs" DROP CONSTRAINT "workflow_runs_tenant_id_fkey";
ALTER TABLE "workflow_runs" DROP CONSTRAINT "workflow_runs_workflow_id_fkey";
ALTER TABLE "workflow_runs" DROP CONSTRAINT "workflow_runs_version_id_fkey";
ALTER TABLE "workflow_steps" DROP CONSTRAINT "workflow_steps_run_id_fkey";
ALTER TABLE "workflow_events" DROP CONSTRAINT "workflow_events_run_id_fkey";
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_tenant_id_fkey";
ALTER TABLE "workers" DROP CONSTRAINT "workers_tenant_id_fkey";
ALTER TABLE "outbox_events" DROP CONSTRAINT "outbox_events_tenant_id_fkey";

ALTER TABLE "workflows"
  ADD CONSTRAINT "workflows_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_versions"
  ADD CONSTRAINT "workflow_versions_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_runs"
  ADD CONSTRAINT "workflow_runs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_runs"
  ADD CONSTRAINT "workflow_runs_workflow_id_tenant_id_fkey"
  FOREIGN KEY ("workflow_id", "tenant_id") REFERENCES "workflows"("id", "tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_runs"
  ADD CONSTRAINT "workflow_runs_version_id_workflow_id_fkey"
  FOREIGN KEY ("version_id", "workflow_id") REFERENCES "workflow_versions"("id", "workflow_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_steps"
  ADD CONSTRAINT "workflow_steps_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_events"
  ADD CONSTRAINT "workflow_events_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workers"
  ADD CONSTRAINT "workers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbox_events"
  ADD CONSTRAINT "outbox_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
