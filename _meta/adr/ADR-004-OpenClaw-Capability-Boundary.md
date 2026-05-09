# ADR-004: OpenClaw Capability Boundary -- 插件主权模型与安全审计

**Status**: Superseded
**Date**: 2026-04-14
**Superseded-Date**: 2026-04-17
**Superseded-By**: `_meta/adr/ADR-OpenClaw-Capability-Boundary.md`
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-004-OpenClaw-Capability-Boundary.md`

> Historical draft. Superseded by `ADR-OpenClaw-Capability-Boundary.md` on 2026-04-17. Retained for audit/history only.

## Context

SYSTEMS.md 进化路线 P1 要求产出 4 份 Capability Harvest ADR，每份必须附最小 contract 草图。
本 ADR 聚焦 OpenClaw 生态（`openclaw-skillgate` 仓库 + `src/gateway/openclaw/` 网关层）的三个关键 pattern：

1. **插件主权边界** -- Skill 作为独立所有权单元，通过 manifest 声明能力而非源码耦合
2. **供应链安全审计** -- 三层发现 + 规则扫描 + combo 评分 + 隔离/恢复闭环
3. **治理通信协议** -- Gate/Enforce/Route/Execute/Verdict 五阶段管线 + HMAC 鉴权

LiYe OS 当前已有 `CapabilityContract`（7 字段冻结）、`CapabilityRegistry`、`ExecutionPolicy` 等控制面原语（`src/control/`），
但缺少：
- Skill/Plugin 级别的供应链安全审计机制
- 能力注册时的自动化威胁扫描
- 隔离/恢复操作的 evidence 闭环

本 ADR 明确从 OpenClaw 生态吸收哪些 pattern、拒绝哪些，并给出 LiYe Systems 自有实现的 contract 草图。

## 上游核心做法

### 1. 三层 Skill 发现 (Three-Layer Discovery)

`/Users/liye/github/openclaw-skillgate/src/core/discover.ts` 实现了三层扫描源：

| 层 | Source | 路径 | 含义 |
|---|--------|------|------|
| workspace | 当前工作目录 | `process.cwd()` | 项目本地 skill |
| managed | 全局安装目录 | `~/.openclaw/skills` | 用户级 skill |
| extraDirs | 配置文件中声明 | `~/.openclaw/openclaw.json → skills.dirs[]` | 外挂目录 |

Skill 识别标记文件：`skill.json`, `skill.yaml`, `package.json`, `openclaw.skill.json`。
SkillKey 优先级：`metadata.openclaw.skillKey > metadata.name > 目录名`。

### 2. 插件清单 (Plugin Manifest)

`/Users/liye/github/openclaw-skillgate/openclaw.plugin.json` 定义了插件元数据契约：
- `commands` -- 命令注册表，声明每个 slash command 的 usage、requiresAuth
- `hooks.onSkillInstall` -- 生命周期钩子，安装时自动触发扫描
- `config` -- 声明配置路径和默认策略（`conservative`）

### 3. 规则引擎 + Combo 评分

`/Users/liye/github/openclaw-skillgate/src/core/scan.ts` 定义 17 条扫描规则，分 4 级：
- CRITICAL (5): `curl|bash`, `wget|sh`, `base64|sh`, `rm -rf /`, `eval(fetch())`
- HIGH (5): download-execute, env-exfiltration, hardcoded-token, shell-spawn-untrusted, install-download
- MEDIUM (4): dynamic-require, fs-write-root, network-listener, obfuscated-code
- LOW (3): shell-exec, network-request, file-system-access

`/Users/liye/github/openclaw-skillgate/src/core/decision.ts` 实现 combo 叠加机制：
- 5 个 combo 定义（supply-chain-attack, obfuscated-execution, credential-theft, destructive-payload, install-hook-risky）
- 单条 finding 按 severity 加权（CRITICAL=100, HIGH=50, MEDIUM=20, LOW=5）
- Combo 触发时额外加分（40-100），最终 score 决定 RiskLevel 和 RecommendedAction

### 4. Fail-Closed 鉴权

`/Users/liye/github/openclaw-skillgate/src/core/authz.ts`:
- 所有写操作（quarantine/restore/allow/disable）必须显式用户确认
- 非交互模式 (`!process.stdin.isTTY`) 一律拒绝 -- fail-closed
- 30 秒超时自动拒绝

### 5. Evidence 不落明文

`/Users/liye/github/openclaw-skillgate/src/core/redaction.ts`:
- 所有 finding snippet 只存 `sha256:hash`，不存原文
- 9 类敏感模式检测（API key, AWS cred, private key, connection string, email, IP, credential URL）

### 6. 治理通信管线 (LiYe Gateway 已有实现)

`/Users/liye/github/liye_os/src/gateway/openclaw/job_runner.ts` 实现五阶段管线：
```
Gate(0-10%) -> Enforce(10-20%) -> Route(20-30%) -> Execute(30-90%) -> Verdict(90-100%)
```

`/Users/liye/github/liye_os/src/gateway/openclaw/types.ts` 定义了 `GovToolCallRequestV1` / `GovToolCallResponseV1`，
包含 `Decision: ALLOW | BLOCK | DEGRADE | PENDING` 四种判定。

`/Users/liye/github/liye_os/contracts/governance/v1/gov_tool_call_request_v1.schema.json` 提供 JSON Schema 验证。

## 吸收项

### A1: Capability Registration 时的 Threat Scan 钩子

**OpenClaw pattern**: `hooks.onSkillInstall` -- 安装时自动触发扫描
**LiYe 吸收**: 在 `CapabilityRegistry.registerAgent()` 流程中增加 pre-register scan gate。
Agent/Skill 注册前必须通过最小安全扫描，CRITICAL 级别自动拒绝注册。

**理由**: 当前 `src/control/registry.ts` 的 `registerAgent()` 是无条件接受，
缺少供应链安全的第一道防线。吸收此 pattern 可以在注册入口实现 fail-closed。

### A2: 规则 + Combo 的复合评分模型

**OpenClaw pattern**: severity 加权 + combo 叠加 + threshold 分级
**LiYe 吸收**: 采用相同的评分架构（base score + combo bonus → risk level），
但规则集针对 LiYe Systems 的实际威胁面重写（见 Contract Sketch）。

**理由**: 单一规则匹配容易误报/漏报。Combo 机制用"组合证据"降低误判率，
是比简单 allowlist/blocklist 更成熟的方案。

### A3: Evidence 不落明文 + Redaction

**OpenClaw pattern**: `snippet_redacted: true` + `snippet_hash: sha256:...`
**LiYe 吸收**: 所有 capability scan 的 evidence 只存 hash，不存源码片段。
与现有 `TraceStore`（`src/gateway/openclaw/trace_store.ts`）的 append-only 模型兼容。

**理由**: LiYe OS 的 evidence 可能包含第三方 engine 源码或配置，
落明文会造成审计日志本身成为攻击面。

### A4: Quarantine / Restore 闭环操作

**OpenClaw pattern**: quarantine = backup + disable + evidence 记录; restore = re-enable + 清除标记
**LiYe 吸收**: 在 `CapabilityContract` 层面增加 `status: active | quarantined | disabled` 字段，
支持隔离和恢复操作。与 ADR-001 的 `sandbox/candidate/production/disabled/quarantine` 分区模型对齐。

**理由**: 当前 `AgentCard.status` 只有 `available | busy | deprecated`，
缺少"因安全原因临时隔离"的语义。

## 不吸收项

### R1: OpenClaw 产品级 Runtime 主权

**不吸收**: OpenClaw 的 `~/.openclaw/` 全局状态目录、`openclaw.json` 配置体系、
`openclaw.plugin.json` 插件注册格式。

**理由**: LiYe OS 不构建在 OpenClaw 之上。LiYe OS 是独立制度底座，
有自己的 `_meta/contracts/` 合约体系和 `engine_manifest.schema.yaml`。
引入 OpenClaw 的配置体系会造成双重配置源。

### R2: 三层目录发现 (workspace/managed/extraDirs)

**不吸收**: OpenClaw 的三层文件系统扫描发现模式。

**理由**: LiYe Systems 的 capability 发现走 `engine_manifest.yaml` 声明式注册
（见 SYSTEMS.md D0->D1 流程），不走文件系统扫描。
声明式注册比目录扫描更安全（防止未声明的 skill 被意外加载）。

### R3: Skill 作为一等执行单元

**不吸收**: OpenClaw 中 Skill 是直接可执行的代码单元。

**理由**: LiYe Systems 的执行单元是 Engine Playbook（`engine_manifest.playbooks[]`），
Skill 在 LiYe OS 语境中是知识文档而非代码执行器。
引入 OpenClaw 的 Skill 概念会与现有 `Skills/` 目录语义冲突。

### R4: 直接调用 @skillgate/openclaw-skillgate npm 包

**不吸收**: 不在 LiYe OS CI/runtime 中直接依赖 openclaw-skillgate 包。

**理由**: Fork 纪律（SYSTEMS.md）明确规定"上游参考仓只提供 pattern benchmark，不作为实现主干"。
安全扫描逻辑需要独立实现，规则集需要针对 LiYe 威胁面定制。

## 与 LiYe Systems 分层关系

| 吸收项 | 落地层 | 落地位置 | 与现有组件关系 |
|--------|--------|---------|---------------|
| A1: Registration Scan Gate | Layer 0 (LiYe OS) | `src/control/registration-gate.ts` | 插入 `CapabilityRegistry.registerAgent()` 前 |
| A2: 复合评分模型 | Layer 0 (LiYe OS) | `src/control/threat-scanner.ts` | 新增组件，被 Registration Gate 调用 |
| A3: Evidence Redaction | Layer 0 (LiYe OS) | `src/control/evidence-redact.ts` | 集成到现有 `TraceStore` 写入链路 |
| A4: Quarantine/Restore | Layer 0 (LiYe OS) | `src/control/types.ts` (扩展) | 扩展 `AgentCard.status` 枚举 |
| 规则集定制 | Layer 1 (Loamwise) | `loamwise/govern/scan-rules/` | Loamwise GuardChain 消费规则集 |
| Engine 级扫描触发 | Layer 2 (Domain Engines) | 各 engine 的 CI pre-register gate | engine_manifest 注册前的必经检查 |
| 面向用户的安全报告 | Layer 3 (Product Lines) | 各产品线自行决定展示形式 | 不在本 ADR 范围 |

**依赖方向**:
```
Layer 2 Engine --注册--> Layer 0 Registration Gate --调用--> Layer 0 Threat Scanner
                                                    --写入--> Layer 0 TraceStore (with Redaction)
