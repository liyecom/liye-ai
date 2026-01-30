# command: meta/context-audit

## Purpose
Audit and declare the current Claude Code context mounts and execution boundaries.

This command exists to prevent silent overreach when multiple directories
are mounted via `/add-dir`.

## Execution Steps
1. List all currently accessible root directories
2. For each directory:
   - Path
   - Intended role (governance / engine / runtime / temp)
3. Identify potential risks:
   - Overlapping scopes
   - Duplicate filenames across roots
4. Ask the user to confirm or restrict scope

## Output Contract
Claude MUST output:

### Context Mounts
- Path
- Role
- Allowed actions (read / analyze / edit)

### Risk Notes
- Any ambiguity or overlap detected

### Declared Execution Boundary
A clear statement of:
> "I will only operate within the following directories unless explicitly instructed otherwise."

## Stop Rules
- If context scope is unclear → STOP
- If user refuses to confirm boundary → STOP

## Notes
This command does NOT modify any files.
It only establishes execution safety for the session.
