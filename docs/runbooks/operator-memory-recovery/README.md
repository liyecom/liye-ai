# Operator Memory Versioning and Recovery Baseline v0.1

> **Status:** `DESIGN_ONLY` · `BACKUP_NOT_ACTIVATED` · `RESTORE_NOT_RUN` · `RECOVERY_NOT_CERTIFIED`
>
> **SSOT:** `docs/runbooks/operator-memory-recovery/README.md`
>
> **Observed at:** `2026-07-12T12:58:40Z`
>
> **Repository snapshot:** `origin/main@9b8173087b8b6ce2160ed0e13a583bbde6537e44`
>
> **Scope:** C11 — the operator memory infrastructure, local operational ledgers,
> and the minimum configuration needed to interpret or restore them. This document
> is a strategy and recovery procedure. It is not authority to copy data, install a
> backup tool, configure a destination, stop a writer, schedule a job, or restore
> into live state.

## 0. Consumer, SLA, and claim boundary

| Field | Contract |
|---|---|
| Named consumers | Operator-approved backup activation packet; isolated restore drill; incident recovery; continuity/dead-man planning; any later claim that operator memory is versioned or recoverable |
| Consumption SLA | An activation or backend/profile change must bind this runbook to an immutable commit **before** the flip. An incident must read it before any live restore. A drill or incident receipt must be sealed within 24 hours after the attempt ends. |
| Review triggers | source-set change; memory format or writer change; backup backend/key/cadence change; credential or host-boundary change; integrity failure; missed snapshot; restore failure; machine-loss incident or near miss; any proposed recoverability claim |
| Retirement condition | A superseding runbook provides at least the same source classification, application-consistent snapshot rules, isolated restore discipline, unsafe receipt defaults, and pointers to prior receipts. |
| Receipt owner | The operator who opens the activation/drill envelope, or a named restricted operator acting inside that envelope. Failures and aborts remain evidence and are never rewritten as `NOT_RUN`. |

There is no standing activation deadline in this document. Until an operator
opens a separate activation envelope and an isolated restore readback passes,
the correct portfolio statement is:

> The five-stage architecture review reached a delivery closeout. Operator
> memory versioning and disaster recovery have **not** reached closeout.

Merging this runbook does not change that statement.

## 1. Why C11 exists

C11 is a `risk-pull` response to a named hazard: a single-machine loss can
remove several sources of operator memory and operational truth at once. The
loss script includes doctrine context, curated operating knowledge, local
ledgers, and machine-bound state needed to interpret prior actions. Rebuilding
those sources from public repositories is not currently proven possible.

Memory work remains split in two:

- **Infrastructure** — versioning, backup, retention, truncation governance,
  integrity, and restore testing are incurred debt and should become boring,
  deterministic infrastructure.
- **Content curation** — deciding what belongs in memory, what is obsolete, and
  what should be promoted into doctrine remains operator-supervised work.

This runbook automates neither curation nor authority. A backup mechanism may
preserve operator decisions; it may not create, rewrite, promote, or delete them.

## 2. Evidence language

| State | Meaning |
|---|---|
| `OBSERVED` | Read-only inspection established the stated property at the snapshot time. |
| `DECLARED` | A document or configuration states the property; runtime behavior was not independently proven. |
| `NOT_OBSERVED` | The named inspection did not find the property. It never means impossible or permanently absent. |
| `UNKNOWN` | Available evidence cannot decide the field. |
| `NOT_RUN` | The activation, snapshot, or restore step did not start. |
| `BLOCKED` | An entry gate was missing, so the governed step did not start. |
| `PASS` | Every criterion for the bounded step was met and read back. |
| `FAIL` | The step ran but a required criterion failed. |
| `ABORTED` | A stop condition fired after start; preserve the partial evidence. |
| `NOT_CERTIFIED` | No valid claim exists for that dimension. |

Do not use `mostly backed up`, `recoverable in principle`, `local copy`, or
`Git-protected` as substitutes for a bounded result. FileVault, a Git commit on
the same machine, an operating-system update snapshot, or a successful backup
command without restore readback does not prove disaster recovery.

## 3. Sanitized current-state inventory

