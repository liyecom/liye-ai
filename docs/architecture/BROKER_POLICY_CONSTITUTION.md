# Broker Policy Constitution

> Immutable principles and configurable parameters for LiYe OS Multi-Broker Architecture

## Overview

This document defines the constitutional rules that govern broker behavior in LiYe OS. These rules are divided into two categories:

1. **Immutable Principles**: Fundamental rules that cannot be overridden by configuration
2. **Configurable Parameters**: Settings that can be adjusted via `config/policy.yaml`

---

## Article I: Immutable Safety Principles

These principles are hardcoded and cannot be changed by configuration.

### §1.1 Audit Trail Immutability

> **events.jsonl is append-only and cannot be modified or deleted.**

- All broker actions MUST be logged to events.jsonl
- Past events cannot be altered or removed
- Log corruption triggers system halt
- This ensures complete auditability and reproducibility

### §1.2 Web History Scrape Prohibition

> **Brokers MUST NEVER scrape or sync web chat history.**

Prohibited actions:
- Accessing ChatGPT Web conversation history
- Syncing Gemini Web chat sessions
- Scraping Claude.ai conversation data
- Any automated extraction of web-based AI chat logs

Rationale:
- Protects user privacy
- Prevents platform Terms of Service violations
- Maintains clean separation between CLI and Web interfaces

### §1.3 Cookie/Token Exfiltration Ban

> **Brokers MUST NEVER exfiltrate cookies, tokens, or credentials.**

Prohibited actions:
- Reading browser cookies for AI platforms
- Extracting API keys from environment
- Transmitting authentication tokens
- Storing credentials in outputs/evidence

### §1.4 Fallback Requirement

> **All broker failures MUST produce a manual fallback.**

When a broker is unavailable:
1. Generate MANUAL_PROMPT.md with full context
2. Set mission status to `needs_manual`
3. Log the failure with error_code
4. Never leave a mission in an unrecoverable state

---

## Article II: Approval Policy

### §2.1 Approval Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `none` | No approval required | Read-only operations |
| `semi-auto` | Approve once per mission | Default for most routes |
| `manual` | Approve each action | High-risk operations |

### §2.2 Semi-Auto Approval Semantics

When `approval: semi-auto` is configured:

1. **Initial State**: Mission starts unapproved
2. **Grant Approval**: Run `liye mission approve <dir>`
3. **Scope**: Approval valid for entire mission lifecycle
4. **Expiry**: Approval revoked when mission ends or explicitly revoked
5. **Dangerous Actions**: Always require re-approval (see §2.3)

### §2.3 Dangerous Action Patterns (Reapprove Required)

The following patterns ALWAYS require explicit approval, even in semi-auto mode:

```yaml
reapprove_patterns:
  - "rm -rf"           # Recursive deletion
  - "sudo"             # Privilege escalation
  - "chmod"            # Permission changes
  - "chown"            # Ownership changes
  - "curl .*|.*sh"     # Remote script execution
  - "wget .*|.*sh"     # Remote script execution
  - "git push"         # Code publication
  - "git push --force" # Destructive push
  - "gh auth"          # GitHub authentication
  - "gh repo delete"   # Repository deletion
  - "DROP TABLE"       # Database destruction
  - "DELETE FROM"      # Mass data deletion
  - "TRUNCATE"         # Table truncation
```

### §2.4 Approval State Storage

Approval state is stored in `meta.json`:

```json
{
  "approval": {
    "mode": "semi-auto",
    "granted_at": "2025-12-31T12:00:00.000Z",
    "granted_by": "user",
    "reapprove_patterns": ["rm -rf", "sudo", ...]
  }
}
```

---

## Article III: Sandbox Policy

### §3.1 Default Sandbox Mode

> **Default: read-only**

All brokers operate in read-only mode unless explicitly configured otherwise.

### §3.2 Sandbox Modes

| Mode | Description | Requirements |
|------|-------------|--------------|
| `read-only` | Can only read files | Default |
| `full-access` | Can read and write | Requires approval |
| `none` | No sandboxing | Antigravity only |

### §3.3 Write Allowlist

These paths are always writable regardless of sandbox mode:

```yaml
allowlist_paths:
  - "missions/**"    # Mission outputs
  - "tmp/**"         # Temporary files
  - "outputs/**"     # Deliverables
  - "evidence/**"    # Evidence chain
```

### §3.4 Write Denylist (Immutable)

These paths can NEVER be written, regardless of configuration:

```yaml
denylist_paths:
  - "/etc/**"              # System config
  - "/usr/**"              # System binaries
  - "/System/**"           # macOS system
  - "~/.ssh/**"            # SSH keys
  - "~/.gnupg/**"          # GPG keys
  - "**/.env"              # Environment files
  - "**/credentials.json"  # Credentials
  - "**/secrets.yaml"      # Secrets
```

---

## Article IV: Budget Governance

### §4.1 Default Limits

```yaml
budget:
  max_steps: 30
  max_tokens: 100000
  max_runtime_sec: 900  # 15 minutes
```

### §4.2 Hard Limits (Cannot Be Exceeded)

```yaml
hard_limits:
  max_steps: 500
  max_tokens: 1000000
  max_runtime_sec: 7200  # 2 hours
```

### §4.3 Budget Enforcement

- Soft limits can be increased in mission.yaml
- Hard limits are enforced regardless of configuration
- Exceeding budget triggers graceful termination
- Budget usage logged in events.jsonl

---

## Article V: Model Governance

### §5.1 Default Model

> **Default: gpt-5.2-thinking**

The default model for the `ask` route is `gpt-5.2-thinking`.

### §5.2 Model Alias Mapping

User-intent models may be mapped to actual CLI-supported models:

```yaml
model_alias:
  gpt-5.2-thinking: gpt-5.2   # Mapped for Codex CLI
  gpt-5.2-codex: gpt-5.2
```

### §5.3 Model Mapping Audit

When a model is aliased:
- Original model recorded as `model_requested`
- Actual model recorded as `model_actual`
- Mapping recorded in meta.json and events.jsonl

---

## Article VI: Event Logging

### §6.1 Required Fields

All events MUST include:

```json
{
  "id": "evt_xxx",
  "ts": "ISO timestamp",
  "type": "start|end|artifact|error",
  "broker": "codex|gemini|antigravity|claude",
  "mission_id": "xxx",
  "run_id": "xxx"
}
```

### §6.2 Enhanced Fields (v5.1+)

```json
{
  "route": "ask|build|research|...",
  "approval_mode": "none|semi-auto|manual",
  "sandbox_mode": "read-only|full-access|none",
  "runtime_sec": 123,
  "attempt_count": 1,
  "status": "ok|fail|needs_manual",
  "error_code": "BROKER_NOT_INSTALLED|AUTH_REQUIRED|..."
}
```

### §6.3 Error Codes

| Code | Description |
|------|-------------|
| `BROKER_NOT_INSTALLED` | CLI binary not found |
| `AUTH_REQUIRED` | Broker requires authentication |
| `QUOTA_EXCEEDED` | API rate limit hit |
| `BUDGET_EXCEEDED` | Mission budget exhausted |
| `APPROVAL_DENIED` | User denied approval |
| `SANDBOX_VIOLATION` | Write blocked by sandbox |
| `TIMEOUT` | Execution timeout |
| `NETWORK_ERROR` | Network failure |
| `UNKNOWN` | Unclassified error |

---

## Article VII: Configuration Priority

### §7.1 Priority Order (Highest to Lowest)

1. **CLI Arguments**: `--broker`, `--model`, `--approval`
2. **Mission YAML**: `mission.yaml` in mission directory
3. **Route Config**: `config/brokers.yaml` routes section
4. **Defaults**: `config/brokers.yaml` defaults section
5. **Built-in**: Hardcoded fallback values

### §7.2 Example Resolution

```bash
liye ask "question" --model gpt-5.2-turbo
```

Resolution:
1. CLI specifies `gpt-5.2-turbo` → **Used**
2. routes.ask.model = `gpt-5.2-thinking` → Overridden
3. defaults.model = `gpt-5.2-thinking` → Overridden

---

## Article VIII: Amendments

### §8.1 Amendment Process

Immutable principles (Article I) cannot be amended.

Configurable parameters can be adjusted by:
1. Editing `config/policy.yaml`
2. Setting environment variables
3. Override in mission.yaml

### §8.2 Emergency Override

In case of emergency, constitutional rules can be bypassed by:
1. Creating `config/EMERGENCY_OVERRIDE.yaml`
2. Logging the override to events.jsonl
3. Notifying the user with clear warnings

**Emergency overrides are logged and auditable.**

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-31 | Initial constitution |

---

**Constitutional Authority**: This document governs all broker behavior in LiYe OS v5.1+.

**Enforcement**: Violations are logged to events.jsonl with `error_code: CONSTITUTION_VIOLATION`.
