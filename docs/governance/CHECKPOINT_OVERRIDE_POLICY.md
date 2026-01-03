# Checkpoint Override Policy

> Checkpoint freeze enforces responsibility, not correctness.

## Purpose

This policy defines the process for modifying checkpoint-frozen files.
Override is permitted but must be explicit, auditable, and human-authorized.

## What is Frozen

Only two file types are frozen by checkpoint:

1. **Track Spec** (`tracks/<track_id>/spec.md`) - Decision layer
2. **Glossary** (`knowledge/glossary/<domain>.yaml`) - Semantic truth layer

**NOT frozen:**
- `plan.md` (execution layer)
- `workflow.yaml` (runtime layer)
- `experience.yaml` (observation layer)

## Override Process

### Step 1: Create Unfreeze Declaration

Create a new file in `docs/governance/unfreeze/`:

```yaml
# Filename: <track_id>-<date>.yaml
track_id: amz_optimize_ppc_20260101
files:
  - tracks/amz_optimize_ppc_20260101/spec.md
reason: "Requirement changed after stakeholder review"
approved_by: "liye"
approved_at: "2026-01-02"
```

### Step 2: Commit Together

The unfreeze declaration MUST be committed together with the frozen file changes.
CI will fail if changes exist without corresponding declarations.

### Step 3: Audit Trail

All overrides are permanently recorded in git history:
- The unfreeze declaration file
- The associated changes
- The commit author and timestamp

## Rules

| Rule | Description |
|------|-------------|
| No auto-unfreeze | System cannot unfreeze automatically |
| No time-window unfreeze | No "unfreeze for 24 hours" mechanisms |
| No trusted-user bypass | Even admins must create declarations |
| No UI/Webhook/Bot bypass | All changes must go through git + CI |
| One declaration per unfreeze | Cannot modify existing declarations |

## Emergency Override

For genuine emergencies:

1. Create unfreeze declaration with `reason: "EMERGENCY: <description>"`
2. Include `approved_by` with responsible party
3. Commit and push
4. CI will pass with valid declaration

**Note:** "Emergency" is a reason, not a bypass. The declaration requirement still applies.

## Verification

Local verification before push:

```bash
bash tools/audit/verify_checkpoint_freeze.sh
```

## Backward Compatibility

- Tracks without `checkpoint.yaml` are not frozen
- Deleting `checkpoint.yaml` removes freeze (but is auditable)
- Old tracks without checkpoints continue to work normally

---

**Freeze Model:**
- Freeze ≠ permanent
- Freeze = requires explicit unfreeze
- Unfreeze = human responsibility + audit record