The public record uses logical source IDs and aggregate facts. Exact local
paths, private artifact names, host identity, customer information, credential
material, and raw listings remain in an operator-private activation inventory.

| ID | Logical source | Current evidence | Current verdict |
|---|---|---|---|
| `M1` | Claude project memory roots | Five roots; 296 files; about 2.5 MiB; no root is versioned | `UNVERSIONED`; single-machine hazard confirmed |
| `M2` | Codex memory root | 203 files; about 2.3 MiB; one clean local Git baseline; no remote | Local change history has begun; independent copy `NOT_OBSERVED` |
| `M3` | Claude-mem structured and vector state | 36 files; about 3.36 GiB; live worker and active SQLite WAL observed; no Git or independent backup observed | Application-consistent snapshot required; blind file copy forbidden |
| `M4` | Operator playbook | Seven files; about 100 KiB; no Git | `UNVERSIONED`; content is not proven reconstructable |
| `M5` | Local operational ledgers | 54 files; about 236 KiB; no Git | `UNVERSIONED`; several ledgers are not derivable from repository history |
| `M6` | Operator settings and hook surface | Mixed private configuration and generated/plugin material; sensitive values may be present; provenance is not fully classified | Inclusion set `UNKNOWN`; bulk copy forbidden pending classification |
| `M7` | Operator-designated private additions | Exact membership is intentionally absent from the public inventory | `UNKNOWN` until enumerated in the encrypted private source profile |
| `B1` | Host backup posture | Local at-rest protection is observed; no independent backup destination or supported backup CLI was observed | Independent backup `NOT_OBSERVED` |

Current local permissions are not a certification. Several memory trees and
their files are group/world-readable under ordinary local modes. Actual mode
remediation is outside this PR; activation must make private restore roots
`0700` and sensitive restored files `0600`, then record readback.

### 3.1 Time-dimension correction

The architecture-review snapshot previously recorded one memory index at
81.5% of an assumed truncation ceiling. At this C11 snapshot that same logical
index is 50 lines, and the largest observed project index is 136 lines. The old
percentage is therefore historical evidence, not a current incident.

This does **not** remove truncation governance. It changes the honest rule:

- no fixed ceiling is claimed until the writer's actual limit is pinned;
- line count alone does not prove semantic capacity or safety;
- rapid growth, writer truncation, failed compaction, or a format-limit change
  is a review trigger;
- before pruning or compaction, preserve a versioned pre-change snapshot and
  require operator curation of the replacement.

### 3.2 Drift already observed

The Codex memory root gained a local Git baseline after the architecture verdict
was written. C11 records the improvement without upgrading it to disaster
recovery: a history stored on the same disk fails with that disk. Every later
inventory must inspect the filesystem and writer state again; it may not infer
current posture from this repository's clean status.

## 4. Source classes and disposition rules

### 4.1 Class A — irreconstructable curated truth

Examples: curated project memory, operator playbook, operational ledgers, and
private decision artifacts.

Requirements:

- version history where the format is text-friendly;
- encrypted, independent snapshots;
- deletion/retention semantics declared before activation;
- no content rewrite by the backup mechanism;
- isolated restore readback before any recoverability claim.

### 4.2 Class B — application-managed databases

Examples: structured memory databases and vector stores.

Requirements:

- identify the authoritative database and whether derivative indexes can be
  rebuilt;
- quiesce the writer or use a database-native online backup/snapshot API;
- capture matching WAL/sidecar state only through a documented consistent
  method;
- never use a plain recursive copy of a live SQLite database as evidence;
- run format-specific integrity/readback in the isolated restore.

A vector index may be excluded as reconstructable only after a restore drill
proves deterministic rebuild from the authoritative snapshot. Until then it is
part of the protected set.

### 4.3 Class C — configuration required for interpretation

Examples: selected settings, source registration, and unique operator hooks.

Requirements:

- classify each item as unique, reconstructable, generated, or secret-bearing;
- include only the minimum unique configuration needed to interpret or restart
  the memory system;
- keep secret values out of public manifests and receipts;
- preserve permission metadata and restore sensitive files at `0600`.

An unclassified settings tree is not eligible for bulk inclusion.

