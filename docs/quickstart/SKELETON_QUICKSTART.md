# Skeleton Quickstart

This quickstart verifies that **LiYe OS Core** can run end-to-end with the `skeleton` domain,
and that the governance primitives (World Model Gate, Decision Contract, Trace) are wired.

## What you will get
- Run the `skeleton` domain in **dry-run** mode
- Validate a **Decision Contract**
- Generate a **Trace** example
- Confirm the repository's **governance gates** are in place (CI required checks)

---

## Prerequisites
- Python 3.11+ (recommended)
- `pip` available

> Note: This quickstart uses **no external API keys** and **no private data**.

---

## 1) Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U pip
```

If the repo includes a requirements file, install it:

```bash
# If exists:
# pip install -r requirements.txt
```

## 2) Run Skeleton Domain (Dry Run)

```bash
python src/domain/skeleton/main.py --dry-run
```

Expected:
- World Model Gate is invoked
- Execution runs without calling any external services

## 3) Validate the Decision Contract

Contract example:
```
src/domain/skeleton/contracts/decision.contract.yaml
```

Run validation (if a validator exists in repo):

```bash
# Example (adjust to actual validator command in repo):
# python -m src.kernel.contracts.validate src/domain/skeleton/contracts/decision.contract.yaml
```

Expected:
- Contract validates successfully

## 4) Inspect Trace Example

Trace example:
```
src/domain/skeleton/traces/trace.example.json
```

This file demonstrates the minimum trace shape expected by governance.

## 5) Repository Governance (FYI)

Main branch requires these checks before merge:

- gitleaks scan
- blocklist scan
- Block Amazon Asset Leakage
- Enforce SSOT Rules
- Trace Governance Checks
- governance-review

---

## Troubleshooting

### A) Missing dependencies

Install project requirements and retry.

### B) Dry run fails

Confirm that `src/domain/skeleton/` exists and the entrypoint path is correct.

### C) Contract validation command not found

The contract schema may be validated in CI only; reference the governance docs.
