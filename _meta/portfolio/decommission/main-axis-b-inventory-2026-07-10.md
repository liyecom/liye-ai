# Main Axis B Decommission Inventory

- **Status:** C1 evidence inventory — disposition and grade pending
- **Snapshot:** 2026-07-10 (Asia/Shanghai)
- **Decision anchor:** LiYe Systems verdict v1.1, Q3 / S1 / C1
- **Decision artifact:** LiYe Systems architecture verdict v1.1 (2026-07-10),
  SHA-256 `4480f0b85222386ac750047dd38b69c94d02ff8da65d09582e054be83bf1e823` (operator-private)
- **Inventory branch base:** `liye_os origin/main@d86789f653c8`
- **Consumer:** C2 SSOT truth-sync decision packet and later per-asset disposition PRs

## 1. Decision boundary

The standing strategic privilege of Main Axis B has been revoked. This inventory
records the assets and evidence that must be reconciled before any maintenance
exemption or disposition decision.

This document does **not**:

- grade any repository as `reference-grade` or `preservation-grade`;
- declare any deployment, package, renewal, database, or external-user surface
  safe to remove;
- shut down, migrate, archive, transfer, unpublish, or delete anything;
- update `_meta/portfolio/SYSTEMS.md` (that is C2, after this inventory);
- inventory or migrate `liye_os/websites/` (that is C1.5, on a separate track);
- treat one checkout, one Git branch, or a clean/dirty status as the whole
  territory.

Any active endpoint discovered later still requires an operator decision among
`shutdown`, `handoff`, or an explicit `minimal-keep` obligation. `UNKNOWN` means
"not established by the evidence surfaces used in C1"; it never means zero.

## 2. Evidence scope and vocabulary

C1 inspected the five groups named by the current Main Axis B declaration:

```text
silkbay + storefronts + growth-hub + kits + themes
```

The filesystem expands those five registry groups into eleven Git roots:

- `~/github/silkbay`
- `~/github/storefronts/{link-router,sf-brand2,sf-foneyi,sf-refetone,sf-timomats,silkbay-governance,storefront-kit}`
- `~/github/growth-hub`
- `~/github/kits/attribution-kit`
- `~/github/themes`

Evidence levels used below:

- **CONFIRMED** — directly observed in a current Git/API/package-registry surface.
- **DECLARED** — present in tracked configuration or documentation, but not
  proof that the corresponding external resource is live.
- **NOT OBSERVED** — absent from the inspected surfaces; not an absence claim.
- **UNKNOWN** — requires a bounded account-, billing-, database-, or user-plane
  read that C1 did not have or deliberately did not broaden into.
- **PENDING** — reserved for the later operator disposition/grade decision.

Privacy boundary: this inventory records repository/package identifiers and
aggregate deployment evidence only. It does not reproduce customer identifiers,
endpoint URLs, account IDs, credentials, database contents, or external-user
records.

## 3. Executive inventory

| Surface | C1 result | Consequence |
|---|---|---|
| Registry groups | 5 groups expand to 11 Git roots | Disposition cannot be made at the five-row registry level alone. |
| Hosted repositories | 10 private GitHub repositories; all reported non-archived on 2026-07-10 | Hosted does not imply maintained or live; archive decisions remain pending. |
| Local-only repository | `storefronts/link-router` has no remote and has local changes | Irreversible-loss exposure must be resolved before any grade or cleanup. |
| Published packages | `@loudmirror/attribution-kit@0.1.1` and `@loudmirror/storefront-kit@0.3.0` confirmed readable from GitHub Packages | Consumers must be reconciled before package maintenance can be exempted. |
| Themes package | `@loudmirror/themes@0.1.0` is declared locally; registry lookup returned 404 | Do not call it published; file-path consumers still exist. |
| Deployment evidence | GitHub Deployments API returned 3 historical records for `silkbay` and 29 for one storefront; local Vercel bindings exist in both checkouts | Historical records and bindings are not proof of a currently live endpoint. Account-level live-state read remains required. |
| Stateful services | SilkBay tracked Docker configuration declares Medusa, PostgreSQL, Redis, and a persistent volume | Live database/cache instances, ownership, backup, and billing are UNKNOWN. |
| Renewals | No bounded registrar/Vercel/Railway/billing inventory was available in C1 | Domains, plans, databases, and other renewal obligations remain UNKNOWN. |
| External users | No product-user or customer-entitlement source was read | External-user impact remains UNKNOWN for every product-facing root. |
| Grade/disposition | No asset graded or exempted | C2 may record `privilege revoked; grading pending C1 follow-through`, but may not invent a grade. |