### 4.4 Class D — reconstructable implementation and cache

Examples: plugin caches, downloaded dependencies, build output, logs without an
audit-retention obligation, and regenerated indexes once rebuild is proven.

Default: exclude. Record the reconstruction source/version instead of paying to
preserve mutable cache indefinitely.

### 4.5 Class E — credentials and recovery keys

Credentials, Keychain entries, API tokens, and backup encryption keys are not
ordinary memory content. They require a separate credential escrow/rotation
design. C11 must not export them into the data backup, public receipt, Git
history, or a manifest hash that enables offline guessing.

The backup decryption key must not exist only on the protected machine or only
inside the backup it decrypts. Establishing escrow is an explicit operator flip.

## 5. Minimum backup contract

The activation packet may choose a product or implementation only if it meets
all of these properties:

1. **Independent failure domain:** the protected copy is not only another path,
   partition, local snapshot, or local Git object on the same machine.
2. **Encryption:** data is encrypted before or at the destination; access is
   least-privilege and scoped to the declared backup set.
3. **Versioned retention:** prior good states survive accidental overwrite,
   corruption, and a bad writer run. Retention and deletion are declared.
4. **Application consistency:** active databases use a quiesced or native
   snapshot method. Success of a filesystem copy is insufficient.
5. **Manifest and receipt:** every snapshot has an opaque ID, UTC anchors,
   source/profile version, item counts, byte counts, integrity result, and
   uncovered items. No secret or private path is published.
6. **Isolated restore:** restoration lands in a new private root with no
   symlink, hardlink, mount overlay, or write-through path to live state.
7. **Readback:** content, history, permissions, and application-format checks
   pass before `restore_verified` may become true.
8. **No standing runtime privilege:** a scheduler or resident component needs
   a separate demand-pull/risk-pull packet. A bounded invoked job remains a
   tool; this runbook does not create one.

No backup backend is selected here. At this snapshot no supported backup CLI or
independent destination was observed. Installing software, creating an account,
setting a destination, generating a key, or scheduling a job is activation work.

## 6. Activation packet — required before the first copy

The operator-private activation packet must bind:

- this runbook's immutable commit;
- one opaque activation ID and a UTC validity window;
- owner, abort owner, and any restricted operator envelope;
- the exact logical source set and explicit exclusions;
- source class, writer, quiesce/native-snapshot method, and restart/readback for
  every included database;
- backend and independent-failure-domain evidence;
- encryption/key-custody and revocation design;
- retention, deletion, cadence, proposed RPO, and proposed RTO;
- source and destination byte budgets;
- stop conditions and rollback path;
- the isolated restore target and drill window;
- public-redaction policy and operator-private evidence location.

RPO and RTO are deliberately unset in this baseline. They must be chosen from
observed source mutation rates, continuity consequences, and measured restore
time—not architecture aesthetics. Before the first successful drill they remain
`NOT_CERTIFIED`, even if the activation packet names targets.

Entry fails closed when any included source is `UNKNOWN`, a live database lacks
a consistent snapshot method, key custody has one-machine circularity, the
destination shares the source failure domain, or the restore target can touch
live state.

## 7. Governed snapshot procedure

This section is a procedure template, not a command packet.

### 7.1 Preflight

1. Confirm a separate operator flip authorizes the activation or snapshot ID.
2. Re-inventory source existence, writer status, sizes, free space, modes, and
   symlinks. Do not reuse C11 counts as live truth.
3. Verify the private profile and exclusion set hashes against the activation
   packet.
4. Verify destination reachability, encryption, retention, and available quota
   without writing protected content.
5. Confirm abort owner, stop conditions, quiesce budget, and restart/readback.
6. Record `started_at_utc` only after every gate passes. Otherwise seal
   `BLOCKED`; do not improvise missing fields.

### 7.2 Capture

1. For ordinary file trees, capture metadata and a deterministic private
   manifest, then snapshot through the selected encrypted tool.
2. For local Git state, preserve a verified bundle or equivalent object-complete
   representation in the independent destination. A public remote is forbidden.
3. For application-managed databases, invoke the pre-registered quiesce or
   native backup method. Never infer consistency from exit code alone.