Layer 1 Loamwise --消费--> Layer 0 扫描规则集 (scan-rules schema)
```

**禁止方向**:
```
禁止: Layer 0 依赖 OpenClaw runtime
禁止: Layer 2 绕过 Registration Gate 直接注册
禁止: 扫描规则硬编码在 Layer 2（规则集属于 Layer 0/1）
```

## Decision

LiYe Systems 采用 OpenClaw SkillGate 的"注册时扫描 + 复合评分 + evidence 不落明文 + 隔离恢复闭环"四个 pattern，
在 Layer 0 (`src/control/`) 独立实现。

核心原则：**Capability 是核心合约，Agent/Engine 是所有权边界**。

- Capability 注册是能力合约的发布行为，必须通过安全审计 gate
- Agent/Engine 拥有其 Capability 的所有权，可被整体隔离/恢复
- 扫描规则集是治理原语，归 Layer 0 所有，Layer 1 (Loamwise) 可扩展但不可覆盖
- Evidence 全链路 redaction，审计日志不成为新攻击面

不采用 OpenClaw 的产品级运行时、配置体系、目录发现模式。
不在 LiYe OS 中引入 openclaw-skillgate 作为运行时依赖。

## Contract Sketch

### 1. CapabilityContract 扩展 (Layer 0)

```typescript
// src/control/types.ts -- 扩展现有 7 字段冻结 contract

