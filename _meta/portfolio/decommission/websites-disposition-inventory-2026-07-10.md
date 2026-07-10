# Websites Disposition Inventory

- **Status:** C1.5 evidence inventory and target disposition; no migration authorized
- **Snapshot:** 2026-07-10 (Asia/Shanghai)
- **Decision anchor:** LiYe Systems architecture verdict v1.1, Q5 / S9 / C1.5
- **Decision artifact:** LiYe Systems architecture verdict v1.1 (2026-07-10),
  SHA-256 `4480f0b85222386ac750047dd38b69c94d02ff8da65d09582e054be83bf1e823` (operator-private)
- **Inventory branch base:** `liye_os origin/main@b1ff7dc84b83`
- **Evidence anchors:** UGE `origin/main@b2a9cb5b7775`; Kuachu
  `origin/main@1105692246ae`; Zhangxiang remote default
  `master@03c298c5bccc` and inspected local branch `5acb9e2880ae`
- **Consumers:** C2 SSOT truth-sync and later per-site migration, grounding,
  and enforcement PRs

## 1. Decision boundary

LiYe OS is a governance/contract compiler plus narrow control-plane tools. Live
business websites do not belong inside its Layer 0 checkout. C1.5 records the
current website territory, its recoverability, deployment evidence, UGE
grounding, and the target disposition of each site.

This document does **not**:

- move, copy, delete, archive, deploy, stop, or create a site repository;
- alter a Vercel project, domain, billing item, database, credential, or user;
- edit `CLAUDE.md`, `SYSTEMS.md`, website doctrine, the UGE repository, or a
  site repository;
- repeat or reverse the completed Kuachu spin-out;
- certify that a historical deployment record or local provider binding is a
  currently live endpoint;
- treat an ignored directory, a nested Git root, or one checkout as equivalent
  versioning states.

Privacy boundary: repository/path identifiers already used by the public
governance surface are retained for an actionable inventory. No endpoint URL,
provider/account ID, customer record, credential, private-source fingerprint,
or external-user record is reproduced here.

## 2. Evidence vocabulary

- **TRACKED FIXTURE** — files are tracked by the LiYe OS repository.
- **IGNORED / UNVERSIONED** — local source exists but is neither tracked by
  LiYe OS nor contained in its own Git root.
- **INDEPENDENT / CO-LOCATED** — an independent Git repository is physically
  nested under the LiYe OS checkout.
- **INDEPENDENT / EXTERNAL** — an independent Git repository is physically
  outside the LiYe OS checkout.
- **HISTORICAL DEPLOYMENT EVIDENCE** — provider/GitHub records exist; current
  endpoint, billing, and user state remain `UNKNOWN`.

Target disposition values:

- **MIGRATED** — the site has already left the Layer 0 checkout; do not repeat.
- **MIGRATE_REQUIRED** — the site must leave the Layer 0 checkout through a
  separate operator-approved migration packet.

## 3. Current territory

The old statement “seven Astro sites under `liye_os/websites/`” is no longer
true. Seven assets remain in the C1.5 decision scope, but their physical and Git
topology is now:

| Asset | Physical location class | Versioning state | Provider/deployment evidence | Target disposition |
|---|---|---|---|---|
| Kuachu | `~/github/sites/kuachu.com` | Independent private Git repo; clean `main` equals `origin/main@1105692246ae` | 9 historical GitHub deployment records; no local Vercel binding observed | **MIGRATED** — keep external; pointer repair only |
| Zhangxiang | physically under `liye_os/websites/` | Independent private Git repo; inspected local handover branch `5acb9e2880ae`; remote default `master@03c298c5bccc`; one untracked `.codegraph/` | Tracked `vercel.json`, local Vercel binding, 17 historical GitHub deployments | **MIGRATE_REQUIRED** — relocate checkout without rewriting repo history or production state |
| Foneyi site | physically under `liye_os/websites/` | **IGNORED / UNVERSIONED**; about 89 source files; no own Git root or remote | No local Vercel binding or `vercel.json` observed; live state `UNKNOWN` | **MIGRATE_REQUIRED** — independent private repo and restore baseline |
| Muddy Mats site | physically under `liye_os/websites/` | **IGNORED / UNVERSIONED**; about 89 source files; no own Git root or remote | No local Vercel binding or `vercel.json` observed; live state `UNKNOWN` | **MIGRATE_REQUIRED** — independent private repo and restore baseline |
| Refetone site | physically under `liye_os/websites/` | **IGNORED / UNVERSIONED**; about 89 source files; no own Git root or remote | No local Vercel binding or `vercel.json` observed; live state `UNKNOWN` | **MIGRATE_REQUIRED** — independent private repo and restore baseline |
| Timo Mats site | physically under `liye_os/websites/` | **IGNORED / UNVERSIONED**; about 89 source files; no own Git root or remote | No local Vercel binding or `vercel.json` observed; live state `UNKNOWN` | **MIGRATE_REQUIRED** — independent private repo and restore baseline |
| `example-site` | tracked under `liye_os/websites/` | **TRACKED FIXTURE** in LiYe OS | No local Vercel binding or `vercel.json`; no machine build consumer found | **MIGRATE_REQUIRED** — leave `websites/`; no standing exception granted |