## 4. Git-root inventory

Remote metadata was refreshed before inspection. Working-tree divergence is
reported because unpushed commits and uncommitted files are part of the territory,
but C1 did not read them as canonical remote state or modify them.

| Group / Git root | Remote truth | Local checkout snapshot | Runtime / distribution evidence | Grade / disposition |
|---|---|---|---|---|
| `silkbay` | Private, non-archived; default `main` | On `feat/railway-deployment-readiness`, ahead 3, with 12 changed/untracked paths | Local Vercel binding; tracked Docker + Compose; 3 historical GitHub deployments; PostgreSQL/Redis/Medusa declared | **PENDING** — reconcile divergent local work and external live state first |
| `storefronts/link-router` | **No remote** | `master`, 7 changed/untracked paths | Package manifest exists; no tracked deployment declaration observed | **PENDING** — remote/backup and live-router status are prerequisites |
| `storefronts/sf-brand2` | Private, non-archived; default `master` | Clean `feat/kernel-gate` | No local Vercel binding, tracked deploy declaration, or GitHub deployment record observed | **PENDING** |
| `storefronts/sf-foneyi` | Private, non-archived; default `main` | `feat/kernel-gate`, 2 changed/untracked paths | No local Vercel binding, tracked deploy declaration, or GitHub deployment record observed | **PENDING** |
| `storefronts/sf-refetone` | Private, non-archived; default `main` | `feat/kernel-gate`, 2 changed/untracked paths | No local Vercel binding, tracked deploy declaration, or GitHub deployment record observed | **PENDING** |
| `storefronts/sf-timomats` | Private, non-archived; default `main` | `main`, 1 modified path | Local Vercel binding; tracked `vercel.json`; 29 historical GitHub deployments | **PENDING** — live endpoint, renewal, and external-user state required |
| `storefronts/silkbay-governance` | Private, non-archived; default `main` | `main`, 4 untracked paths | Governance repository; no deployment surface observed | **PENDING** — reconcile untracked governance artifacts before grading |
| `storefronts/storefront-kit` | Private, non-archived; default `main` | Clean `main` | Published package `@loudmirror/storefront-kit@0.3.0` | **PENDING** — active consumers confirmed |
| `kits/attribution-kit` | Private, non-archived; default `main` | Clean `main` | Published package `@loudmirror/attribution-kit@0.1.1`; tracked publish workflow | **PENDING** — active consumers confirmed |
| `themes` | Private, non-archived; default `main` | Clean `main` | Package declaration exists; published package not confirmed; cross-repo file-path consumers exist | **PENDING** — consumer and C1.5 coupling must be reconciled |
| `growth-hub` | Private, non-archived; default `main` | Clean `main`, ahead 1 local commit | Remote `main` contains only `.gitignore` and `README.md`; no deployment record/config observed | **PENDING** — evidence is insufficient for either deletion or preservation grade |

### 4.1 Git evidence manifest

These commit anchors preserve the distinction between each inspected checkout
and its refreshed remote default branch.