/** 注册时威胁扫描结果，附加到 CapabilityContract 上 */
export interface ThreatScanResult {
  scan_id: string;                     // 格式: "scan-{uuid8}"
  scanned_at: string;                  // ISO 8601
  scanner_version: string;             // 扫描器版本
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  risk_score: number;                  // 0-999
  finding_count: number;
  critical_count: number;
  high_count: number;
  combos_detected: string[];           // combo 名称列表
  evidence_hash: string;               // sha256 of full evidence (not stored inline)
}

/** AgentCard.status 扩展 */
export type AgentStatus =
  | 'available'
  | 'busy'
  | 'deprecated'
  | 'quarantined'     // 新增: 因安全原因隔离
  | 'scan_pending';   // 新增: 等待首次扫描

/** 隔离元数据 */
export interface QuarantineRecord {
  quarantined_at: string;              // ISO 8601
  reason: string;
  evidence_hash: string;
  can_restore: boolean;                // false = 需要重新注册
  restored_at?: string;
}
```

### 2. Registration Gate 接口 (Layer 0)

```typescript
// src/control/registration-gate.ts

import type { AgentCard, ThreatScanResult } from './types';

export interface RegistrationGateResult {
  allowed: boolean;
  scan: ThreatScanResult;
  rejection_reason?: string;
}

