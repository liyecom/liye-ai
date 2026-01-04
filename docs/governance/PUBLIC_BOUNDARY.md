# Public Boundary Policy

This repository is the **public OS framework**. It is intentionally designed to be safe to publish.

## What this repository includes (Public)
- **Kernel / Runtime / Governance**
  - executable governance gates (CI)
  - replay / drift / contract verification primitives
- **Public example domain**
  - `domains/skeleton/` + `data/demo/skeleton/`
  - used only for verification and demonstration
- **Documentation**
  - architecture doctrine, constitution, standards, runbooks

## What is intentionally excluded (Private)
The following assets are **not** shipped in this public repository:
- Commercial domains and playbooks (business methodologies, operating knowledge)
- Customer identifiers, customer data, and any production datasets
- API keys, secrets, tokens, and production configurations
- Any domain pack that would enable reconstruction of private operations

## Extension model (How to add domains safely)
Domains are designed as **domain packs** that integrate via stable interfaces.
- Public domains may live in this repo (e.g., `domains/skeleton/`)
- Private domains MUST live outside this repo and must never be referenced by name/URL here
- Production data should be externalized (env / encrypted files / private data sources)

## Enforcement
This boundary is enforced by:
- pre-commit hooks (local)
- CI security gates (gitleaks + blocklist + leak guards)
- architecture hardening gates (SSOT + compliance)
- public replay regression gate (skeleton fixtures)

If you believe an exception is required, document it explicitly and ensure gates are updated accordingly.