| Git root | Remote default | Local `HEAD` | Remote-default commit |
|---|---|---|---|
| `silkbay` | `main` | `80be75c4dead` | `0169c3c1a81e` |
| `storefronts/link-router` | none | `4f192f6c2ea7` | none |
| `storefronts/sf-brand2` | `master` | `26635d4e43af` | `b58bfb1366b5` |
| `storefronts/sf-foneyi` | `main` | `9d91cbf53120` | `ecfa031b37a1` |
| `storefronts/sf-refetone` | `main` | `72543d669858` | `5a62aa875117` |
| `storefronts/sf-timomats` | `main` | `affae76808a1` | `affae76808a1` |
| `storefronts/silkbay-governance` | `main` | `a40a9a624bc4` | `7254e7359ac2` |
| `storefronts/storefront-kit` | `main` | `15018b46be49` | `15018b46be49` |
| `kits/attribution-kit` | `main` | `7743a0d1bce6` | `7743a0d1bce6` |
| `themes` | `main` | `81a6f948112d` | `81a6f948112d` |
| `growth-hub` | `main` | `1154e7efbdfb` | `fa367c894d2a` |

### 4.2 Local divergence stop-line

The following surfaces contain unpushed or uncommitted territory and therefore
must not be sealed, archived, or deleted from remote-only evidence:

- `silkbay`: local feature branch commits plus working-tree changes;
- `storefronts/link-router`: no remote plus working-tree changes;
- `storefronts/sf-foneyi`, `sf-refetone`, and `sf-timomats`: working-tree changes;
- `storefronts/silkbay-governance`: untracked governance artifacts;
- `growth-hub`: one local commit ahead of `origin/main`.

Owner reconciliation is required. C1 intentionally did not stash, clean,
commit, copy, or inspect secrets from these worktrees.

## 5. Package and consumer inventory

| Producer | Distribution evidence | Confirmed consumers | Declared but unproven / contradicted edge | Required before disposition |
|---|---|---|---|---|
| `attribution-kit` | GitHub Packages lookup returned `0.1.1` | On remote default branches: `storefront-kit` and four `sf-*` manifests; two storefronts consume the published semver package and two consume the GitHub repository directly | `SYSTEMS.md` declares `growth-hub` as a consumer, but remote `growth-hub/main` has no package manifest or runtime code | Confirm package/repository usage need and decide consumer migration or minimal keep |
| `storefront-kit` | GitHub Packages lookup returned `0.3.0` | On remote default branches: one storefront requests `^0.2.0`, one requests `^0.3.0`, and two use a sibling `file:` dependency; the latter two local package manifests have additional uncommitted divergence | `SYSTEMS.md` describes an API dependency on SilkBay, but C1 did not execute or probe that API | Reconcile distribution modes and supported versions, then establish whether any storefront is currently deployed |
| `themes` | Local manifest declares `@loudmirror/themes@0.1.0`; registry lookup returned 404 | `sites/kuachu.com` imports `@themes` by filesystem alias; `liye_os` builder/example assets also declare this integration | `SYSTEMS.md` declares storefronts downstream, while inspected storefronts primarily contain repo-local theme modules rather than the cross-repo package | Coordinate with C1.5; do not remove the filesystem contract before consumers are migrated or explicitly exempted |
| `silkbay` Store API | Tracked source/config and downstream client package declarations exist | `storefront-kit` is the declared client layer | Current live API endpoint and live caller traffic are UNKNOWN | Bounded endpoint/read-log probe before shutdown/handoff/minimal-keep choice |
| `link-router` | Local Git root and registry/source changes exist | `growth-hub` documentation and UGE/website architecture declare routing use | No remote; live registry deployment and caller traffic are UNKNOWN | Establish backup/remote and bounded runtime consumer evidence |

Package-list API enumeration could not be used because the current GitHub token
lacks `read:packages`; direct version lookups for the three named packages were
used instead. This limits C1 to known package names and must not be read as a
complete account package inventory.

## 6. Deployment, renewal, state, and user ledger