export interface IRegistrationGate {
  /**
   * 注册前检查。CRITICAL 直接拒绝，HIGH 需要人工审批。
   * fail-closed: 扫描失败 = 拒绝注册。
   */
  check(card: AgentCard): Promise<RegistrationGateResult>;
}

/** 注册拒绝阈值 */
export const REGISTRATION_THRESHOLDS = {
  auto_reject: 'CRITICAL' as const,    // 自动拒绝
  require_approval: 'HIGH' as const,   // 需要人工审批
  auto_accept: 'MEDIUM' as const,      // 自动接受 (记录 warning)
} as const;
```

### 3. Threat Scanner 规则 Schema (Layer 0)

```yaml
# _meta/contracts/security/scan_rule.schema.yaml
$schema: "http://json-schema.org/draft-07/schema#"
$id: "https://liye.com/contracts/security/scan_rule.v1"
title: "Capability Scan Rule"
version: "1.0.0"
type: object

required:
  - id
  - severity
  - pattern
  - description
  - category

properties:
  id:
    type: string
    pattern: "^[a-z0-9-]+$"
    description: "规则唯一标识"
  severity:
    type: string
    enum: [CRITICAL, HIGH, MEDIUM, LOW, INFO]
  pattern:
    type: string
    description: "正则表达式字符串"
  description:
    type: string
    maxLength: 200
  category:
    type: string
    enum:
      - supply-chain
      - injection
      - data-exfiltration
      - credentials
      - destructive
      - obfuscation
      - filesystem
      - network
      - dynamic-loading
  file_types:
    type: array
    items:
      type: string
    description: "仅对特定文件类型生效"
  enabled:
    type: boolean
    default: true

additionalProperties: false
```

### 4. Combo 定义 Schema (Layer 0)

```yaml
# _meta/contracts/security/scan_combo.schema.yaml
$schema: "http://json-schema.org/draft-07/schema#"
$id: "https://liye.com/contracts/security/scan_combo.v1"
title: "Scan Combo Definition"
version: "1.0.0"
type: object

required:
  - name
  - description
  - rules
  - min_matches
  - score_bonus

