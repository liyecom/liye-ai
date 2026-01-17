# Skill Sources (Global Inventory)

This document defines all Skill sources observed by SFC in LiYe OS.

## Source Buckets

### 1) Internal Repo Skills (Editable)
- Path: `~/github/liye_os/Skills/**`
- Policy: MUST comply with SFC v0.1
- Action: Patchable + PR-able

### 2) External Plugin Skills (Read-only)
- Path: `~/.claude/skills/**`
- Policy: Observe + lock versions only (do NOT patch in place)
- Action: If customization needed, mirror into liye_os then patch

### 3) Peer Repo Skills (Editable, Separate Product Line)
- Example: `~/github/amazon-growth-engine/**`
- Policy: Separate sweep + separate debt pool + separate PR in that repo
- Action: Patch inside its own repo only