| Asset surface | Deployment | Renewal / billing | Stateful data | External users | Evidence needed next |
|---|---|---|---|---|---|
| SilkBay backend | Historical GitHub deployment records + local binding; current live status **UNKNOWN** | **UNKNOWN** | PostgreSQL/Redis declared; live instances and backups **UNKNOWN** | **UNKNOWN** | Project-scoped platform read, DB ownership/backup receipt, bounded user-impact read |
| Storefront with tracked Vercel config | Historical GitHub deployment records + local binding; current live status **UNKNOWN** | Domain/Vercel plan **UNKNOWN** | No server DB established by C1 | **UNKNOWN** | Project-scoped Vercel/domain read and external-user/traffic evidence |
| Other storefront roots | No deployment evidence observed in inspected Git/GitHub surfaces | **UNKNOWN** | **UNKNOWN** | **UNKNOWN** | Per-repo deploy/provider lookup; do not infer absence from zero GitHub deployments |
| Link Router | No deploy declaration observed; current live status **UNKNOWN** | Domain/hosting **UNKNOWN** | Local registry exists; production registry state **UNKNOWN** | Caller set **UNKNOWN** | Remote/backup first, then bounded deployment and caller probe |
| Published packages | Package versions confirmed | Package hosting cost/retention policy **UNKNOWN** | Registry artifacts exist | External package consumers beyond known repos **UNKNOWN** | `read:packages` inventory or package-owner receipt; dependency search across known repos |
| Growth Hub | No runtime/deploy surface observed on remote `main`; current live status **UNKNOWN** | Domain/hosting **UNKNOWN** | None established by C1 | **UNKNOWN** | Domain/deploy lookup and owner confirmation |
| Themes | Cross-repo filesystem consumption confirmed; package publication not confirmed | **UNKNOWN** | Source assets in Git | Consumer set incomplete until C1.5 | C1.5 website inventory and builder consumer readback |

Zero GitHub deployment records or an absent local provider binding is only
`NOT OBSERVED`. GitHub/Vercel integration modes can bypass these surfaces, and
local bindings can remain after a deployment has been removed.

## 7. C2 handoff: facts allowed into SSOT

C2 may safely record:

1. Main Axis B standing strategic privilege is revoked.
2. Its five registry groups resolve to eleven Git roots in this snapshot.
3. All per-repository grades and endpoint dispositions remain `PENDING`.
4. Two packages have confirmed published versions and confirmed repository
   consumers.
5. At least one Main Axis B root is local-only and several roots contain local
   divergence that remote inventory does not capture.
6. Deployment, renewal, stateful-data, and external-user coverage is incomplete;
   no maintenance exemption follows from C1 alone.

C2 must not pre-write:

- `reference-grade` or `preservation-grade` for any repository;
- "no deployments", "no users", "no renewals", or "safe to delete";
- a repaired dependency graph where C1 found only a declared edge;
- any websites/grounding disposition owned by C1.5.

## 8. Follow-through decision queue

Each item below is a separate, bounded follow-through packet. None is authorized
by this inventory alone.

| Priority | Packet | Consumer / completion condition |
|---|---|---|
| 1 | Reconcile local-only and divergent Git territory | Operator can account for every unpushed/uncommitted asset before grading |
| 2 | Project-scoped deployment and renewal read | Every candidate live endpoint has current provider, billing, domain, and owner evidence |
| 3 | Stateful-resource and backup read | Every SilkBay DB/cache/storage dependency has owner, backup, retention, and shutdown impact evidence |
| 4 | Package-owner inventory | Published packages and all known consumers are enumerated; keep/migrate/unpublish decision can be made safely |
| 5 | External-user impact read | Product-facing roots have a bounded user/customer impact statement without exposing identities in the portfolio record |
| 6 | Per-root grading packet | Operator chooses reference-grade, preservation-grade, shutdown, handoff, or explicit minimal keep |

## 9. Evidence commands and limitations

The inventory used read-only or metadata-refresh operations only:

- `find ... -name .git` across every declared Main Axis B checkout;
- `git fetch`, `git status`, `git log`, `git ls-files`, `git ls-tree`, and
  `git grep` for each discovered root;
- GitHub repository metadata and deployment APIs;
- selected, non-secret `package.json` fields;
- direct package version lookups against GitHub Packages;
- presence-only checks for local provider bindings (binding identifiers were
  not copied into this document).

No customer database, registrar account, billing account, production logs,
provider-wide project listing, or external-user registry was queried. Those
surfaces remain explicit unknowns rather than inferred zeros.
