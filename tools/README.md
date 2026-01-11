# tools (Utilities / Pipelines)

This directory contains **Tools**: on-demand utilities that run and exit.

## What qualifies as a Tool
- Run on demand (CLI/script), then terminates
- Typical jobs: batch processing, conversion, extraction, one-off generation
- May call external systems, but should keep logic simple and task-scoped

## Naming policy (Engineering)
**The `-os` suffix is forbidden in engineering names.**
Recommended:
- `{domain}-tool`
- `{domain}-pipeline`
- `{domain}-sync`
