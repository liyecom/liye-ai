# Unfreeze Declarations

This directory contains explicit unfreeze declarations for checkpoint-frozen files.

## Rules

1. Each unfreeze declaration must be a separate YAML file
2. Filename format: `<track_id>-<date>.yaml`
3. All required fields must be present (see UNFREEZE_SCHEMA.md)
4. Declarations cannot be modified after creation
5. New file required for each unfreeze request

## Example

See `example.yaml.disabled` for format reference.

---

**Freeze enforces responsibility, not correctness.**
