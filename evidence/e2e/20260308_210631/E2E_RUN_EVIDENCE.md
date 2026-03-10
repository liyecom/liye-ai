# E2E Run Evidence — Slack -> Proxy -> LiYe Gateway -> AGE (Real Amazon Ads)

## Run Meta
- Date: 2026-03-10 13:59 (CST) / 05:59 (UTC)
- Operator: cc (Claude Code)
- Environment: local (macOS Darwin 24.6.0)
- Slack Workspace: T0AE (LiYe workspace)
- Amazon Ads Region: NA
- Capability: amazon://strategy/wasted-spend-detect
- Policy: phase1-v1.0.0 (read-only)

## Trace IDs
- trace_id: `trace-fe366165-1dff-4008-8783-90d85c849a5a`
- job_id: `48c12771-7307-4a9c-b4d2-7dc921757486`

## Commands / Services
- AGE: `python3 -m src.job_api.server --port 8765` (venv)
- LiYe Gateway: `npx tsx src/gateway/openclaw/server.ts` (WS:3210 / HTTP:3211)
- Slack Proxy: `npx tsx src/index.ts` (Socket Mode)

## Health Evidence
- age_health.json: `logs/age_health.json` — `{"status":"ok","version":"0.1.0"}`
- liye_health.json: `logs/liye_health.json` — `{"status":"ok","version":"0.1.0"}`

## Slack Evidence
- Progress Screenshot: `slack_screenshots/01_progress.png` (user to save)
- Final Screenshot: `slack_screenshots/02_final.png` (user to save)

## Trace Bundles
- liye_trace: `bundles/liye_trace_trace-fe366165-1dff-4008-8783-90d85c849a5a.tar.gz`
- age_job: `bundles/age_job_48c12771-7307-4a9c-b4d2-7dc921757486.tar.gz`
- merged bundle: `bundles/trace_bundle_trace-fe366165-1dff-4008-8783-90d85c849a5a.tar.gz`

## Result Summary (from Slack final)
- Decision: **ALLOW**
- Summary: Execution completed successfully
- Period: 2026-03-03 -> 2026-03-09 (7 days)
- Total Spend: $1,240.58
- Wasted Spend: $84.83 (6.8%)
- Search Terms Analyzed: 721
- Wasted Items Found: 3
- Top wasted items:
  1) muddy mats for indoor - $41.79 (24 clicks) — Campaign: B0C5Q8L7FP-MuddyPaws
  2) entry rugs for inside house - $21.76 (18 clicks) — Campaign: door mat
  3) dog rugs for muddy paws - $21.28 (21 clicks) — Campaign: B0C5Q8L7FP-MuddyPaws

## Streaming Phases Observed
- [x] Gate (0-10%)
- [x] Enforce (15-20%)
- [x] Route (25-30%)
- [x] Execute (30-90%) — including report_created, polling_report, report_ready, downloading, analyzing
- [x] Verdict (100%)
- [x] Complete chunk received

## Bugs Fixed During E2E
1. **ESM/CJS import** — `@slack/bolt` and `@slack/web-api` are CJS, project is ESM. Fixed with default imports.
2. **Bot message loop** — `message.im` event fired for bot's own messages, causing 73x infinite loop. Fixed by filtering `bot_id` and `subtype`.
3. **WS timeout too short** — Proxy timeout was 60s, AGE report takes up to 300s. Increased to 360s.

## Notes / Incidents
- Amazon Ads reporting API takes 30-300s to generate reports (variable)
- First two attempts timed out (report took ~5min), third succeeded (~38s, likely cached)
- No 429 rate limit on Amazon Ads API
- WS reconnect worked correctly when timeout occurred
- One earlier Slack API rate limit (429) during the bot loop incident
- Proxy correctly configured NO_PROXY bypass for localhost

## Pass/Fail Judgment

### PASS (with caveats)

- [x] Use Case B (near 7 days waste) streaming 5-phase OK + final result OK
- [x] GET /v1/traces/<trace_id> has complete events + result
- [x] trace bundle packed successfully
- [x] Redacted logs produced successfully
- [x] Real Amazon Ads data (not mock)

### Caveats
- Use Case A (ping) not tested — no ping handler implemented (deferred to future)
- AGE job bundle empty (job_store uses in-memory, not file-based persistence for job data)
- Screenshots pending manual save by operator