4. If a writer was paused, restart it within the declared budget and execute
   the pre-registered health/readback before proceeding.
5. Seal snapshot ID, profile hash, counts, bytes, duration, integrity outcome,
   and uncovered items. Do not log content, private paths, or secret values.

### 7.3 Snapshot pass criteria

The snapshot step is `PASS` only when:

- every declared source is captured or explicitly excluded by the sealed
  profile;
- every active database used its declared consistency method;
- destination-side manifest/integrity verification succeeds;
- any quiesced writer is healthy after restart;
- no private content appears in the public evidence stream;
- rollback/cleanup readback succeeds;
- a receipt is sealed with no unresolved critical uncovered item.

`snapshot_pass=true` does not certify recovery. It only permits the isolated
restore drill to begin under its own authorization.

## 8. Isolated restore drill

### 8.1 Isolation gates

Before restore, verify:

- a separate drill envelope names the snapshot, actor, UTC window, byte/time
  budgets, abort owner, and cleanup policy;
- the restore root is newly created, mode `0700`, outside every live source,
  repository, sync root, scheduler input, and application search path;
- no symlink, hardlink, bind/overlay mount, environment variable, or service
  registration connects the restore root to live state;
- network access is disabled unless a named format verification requires it;
- starting a restored service is forbidden unless separately authorized and
  bound to loopback plus synthetic inputs.

Any failed isolation check yields `BLOCKED` before data extraction.

### 8.2 Restore and verify

1. Restore the sealed snapshot into the isolated root only.
2. Verify manifest completeness, hashes, item/byte counts, permission policy,
   and version history.
3. Open text/Git sources read-only and prove that a pre-registered set of opaque
   sentinels/history anchors resolves without publishing their values.
4. Run database integrity checks against the restored copies. If a vector index
   is declared reconstructable, rebuild it from the restored authority and
   compare the pre-registered semantic/count checks.
5. Exercise the minimum documented interpretation path: locate the latest
   curated memory, follow its pointers, and identify the matching ledger and
   playbook state without model assistance being required.
6. Record elapsed time, failures, uncovered items, and measured—not estimated—
   restore timing.
7. Seal evidence, then securely remove or retain the isolated root according to
   the drill envelope. Cleanup must not erase the receipt.

### 8.3 Restore pass criteria

The bounded restore is `PASS` only when:

- the selected snapshot is independently readable after source access is
  removed or credibly simulated unavailable;
- all required sources and history anchors verify;
- application-format integrity checks pass;
- restored private modes meet policy;
- the minimum interpretation path completes from the restored artifacts;
- no live state changes and isolation remains intact through cleanup;
- the receipt has no unresolved critical uncovered item.

Only then may the receipt set `restore_verified: true` for the exact source set,
snapshot method, backend, and drill environment. It does not certify undeclared
sources, future snapshots, credential escrow, dead-man wind-down, 30-day
continuity, or customer-cell recovery.

## 9. Stop conditions and rollback

Stop and record `ABORTED` when any of these occurs after start:

- a live path, writer, database, repository, scheduler, or customer surface is
  mutated outside the envelope;
- a database snapshot method differs from the sealed method or consistency is
  uncertain;
- a secret, private path, customer identifier, or raw memory content enters a
  public log, PR, issue, or receipt;
- destination encryption, retention, integrity, quota, or failure-domain
  evidence becomes false or unknown;
- source/destination bytes or quiesce/time budget exceed the envelope;
- writer restart/readback fails;
- restore isolation cannot be proven or a restored process can reach live state;
- the operator cannot identify the correct kill/cleanup path.

Rollback for an activation defaults to disabling the schedule/tool, revoking
its destination credential, preserving the last known-good encrypted snapshot,
and restoring the previous sealed profile. Do not delete the only known-good
snapshot as part of rollback. Live content restoration requires a new incident
envelope; it is never an automatic rollback side effect.

## 10. Receipt template — unsafe defaults

The operator-private receipt may contain sealed evidence references. A public
receipt, if needed, copies only the redacted structural fields below.

