# github-scout (Hands tool)

Read-only, advisory GitHub **prior-art reconnaissance**. Given an idea, it searches
GitHub, gates each candidate by its authoritative license, and emits a conservative
recommendation — so a new capability can be checked against existing open source
*before* building, under LiYe governance (Fork 纪律, clean-room, harvest-ADR).

> **This tool decides nothing.** It produces an advisory report. Any reuse outcome
> goes through the harvest-ADR / Reference Declaration ceremony (SYSTEMS.md).

## Where this sits (architecture)

`github-scout` is a **three-layer** capability:

| Layer | Location | Role |
|-------|----------|------|
| **L1 Methodology** (Brain) | `docs/methodology/01_Research_Intelligence/github-scout/` | the human knowledge + the `license_policy.yaml` SSOT |
| **Hands tool** (this dir) | `tools/github-scout/` | the executable CLI that *consumes* L1 and talks to the GitHub API |
| **L3 Instruction** | `.claude/skills/github-scout.md` | flat advisory doc that tells Claude how/when to invoke this |

This tool is **BGHS-Hands infrastructure and sits OUTSIDE the Skill three-layer spine**
(it is not an L2 Executable Skill). It never originates policy — the license
tier → inspect ceiling → allowed recommendation mapping is loaded at runtime from the
L1 SSOT. See `declaration.yaml` and `ADR-GitHub-Prior-Art-Scout.md`.

## Usage (Phase 0: `report` only)

```bash
# from repo root — runs UNAUTHENTICATED (public read, 60/hr) by default
python3 tools/github-scout/scout.py report \
  --idea "deduplicate jsonl records by canonical content hash" \
  --out traces/dedup.json          # trace path is relative to this tool dir

python3 tools/github-scout/scout.py report --idea "..." --json   # full JSON to stdout
python3 tools/github-scout/scout.py report --idea "..." --limit 5 # cap candidates
```

Other subcommands (`derive` / `search` / `inspect` / `emit-reference`) are reserved
for Phase 1 and exit with code 3.

### Optional read-only token (rate-limit headroom)

Default is unauthenticated. To raise the limit to 5000/hr, supply a **read-only**
token via the env var named by `--token-env` (default `GITHUB_SCOUT_READONLY_TOKEN`):

```bash
GITHUB_SCOUT_READONLY_TOKEN=<fine-grained read-only PAT> python3 tools/github-scout/scout.py report --idea "..."
```

scout.py asserts the token via the `X-OAuth-Scopes` response header. Phase 0 requires
a **NO-SCOPE** token: **any classic scope at all (including read-only `read:org`) ⇒
fail-closed** (no live write probe is issued). A fine-grained "Public repositories
(read-only)" token reports empty scopes and passes. Your ambient `gh` keyring token is
intentionally never used (it carries `repo` + `gist` write scopes).

## Safety invariants (enforced + tested)

- **I1** zero external mutating side-effect — no fork/clone/vendor/PR/write; only local gitignored `traces/`.
- **I2** read-only by construction — no Authorization header unless an explicitly-asserted read-only token is given.
- **I3** sequential inspect — authoritative license first; README/tree only if the tier ceiling permits; any fetch failure ⇒ `unknown` ⇒ metadata only.

```bash
python3 tools/github-scout/test_scout.py     # 23 offline tests (no network; requires pyyaml)
```

`test_scout.py` loads the live L1 `license_policy.yaml`, so it fails if scout.py and
the SSOT ever drift (H-2), and asserts at the network-call layer that RED/unknown
repos get **zero** README/tree fetches (H-3).

## Files

| File | Purpose |
|------|---------|
| `scout.py` | the CLI (report subcommand) |
| `test_scout.py` | offline test suite (unittest, no deps beyond pyyaml) |
| `declaration.yaml` | BGHS Component Declaration (primary_concern: Hands) |
| `traces/` | run outputs — **gitignored**, advisory |
| `drafts/` | Phase-1 reference drafts — **gitignored**, manual promote |

Requires: Python 3.9+ and `pyyaml`.
