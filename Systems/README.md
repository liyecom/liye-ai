# Systems (Deployable Services)

This directory contains **Services**: deployable, long-running systems.

## What qualifies as a Service
- Requires deployment and runtime environment
- Runs continuously (worker/server/cron) or exposes HTTP endpoints
- Owns operational concerns: config, secrets, observability, cost, reliability

## Naming policy (Engineering)
**The `-os` suffix is forbidden in engineering names.**
Recommended:
- `{domain}-service`
- `{domain}-radar`
- `{domain}-hub`