The four ignored/unversioned sites each occupy roughly 194–196 MB because the
local directories include dependencies. That size is not a migration payload:
future repositories must begin from reviewed source-only allowlists and must not
commit `node_modules`, build output, provider metadata, or environment files.

## 4. Per-asset disposition contracts

### 4.1 Kuachu — migration complete

Evidence:

- the old `liye_os/websites/kuachu` directory is absent;
- the independent checkout and remote default both resolve to
  `1105692246ae` in this snapshot;
- its relative grounding files still exist under the new repository root:
  `src/layouts/BaseLayout.astro`, `src/components/AffiliateCard.astro`, and
  `src/content/posts/`;
- it consumes the themes repository through `THEMES_REPO_PATH` and the
  `@themes` alias.

Disposition: **MIGRATED**. C1.5 must not copy it back, redo its history, or
modify the active spin-out track. Follow-through is limited to stale pointer and
grounding repair in their owning repositories.

### 4.2 Zhangxiang — Git exists; physical boundary is wrong

Evidence:

- it is an independent Git root with a private remote, not an unversioned child;
- its local checkout is on a handover branch, while the remote default is
  `master`; the two coordinates must not be conflated;
- the UGE-referenced contact and OAuth callback files exist on remote default
  `master` as well as in the inspected checkout;
- provider binding and historical deployment evidence exist, but current live,
  billing, renewal, and user state remain `UNKNOWN`.

Disposition: **MIGRATE_REQUIRED**. Relocate the existing checkout to an
independent site/product root. Do not re-initialize Git, squash its history,
change production binding, or infer that physical relocation authorizes a
deployment.

### 4.3 Four ignored live-site directories — recoverability gap

Evidence:

- each directory is excluded by `websites/.gitignore` and is not tracked by the
  parent repository;
- none contains its own Git root or remote;
- each contains a source-shaped Astro tree, while deployment, domain, renewal,
  backup, and external-user evidence remain `UNKNOWN`;
- a clean LiYe OS checkout or GitHub clone cannot reconstruct any of them.

Disposition: **MIGRATE_REQUIRED**, one site per migration packet. Each packet
must establish before cutover:

1. source-only allowlist and privacy scan;
2. independent private Git remote and default branch;
3. deployed project/domain/owner reconciliation without copying account IDs
   into LiYe OS;
4. backup plus clean-directory restore readback;
5. old-path consumer search and rollback pointer;
6. operator merge/activation as separate flips.

No shared privileged execution cell follows from using the same toolchain or
template.

### 4.4 `example-site` — exception not earned

The repository describes `example-site` as a template, smoke test, and allowed
tracked path. Current evidence does not show a machine job that builds it or a
named consumer/SLA for its content. `live-site-gate.yml` only names the path in
an allowlist; that is not consumption of the site implementation.

Disposition: **MIGRATE_REQUIRED**. No standing exception is granted in C1.5.

- If a real builder/contracts CI consumer is demonstrated, migrate only the
  smallest synthetic fixture it needs into the owning test/fixture surface and
  give that check an explicit consumer and failure SLA.
- Otherwise, grade/archive the example outside the active Layer 0 boundary and
  remove the resident site.

The full current content tree is not automatically entitled to follow a future
minimal fixture.

## 5. Versioning enforcement finding

The current `Live Site Gate` claims to block live-site files from public PRs,
but its core expression uses a negative lookahead with `grep -E`:

```sh
grep -E '^websites/(?!example-site/|\.gitignore$|README\.md$|_templates/)'
```

A controlled local probe against both allowed and forbidden paths returned
exit code `2` (`repetition-operator operand invalid`). The workflow appends
`|| true`, so the regex error is converted into an empty `LIVE_FILES` value and
the job follows its success path. On this snapshot, the gate is **fail-open**;
its historical green status is not evidence that live-site paths were rejected.

C1.5 does not fix the workflow. A separate surgical PR must:

- use syntax supported by the runner instead of unsupported ERE lookahead;
- include positive fixtures for every allowed path class;
- include negative fixtures for at least one live-site path;
- fail on regex/tool errors rather than mapping them to an empty result;
- demonstrate one controlled rejection before claiming machine enforcement.

Until that PR is merged and exercised, the privacy boundary relies on ignore
rules plus review/detection, not a Q6-certified fail-closed machine gate.