properties:
  name:
    type: string
    pattern: "^[a-z0-9-]+$"
  description:
    type: string
    maxLength: 200
  rules:
    type: array
    items:
      type: string
    minItems: 2
    description: "参与 combo 的 rule id 列表"
  min_matches:
    type: integer
    minimum: 1
    description: "触发 combo 所需的最少匹配规则数"
  score_bonus:
    type: integer
    minimum: 0
    maximum: 200
    description: "combo 触发时的额外加分"

additionalProperties: false
```

### 5. Evidence Redaction 接口 (Layer 0)

```typescript
// src/control/evidence-redact.ts

export interface RedactedEvidence {
  scan_id: string;
  agent_id: string;
  scanned_at: string;
  risk_level: string;
  risk_score: number;
  findings: RedactedFinding[];
  combos: string[];
  content_hash: string;               // sha256 of full unredacted evidence
}

export interface RedactedFinding {
  rule_id: string;
  severity: string;
  file: string;
  line: number;
  description: string;
  snippet_hash: string;               // sha256 of matched snippet
  snippet_redacted: true;             // 常量, 确认已脱敏
}

export interface IEvidenceRedactor {
  /** 将扫描结果转为脱敏 evidence */
  redact(scanResult: RawScanResult): RedactedEvidence;
  /** 验证 evidence 完整性 (hash 比对) */
  verify(evidence: RedactedEvidence, rawHash: string): boolean;
}
```

### 6. 端到端注册流程 (Layer 0 + Layer 2)

```
Engine (Layer 2)                     LiYe OS (Layer 0)
     |                                     |
     |-- engine_manifest.yaml ------------>|
     |                                     |-- RegistrationGate.check()
     |                                     |     |-- ThreatScanner.scan()
     |                                     |     |     |-- 加载 scan_rule + scan_combo
     |                                     |     |     |-- 扫描 source_path 下所有文件
     |                                     |     |     |-- 计算 base_score + combo_bonus
     |                                     |     |     `-- 返回 ThreatScanResult
     |                                     |     |
     |                                     |     |-- EvidenceRedactor.redact()
     |                                     |     |     `-- 返回 RedactedEvidence (写入 TraceStore)
     |                                     |     |
     |                                     |     |-- 判定: CRITICAL -> reject
     |                                     |     |         HIGH -> pending_approval
     |                                     |     |         MEDIUM/LOW/SAFE -> accept
     |                                     |     `-- 返回 RegistrationGateResult
     |                                     |
     |                        allowed=true |-- CapabilityRegistry.registerAgent()
     |                                     |-- AgentCard.status = 'available'
     |                                     |
     |<-- registration result -------------|
```

## 非目标

1. **不定义具体扫描规则内容** -- 规则集内容属于 P2 实现范畴，本 ADR 只定义规则的 schema
2. **不实现 Loamwise GuardChain 集成** -- 属于 P2-B1 (Content Threat Detection)
3. **不定义跨 Engine 的信任传播机制** -- 属于后续 ADR
4. **不重新设计 CapabilityContract 的 7 字段冻结核心** -- 只做 status 枚举扩展和 scan result 附加
5. **不涉及 Hermes Agent 的学习循环** -- 属于 ADR-005/006 范畴
6. **不构建 OpenClaw Plugin 兼容层** -- LiYe OS 不是 OpenClaw 插件宿主

## 后续实现入口

| Phase | 内容 | 前置条件 |
|-------|------|---------|
| P2-B1 | Content Threat Detection 最小集 (3 Guards) | 本 ADR 中 scan_rule schema 冻结 |
| P2 实现 | `registration-gate.ts` + `threat-scanner.ts` 编码 | 本 ADR accepted |
| P3-A1 | Governed Learning Loop 的 candidate quarantine-first | A4 隔离/恢复机制就绪 |
| P4-C1 | Session Retrieval 集成 evidence 检索 | Evidence Redaction 接口就绪 |
| P5 | Long-task context compression | 不直接依赖本 ADR |

---

**Version**: 1.0.0
**Last Updated**: 2026-04-14
**Char Count**: ~8,600
