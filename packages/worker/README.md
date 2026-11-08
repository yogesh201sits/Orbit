# @durable/worker

The distributed worker runtime for the Orbit durable workflow execution platform.

## Features

- **Atomic Job Claiming**: Safe concurrency using PostgreSQL `FOR UPDATE SKIP LOCKED`.
- **Worker Lifecycle**: Registration, unique identity, status persistence, pause, resume, and graceful shutdown.
- **Lease Management & Fencing**: Prevents split-brain execution using monotonic fencing tokens and lease expiration detection.
- **Heartbeat & Health Monitoring**: Proactive worker liveness reporting, active lease renewal, and database failure detection.
- **Durable Workflow Execution**: Seamless coordination with `@durable/engine`, supporting immediate workflows, resumed workflows, and payload validation.
- **Distributed Crash Recovery**: Safe reclamation of expired leases, fencing stale workers, and cleanup of dead worker records.
