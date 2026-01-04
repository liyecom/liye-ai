# Domain Migration Playbook

Purpose: safely migrate a commercial/private domain out of the public repository while keeping the public OS framework runnable and verifiable.

## When to migrate (Triggers)
- Domain contains commercial operating knowledge, proprietary methodologies, or customer-specific workflows
- Domain includes or can reconstruct customer identifiers, datasets, or production metrics
- Compliance or security review flags potential leakage risk
- Public release requires a clean boundary (public framework only)

## Target state
- Public repo: Kernel/Runtime/Governance + public skeleton domain + public docs
- Private repo: commercial domain code + knowledge base
- Production data: externalized (env / encrypted local files / private stores)
- CI gates prevent re-introduction of private assets

## Step-by-step procedure

### 1) Freeze & evidence collection
- Create a freeze tag on `main`
- Generate a scope list of files to migrate (paths + keyword hits)
- Backup (bundle or mirror) before destructive history operations

### 2) Extract to private repository
- Create private repo (GitHub)
- Use `git filter-repo` to keep only domain paths and push to private repo
- Ensure private repo can reference public framework via versioned dependency (tag/commit), not via public docs

### 3) Clean the public repository working tree
- Remove domain directories from the public repo
- Replace with skeleton/demo domain if required for runnable verification
- Sanitize public docs (no private repo names/URLs)

### 4) Rewrite history (if required)
- Use `git filter-repo --invert-paths` to remove private paths from history
- Force push rewritten history
- Announce "history rewritten; re-clone required" to collaborators

### 5) Enforcement gates (non-negotiable)
- Add a leak guard that blocks:
  - forbidden code paths
  - customer identifiers
  - API key patterns
  - private repo disclosures (names/URLs)
- Ensure gitleaks + blocklist scans are required checks on `main`
- Ensure public replay regression exists and has stable fixtures (skeleton domain)

### 6) Release process
- Run release DoD (no forbidden identifiers, no tracked runtime artifacts, gates all green)
- Tag & publish release
- Verify documentation remains boundary-compliant

## Acceptance criteria (DoD)
- Public repo contains **no private domain code/knowledge/data**
- All security + architecture + replay gates pass
- `rg` scan returns no forbidden disclosures (except CI pattern definitions)
- Skeleton domain remains runnable for verification/demonstration