## 6. UGE grounding audit

UGE remote default was inspected at `b2a9cb5b7775`, rather than the stale local
checkout.

| Grounding surface | Current evidence | C1.5 verdict | Owning follow-through |
|---|---|---|---|
| Rung 1 path root | `rung1-readonly-draft.md` still declares the real-site root as `liye_os/websites/` | **STALE** after Kuachu spin-out | UGE documentation PR |
| Kuachu file paths | Old root is stale; referenced relative files still exist in `sites/kuachu.com` | Grounding object survives; provenance pointer is stale | UGE docs + fixture-comment PR; do not change runtime behavior |
| Zhangxiang file paths | Contact and callback files exist on remote default `master` | Grounding remains valid today, but physical root must change after relocation | UGE docs PR after target path is final |
| UGE fixture comment | `tests/fixtures/kuachu_article.sample.md` names the removed LiYe OS path | **STALE COMMENT** | UGE repo PR |
| UGE runtime dependency | UGE source consumes logical identities, local artifacts, and fixtures; no direct website filesystem import was found | Site relocation does not by itself break UGE execution code | Preserve logical contract; re-run tests after docs/fixture repair |
| Real source wiring | UGE states that real site source wiring and first real end-to-end fact remain outside the repo and pending | **NOT CERTIFIED BY C1.5** | Existing UGE/operator activation track |
| LiYe OS navigation | `CLAUDE.md` still says seven Astro sites reside under `websites/` | **STALE** | C2 SSOT/navigation PR |
| LiYe OS site-deployer/examples | Tracked examples still name the removed Kuachu path | **STALE / NO RUNTIME CLAIM** | Separate consumer-backed documentation/config cleanup |

This audit separates three claims:

1. the semantic identities `kuachu` and `zhangxiang_contact` still exist in UGE;
2. historical grounding files still exist in their source repositories;
3. live end-to-end traffic wiring is a separate, still-uncompleted proof.

None can substitute for the other two.

## 7. C2 handoff

C2 may safely record:

1. `liye_os/websites/` currently holds six site directories: one tracked
   example, four ignored/unversioned live-site sources, and one co-located
   independent repository.
2. Kuachu is already an independent external repository; the old path is gone.
3. The long-term target is zero live business sites physically resident under
   the Layer 0 checkout.
4. Zhangxiang and the four unversioned sites are `MIGRATE_REQUIRED`.
5. `example-site` has no standing exception and is `MIGRATE_REQUIRED`; a real
   consumer may justify only a minimal extracted fixture outside `websites/`.
6. UGE logical contracts survive relocation, but several path/provenance
   references are stale and live source wiring is not certified.
7. The current live-site CI gate is fail-open and cannot be cited as machine
   enforcement.

C2 must not claim:

- any migration other than Kuachu is complete;
- ignored source means undeployed, unused, backed up, or safe to delete;
- historical deployment records prove a current endpoint or user population;
- UGE’s logical adapter tests prove real site traffic wiring;
- the public repository currently blocks live-site additions fail-closed;
- the UGE repository was repaired by C1.5.

## 8. Follow-through sequence

Each item below is a separate PR or operator packet; none is executed by C1.5.

| Order | Packet | Completion condition |
|---|---|---|
| 1 | C2 SSOT/navigation truth-sync | Current topology, fail-open gate, and target dispositions recorded without claiming migrations complete |
| 2 | Repair and exercise `Live Site Gate` | Forbidden fixture is machine-rejected; tool/regex error fails closed |
| 3 | UGE grounding pointer repair | Remote-default docs and fixture comment point to current repo roots; tests remain behaviorally unchanged |
| 4 | Migrate four unversioned sites | One private repo and restore receipt per site; deployment changes separately authorized |
| 5 | Relocate Zhangxiang checkout | Existing history/remote preserved; provider state unchanged; old-path search clean |
| 6 | Resolve `example-site` | Minimal consumer-owned fixture or external grade/archive; no full-site silent exemption |
| 7 | Retire stale website doctrine/pointers | README, constitution, ignore ghosts, and site-deployer examples match final territory |

## 9. Evidence methods and limitations

C1.5 used:

- filesystem enumeration of the canonical LiYe OS checkout and external site
  checkout;
- `git check-ignore`, `git ls-files`, Git-root discovery, status, fetch, commit,
  and remote-default comparisons;
- presence-only checks for provider bindings/configuration;
- GitHub repository and aggregate deployment-record metadata;
- UGE `origin/main` path/code searches and referenced-file existence checks;
- a controlled, local `Live Site Gate` regex probe.

C1.5 did not query provider-wide project lists, registrar/billing accounts,
production logs, customer databases, external-user registries, or live traffic.
Those surfaces remain `UNKNOWN`, not zero.
