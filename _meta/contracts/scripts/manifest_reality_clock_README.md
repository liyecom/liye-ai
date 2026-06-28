# manifest_reality_clock — runner & executor guide

Daily runner that paces the GHL Band B 30-day clock. Wraps
`validate_manifest_reality.py`, appends one append-only JSONL entry per run to
`_meta/contracts/ledger/manifest_reality_amazon-growth-engine.jsonl`.

See `ADR-Band-B-Activation-Readiness-Clock.md` for the governance decision.

## Run manually

```bash
# from any dir; needs a python with PyYAML + jsonschema (e.g. the AGE .venv)
source /Users/liye/github/amazon-growth-engine/.venv/bin/activate

# preview (does NOT write the ledger)
python3 _meta/contracts/scripts/manifest_reality_clock.py --dry-run

# record today's entry (append-only)
python3 _meta/contracts/scripts/manifest_reality_clock.py --append
```

Exit code: `0` if the day is clock-eligible (R1–R6 PASS, exit 0); `1` otherwise.
The ledger entry is always appended first when `--append`, even on FAIL — so a
scheduler's non-zero exit never loses the record.

## Continuity rule

Gate-open evidence = **30 consecutive UTC-day PASS**. Any missing day OR any
non-PASS entry resets the count (fail-closed). One run per UTC day.

Each entry now includes a `continuity` block:

- `prev_entry_utc_date` — last distinct ledger date strictly before today, or
  `null` for genesis.
- `gap_days` — UTC dates strictly between the previous ledger date and today.
- `continuity_break` — `true` when `gap_days` is non-empty.
- `streak_reset` — `true` when prior history exists and yesterday was not a
  clean eligible day, either because it is missing or because it has a non-PASS
  entry.
- `current_streak_len` — consecutive eligible UTC days ending today, or `0` if
  today is not eligible.
- `streak_start_utc_date` — first UTC date in the current streak, or `null`.

If `continuity_break` or `streak_reset` is true, the runner also emits a loud
stderr `ALARM` line. On wake, the runner records only TODAY and never backfills
a past day's PASS; a gap is surfaced in the field and alarm, never silently
healed.

## Executor options

| Option | Pros | Cons | When |
|---|---|---|---|
| **manual daily command** | zero infra; full control; nothing to maintain | depends on human discipline; a missed day resets the 30-day count | smallest setup; fine if the operator runs it reliably |
| **launchd local daily** (recommended default) | survives logout; deterministic daily fire; no human in the loop | macOS-local; must keep the venv path valid | **recommended** — start the clock today without waiting on CI |
| **GitHub Actions scheduled** | centralized, auditable | **AGE/liye_os CI is billing-frozen** → will not run reliably now | revisit only after billing restored |

**Default recommendation: launchd** (or manual if you prefer hands-on). Do NOT
wait for GitHub Actions billing — every paused day pushes activation out a day.

## launchd template (install only on explicit authorization)

Save as `~/Library/LaunchAgents/com.liye.manifest-reality-clock.plist`, then
`launchctl load` it. Fires daily at 09:05 local.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.liye.manifest-reality-clock</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/liye/github/amazon-growth-engine/.venv/bin/python3</string>
    <string>/Users/liye/github/liye_os/_meta/contracts/scripts/manifest_reality_clock.py</string>
    <string>--append</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>9</integer>
    <key>Minute</key><integer>5</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/liye/Library/Logs/liye/manifest_reality_clock.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/liye/Library/Logs/liye/manifest_reality_clock.stderr.log</string>
</dict>
</plist>
```

> Runner logs go to `~/Library/Logs/liye/` (NOT the repo ledger dir) so launchd
> stdout/stderr never pollute the versioned `_meta/contracts/ledger/` tree.
> **Before `launchctl load`, create the log dir:** `mkdir -p ~/Library/Logs/liye`.
>
> The launchd agent is **not installed by this PR**. Installing it (`launchctl
> load` + the `mkdir`) is a separate operator action per the Band B authorization
> boundary.

## Ledger schema versions

- **schema-v1** — day-0 entry only (`utc_date 2026-06-22`): manifest reality +
  validator R1–R6 + exit_code, no inline git-state evidence. Day-0's zero-touch
  was instead proven **externally** (closing-proof: DB byte-size invariant,
  out/facts=0, manifest blob unchanged).
- **schema-v2** — day-1 (`2026-06-23`) onward: adds `ledger_schema_version`,
  `engine_repo_commit`/`engine_repo_tracked_dirty`/`engine_repo_untracked_count`,
  `manifest_tracked_dirty`, `validator_repo_tracked_dirty`/`validator_repo_untracked_count`.
  These are **evidence-only** — `clock_eligible_day` remains a pure function of
  `validator overall==PASS AND exit_code==0`. A dirty repo never fails the clock;
  it is recorded so an auditor can see the manifest itself was untouched
  (`manifest_tracked_dirty=false`) even when the repo carries unrelated changes.