```yaml
schema_version: operator-memory-recovery-receipt.v0
operation_id: null
operation_kind: NOT_RUN # ACTIVATION | SNAPSHOT | RESTORE_DRILL | INCIDENT_RESTORE
runbook_commit: null
started_at_utc: null
ended_at_utc: null
actor_envelope_ref: null

source_profile:
  opaque_profile_id: null
  profile_sha256: null
  logical_source_ids: []
  source_count: 0
  uncovered_items: []

snapshot:
  backend_class: null
  independent_failure_domain_verified: false
  encryption_verified: false
  retention_verified: false
  application_consistency_verified: false
  manifest_verified: false
  snapshot_pass: false

restore:
  attempted: false
  isolated_root_verified: false
  manifest_verified: false
  history_verified: false
  database_integrity_verified: false
  private_modes_verified: false
  interpretation_path_verified: false
  live_state_unchanged: false
  restore_verified: false

claims:
  local_versioning: NOT_CERTIFIED
  independent_backup: NOT_CERTIFIED
  disaster_recovery: NOT_CERTIFIED
  rpo: NOT_CERTIFIED
  rto: NOT_CERTIFIED
  credential_escrow: NOT_CERTIFIED
  dead_man_wind_down: NOT_CERTIFIED
  thirty_day_continuity: NOT_CERTIFIED

verdict: NOT_RUN
stop_condition: null
failures: []
remediation_refs: []
supersedes_receipt: null
```

No field becomes true because a tool printed success. Every true value needs a
corresponding readback in the sealed evidence. Unknown or missing evidence
remains false / `NOT_CERTIFIED`.

## 11. Evidence and privacy rules

Raw inventories, manifests, filenames, database metadata, and restore evidence
remain operator-private. Public documents and receipts contain only:

- logical source IDs and aggregate counts/bytes;
- public runbook commit;
- opaque profile/snapshot/operation IDs safe to disclose;
- UTC anchors, outcome, duration, and bounded claim states;
- non-sensitive evidence hashes when disclosure does not reveal the existence
  of a private named artifact;
- failures, uncovered-item classes, and remediation references after redaction.

They must not contain:

- private absolute paths, host identity, account or repository owner;
- private artifact filename pointers or raw directory listings;
- customer/store/product identifiers or production topology;
- credentials, tokens, recovery keys, reversible fingerprints, or secret-bearing
  configuration excerpts;
- memory content, prompts, transcripts, ledger rows, or database queries/results.

The private activation inventory is not committed to this public repository.
Its hash may be recorded only when the artifact's existence and fingerprint are
safe to disclose.

## 12. Closeout sequence

C11 closes in gates, not in one merge:

1. **Strategy gate:** merge this docs-only PR through worktree → PR → operator
   merge. Result: strategy exists; every recovery claim remains `NOT_CERTIFIED`.
2. **Activation gate:** operator approves a private source profile, backend,
   key custody, retention, cadence, RPO/RTO targets, and rollback. Result:
   backup may run; recovery remains `NOT_CERTIFIED`.
3. **Snapshot gate:** capture and verify an application-consistent independent
   snapshot. Result: bounded backup evidence exists; recovery remains
   `NOT_CERTIFIED`.
4. **Restore gate:** independently authorize and pass the isolated restore
   drill. Result: the exact tested source/profile/backend combination may be
   recorded as recoverable, with measured timing and explicit exclusions.
5. **Lifecycle gate:** consume this runbook again on every §0 review trigger.
   Re-certification is event-driven unless the activation packet declares a
   separate calendar SLA.

C8 no-AI/hands-off evidence does not certify C11 memory recovery, and C11 does
not retroactively certify C8. A future combined ceremony may share a runbook
artifact only if both claim sets retain their own entry gates and receipts.

## Appendix A — C11 readback and authority

- The inventory was read-only. No memory content was queried or copied.
- No writer, worker, database, launchd job, settings file, permission, backup
  destination, credential, or live source was changed.
- The active database integrity state is `NOT_CERTIFIED`; C11 did not stop the
  writer or pretend an immutable read of a live WAL database was authoritative.
- No backup product, resident runtime, shared chassis, schema validator, or
  scheduler is introduced.
- No customer identifier, private path, private artifact filename, secret value,
  or operator-private topology is published.
- Operator merge is required before this baseline becomes repository evidence.
