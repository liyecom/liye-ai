# src/domain (Engine Only)

This directory is reserved for **Engines** (decision kernels).

## What qualifies as an Engine
An Engine is a reusable decision core that turns **Observations** into **Decisions / Plans / Policies**.

Typical outputs:
- Decision / Plan / Policy / Evaluation
- Structured reasoning artifacts that can be tested and reused

## What is NOT allowed here
Engines must NOT directly:
- call external networks / APIs
- read/write KV/DB directly
- push notifications
- include deployment configs (wrangler, docker, cron)
- run as long-lived services

Those belong to:
- `Systems/` (deployable, long-running services)
- `tools/` (on-demand utilities / pipelines)

## Naming policy (Engineering)
**The `-os` suffix is forbidden in engineering names.**
Use explicit types instead:
- `{domain}-engine`
- `{domain}-service`
- `{domain}-tool` / `{domain}-pipeline`

Note: "XX OS" may exist as product narrative in docs, but not as code/package/directory names.
