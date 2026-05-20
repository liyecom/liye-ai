# PHASE-0B-SPEC — Parser & Self-Test Layer

> Phase 0B 是 LiYe Portfolio Automation Governance 的 parser / classifier / verifier 层。
> Phase 0A 完成 secret cleanup + 静态资产；Phase 0B 把 governance 文档态转为机器可验证态。
> 本文是 Phase 0B 的可执行边界契约。Phase 0C（hooks + helper CLI）依赖本文输出。

**Schema version**: 3
**Effective**: 2026-05-20
**Status**: v2 content + L1 hard-constraint protected (Patch 5.1 landed 2026-05-20 04:17Z; SPEC promoted from L2 to L1)
**Upstream**: AUTOMATION_GOVERNANCE.md (schema_version: 4), target-classes.yaml (v4), automation-trust.yaml (v3)
**Downstream**: Phase 0C helper CLI, future hooks

---

## 1. Goal

把 portfolio 范围内 credential / consumer / disk 状态扫描成 **machine-verifiable artifact**（`sealed-registry.json`），输出 Ghost / Orphan / Live 三向分类报告，为 Phase 0C 的 hook + helper CLI 提供决策基础。

**Phase 0B 严格 read-only**：scan + classify + report，零 mutation。所有写操作（audit append / DB revoke / consumer sync / hook install）属 Phase 0C。

---

## 2. Scope (final 10 items)

源自 phase-0a-2 / 0a-3 batch1-3 实证扩展。按 Decision 1 (B') 分配到 0B-1 / 0B-2：

| # | Scope item | Sub-phase | 实证来源 |
|---|---|---|---|
| 1 | `~/.claude/**/*.json` scan (settings.local + 其他 user-level config) | 0B-1 | phase-0a-1 漏扫 |
| 2 | `<any-repo>/.claude/**/*.json` scan | 0B-1 | phase-0a-1 漏扫 |
| 3 | `**/.env*` portfolio-wide (.env.local / .env.localkeys / .env.production / .env.production.example 全变体) | 0B-1 | phase-0a-2 |
| 4 | `**/.envrc` (direnv) scan | 0B-1 | phase-0a-1 lessons |
| 5 | Medusa DB `api_key` 表双向 cross-check（disk fp ↔ DB active set） | 0B-1 | phase-0a-2 sk_de44 ghost finding |
| 6 | Portfolio admin/auth provider active credential registry 框架（Medusa 已实现，其他 provider 预留扩展点） | 0B-1 | phase-0a-1 lessons |
| 7 | Ghost / Orphan / Live 三向输出（§2.3 taxonomy 强制） | 0B-1 | phase-0a-3 batch1 |
| 8 | system-seed-suspected sub-classification（title signal gate） | 0B-2 | phase-0a-3 batch3 Default pk |
| 9 | Multi-consumer sync — 同 fp 跨 N consumer 必须 N=1 record + consumer_paths=[N]，**不能** N records | 0B-1 | phase-0a-3 batch3 sk_16b admin token |
| 10 | Disk-duplicate detection — `.example` / `.template` / `.bak` / `.planning/baseline/` / `_sealed/` 内同 fp 分类为 disk_duplicate_paths（不混入 consumer_paths） | 0B-1 | phase-0a-3 batch3 sf-timomats .env.production.example |

**0B-1 scope = #1-7 + #9 + #10**（correctness prerequisites + classification core）
**0B-2 scope = #8 + Phase 0C handoff (monitored-orphan state machine)**

---

## 3. Split decision (Decision 1: B')

**采纳方案 B'**（B 修正版）：

### 3.1 Sub-phase boundary

- **0B-1**：parser core + scope #1-7 + #9 + #10 → 可信 Ghost/Orphan/Live 三向输出。无 sub-classification。
- **0B-2**：#8 system-seed gate + Phase 0C handoff（monitored-orphan 状态机 + audit chain reading）。

### 3.2 Rationale

- **#9 multi-consumer sync 是 correctness prerequisite**：缺失会使一个 fp 被报 N 个 records，分类计数失真，三向输出不可信。
- **#10 disk-duplicate detection 是 correctness prerequisite**：缺失会把 stale `.example` 中的 fp 当 active consumer，Ghost 漏报为 Live。
- **#8 system-seed-suspected 才是 true refinement**：0B-1 仅输出 `classification=Orphan`；0B-2 加 `sub_classification=system-seed-suspected-orphan`。0B-1 缺 #8 仍能产 actionable report，只是缺子分类引导。
- B'（vs 原 B）把 correctness prerequisites 与 parser core 同批，避免 0B-1 产 incorrect 三向输出。

### 3.3 Out-of-scope decision

方案 A（不拆）/ C（拆 3 段）已拒。理由记录于 Decision 1 audit trail。

---

## 4. Architecture overview

```
┌──────────────────── Phase 0B Parser Pipeline ────────────────────┐
│                                                                  │
│   target-classes.yaml ─┐                                         │
│   AUTOMATION_GOV.md   ─┼──► [envelope check]                     │
│   automation-trust.yaml┘            │                            │
│                                     ▼                            │
│   ┌──────────────┐    ┌──────────────────┐                       │
│   │ scan_disk    │───►│  fingerprint set │                       │
│   └──────────────┘    │  (sha256_12)     │                       │
│   ┌──────────────┐    └────────┬─────────┘                       │
│   │ scan_db      │───►         │                                 │
│   └──────────────┘             ▼                                 │
│   ┌──────────────┐    ┌──────────────────┐                       │
│   │ scan_consumers│──►│  triangulate     │                       │
│   └──────────────┘    │  disk × db × use │                       │
│                       └────────┬─────────┘                       │
│                                ▼                                 │
│                       ┌──────────────────┐                       │
│                       │ classify         │                       │
│                       │ Ghost/Orphan/Live│                       │
│                       └────────┬─────────┘                       │
│                                ▼                                 │
│              (0B-2 only) is_system_seed_suspected                │
│                                │                                 │
│                                ▼                                 │
│   ┌─────────────────────────────────────────┐                    │
│   │ report_sealed_registry                  │                    │
│   │  → sealed-registry.json (own artifact)  │                    │
│   └─────────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────────┘

Read-only inputs:                  Write outputs:
- portfolio disk tree              - sealed-registry.json
- Medusa DB (listApiKeys only)     - parser stderr WARN/ERROR
- audit-init.jsonl (chain read)    (no audit append, no DB write)
```

**Data flow invariants**：
- 单 fingerprint → 单 record；consumer paths 多元 → list 字段
- DB query 仅 `listApiKeys`；禁止 `apiKeyService.revoke/create/link`
- Audit jsonl 仅 read；append 是 Phase 0C 权限

---

## 5. Schema — sealed-registry.json

### 5.1 Top-level

```json
{
  "schema_version": 1,
  "parser_version": "0B-1.0.0",
  "scanned_at": "2026-05-20T03:00:00Z",
  "scope_covered": [
    "user_claude_json",
    "repo_claude_json",
    "envstar",
    "envrc",
    "medusa_db_api_key",
    "admin_credential_registry_framework",
    "ghost_orphan_live_classification",
    "multi_consumer_sync",
    "disk_duplicate_detection"
  ],
  "credentials": [ /* see §5.2 */ ],
  "summary": { /* see §5.3 */ }
}
```

### 5.2 Per-credential record

```json
{
  "fingerprint_sha256_12": "b648d0c84248",
  "key_type": "sk_",
  "redacted": "sk_c48***51b",
  "disk_sources": [
    {
      "path": "storefronts/sf-foneyi/.env.local",
      "line": 11,
      "env_var": "MEDUSA_ADMIN_TOKEN"
    }
  ],
  "db_validity": "present",
  "db_metadata": {
    "id": "apk_01KS04BJ8Q235WZG4JX3K42DF1",
    "title": "admin token",
    "created_at": "2026-05-19T12:46:15Z"
  },
  "consumer_paths": [
    "storefronts/sf-foneyi/.env.local:11",
    "storefronts/sf-refetone/.env.local:11"
  ],
  "disk_duplicate_paths": [],
  "classification": "Live",
  "sub_classification": null,
  "title_signal_score": 0,
  "last_rotated_at": "2026-05-19T12:46:15.800Z",
  "requires_human_confirmation": false,
  "recommended_disposition": "monitor"
}
```

**Fingerprint specification (locked, not Open Question)**：

- Formula: `sha256(token.encode("utf-8")).hexdigest()[:12]` (lowercase hex, first 12 chars)
- Cross-language verified equivalence:
  - Python: `hashlib.sha256(token.encode("utf-8")).hexdigest()[:12]`
  - Node: `crypto.createHash("sha256").update(token).digest("hex").slice(0,12)`
  - Sanity test 2026-05-20: sf-timomats new pk → fp `05d5c3d70f12` in both implementations
- **No salt**（与 audit-init.jsonl 历史 records 自 2026-05-19 起一致；改动需 audit migration）
- Encoding: UTF-8（明文 token 字符集均为 ASCII，但 UTF-8 编码协议级固定）
- Output: lowercase hex；parser 必须严格匹配（不允许 uppercase 容差）

**Decisions baked in**（Decision 2 锁定）：
- `schema_version`: **int**（1），与 portfolio 其他 schema 一致
- `key_type` enum: `"sk_" | "pk_" | "jwt" | "oauth" | "db" | "other" | "unknown"`（含 unknown fallback 防 parser 崩）
- `parser_version`: 字符串，semver-like，供消费方判定输出兼容
- `title_signal_score`: **0/1 binary**（0B-1 keyword match: "Default"/"Admin"/"Bootstrap"/"System"/"Seed"；0B-2 实证后可升 float）
- `last_rotated_at`: 从 audit-init.jsonl rotation record 索引（Live 才有；Ghost/Orphan 为 null）
- `consumer_paths` vs `disk_duplicate_paths`: 分离字段
  - `consumer_paths` = current working tree active config（`.env*` 排除 `.example`/`.template`/`.bak`；`scripts/`；`.github/workflows/`；`package.json` scripts 段；master keys file）
  - `disk_duplicate_paths` = stale references（`.example`/`.template`/`.bak`/`.planning/baseline/`/`_sealed/` 内同 fp）
- `sub_classification`: 0B-1 永远 null；0B-2 可填 `"ad-hoc-orphan" | "system-seed-suspected-orphan"`

### 5.3 Collision handling

`sha256[:12]` 提供 48-bit fingerprint space (≈2.8e14)。当前 portfolio ~10 credentials @ 2^48 space → 碰撞概率 < 2e-13，预计不会触发。但 parser 必须为升级路径预留 contract：

| 触发条件 | 升级动作 |
|---|---|
| fp[:12] 命中已存在 fp（不同 token） | 升级 `fp[:16]`，重算 portfolio 全部 records，0C `liye-audit-append` 写 `kind: fp-migration` record |
| fp[:16] 仍碰撞（天文概率） | 升级 `fp_full`（64 hex），同上 audit migration |

Migration 是 audit-only operation（parser 仅 detect 与 report；实际重写 audit jsonl 是 Phase 0C 权限）。Phase 0B 检出碰撞 → 输出 `summary.collision_detected: true` + ERROR exit code 2，等 0C 处理。

### 5.4 Summary

```json
{
  "ghost_count": 0,
  "orphan_count": 0,
  "live_count": 0,
  "system_seed_suspected_count": 0,
  "human_confirmation_required_count": 0,
  "disk_duplicate_records_count": 0,
  "unknown_db_validity_count": 0,
  "collision_detected": false
}
```

### 5.5 sealed-registry.json envelope

Sealed-registry 自身有 `schema_version: 1` 字段；其 envelope 见 §8。

---

## 6. CLI contracts

### 6.1 Naming convention（Decision 4 锁定）

Phase 0B 仅 5 类动词前缀：

| Prefix | 语义 | 例 |
|---|---|---|
| `scan_*` | discovery / collection | `scan_disk`, `scan_db`, `scan_consumers` |
| `list_*` | filtered enumeration | `list_disk_duplicates`, `list_orphan_candidates` |
| `is_*` | boolean check | `is_sealed`, `is_ghost`, `is_orphan`, `is_system_seed_suspected` (0B-2) |
| `classify_*` | enum-producing read-only | `classify_credentials`, `classify_disk_role` |
| `report_*` | final artifact production | `report_sealed_registry` |

**`classify_*` rationale (v2)**: `is_*` 仅布尔；Ghost/Orphan/Live 三向输出是 enum，需独立动词。0B-1 核心步 `classify_credentials` 落入此类。

**CI lint — whitelist enforcement (v2)**：

```bash
# pseudo-impl; CI gate fails if any verb prefix is NOT in whitelist
rg -No 'def ([a-z]+)_' src/0b/ -r '$1' | sort -u > /tmp/found_verbs
comm -23 /tmp/found_verbs <(printf "classify\nis\nlist\nreport\nscan\n") | wc -l
# expected output: 0；any non-whitelist verb → CI fail
```

**Rationale**: blacklist Phase 0C 动词永远枚举不完（漏 delete/update/link/set/write/patch/sync/swap/...），whitelist 才稳。仅 5 个白名单动词显式列出，新动词必须先入白名单（PR review gate）。

### 6.2 Tool contracts (0B-1)

| Tool | Input | Output | Side effects |
|---|---|---|---|
| `scan_disk` | portfolio root path | `Set[FingerprintRecord]` (disk_sources only) | none |
| `scan_db` | Medusa db connection | `Set[FingerprintRecord]` (db_metadata only) | DB read (listApiKeys only) |
| `scan_consumers` | portfolio root path, fingerprint set | `Map[fp, List[consumer_path]]` + `Map[fp, List[disk_duplicate_path]]` | none |
| `classify_credentials` | triangulated set | each record + `classification` (enum: Ghost/Orphan/Live) + `requires_human_confirmation` | none |
| `is_sealed` | path | bool | none |
| `is_ghost` / `is_orphan` / `is_live` | record | bool | none |
| `report_sealed_registry` | classified set, output path | writes `sealed-registry.json` | write own output file only |

### 6.3 Tool contracts (0B-2)

| Tool | Input | Output | Side effects |
|---|---|---|---|
| `is_system_seed_suspected` | record (Orphan only) | bool | none |
| `scan_audit_chain` | audit-init.jsonl | `Map[old_fp → new_fp]` rotation links | jsonl read only |
| `list_monitored_orphans` | classified set | filtered list | none |

### 6.4 Write boundary (v2)

**Output path whitelist**（parser 启动时 assert）：

- 唯一允许写入：`./sealed-registry.json` 或 `--output-dir <dir>/sealed-registry.json`
- 启动 assert：解析 `--output-dir` argv → 拼接 → 与白名单 pattern 比对 → 不命中 → ERROR exit code 3
- **明文禁止写入路径**（assert hard-block）：
  - `audit-init.jsonl` / `automation-log.jsonl` / `break-glass.jsonl`
  - Medusa DB（任何 SQL/HTTP/SDK write 路径）
  - consumer `.env*` / `silkbay/.env.localkeys` / storefronts `.env.local`
  - `~/.claude/**` / `<repo>/.claude/**`
  - `~/.local/state/liye-automation/**`

**Mutation ban — 双层**（CI lint 验证）：

1. **subprocess 层**：源码不得 exec `liye-rotate` / `liye-audit-append` / `medusa-cli <mutation-subcmd>` / `psql -c <write-stmt>`
2. **SDK/HTTP 层**：源码不得调用：
   - `requests.post/put/delete/patch` / `httpx.{post,put,delete,patch}` / Node `fetch({method: POST/PUT/DELETE/PATCH})`
   - Medusa SDK `apiKeyService.{create,revoke,update,delete}` / `remoteLink.{create,delete}`
   - 任何 ORM `.save/.delete/.update/.insert`

**CI lint 补充 grep**（与 §6.1 whitelist 并行）：

```bash
# subprocess mutation grep
rg -e 'subprocess\.(run|Popen|call|check_output)' -e 'os\.system' src/0b/ \
   | rg -v '# noqa: read-only-exec' \
   && exit 1 || true

# HTTP write-method grep
rg -e 'requests\.(post|put|delete|patch)' \
   -e 'httpx\.(post|put|delete|patch)' \
   -e 'fetch\([^)]*method:\s*["'\'']?(POST|PUT|DELETE|PATCH)' \
   src/0b/ \
   && exit 1 || true
```

GET / listApiKeys / read-only SQL 允许；任何 mutation 动词均 fail CI。subprocess `# noqa: read-only-exec` 注释豁免仅供 read-only 调用（如 `git log` / `rg`）。

---

## 7. Fixture coverage matrix

**0B-1: 15 fixtures (11 P0 + 4 P1)**

| # | 类别 | 验证内容 | 优先级 | 实证来源 |
|---|---|---|---|---|
| F1 | Ghost — disk only | plaintext + DB 不存在 → `classification=Ghost` | P0 | phase-0a-2 sk_de44 |
| F2 | Ghost — stale .env.production.example | active fp 在 .example → `classification` 取决于 DB；`disk_duplicate_paths` 非空 | P0 | phase-0a-3 batch3 sf-timomats |
| F3 | Orphan — ad-hoc title | DB active + 0 consumer + 普通命名 → `classification=Orphan, sub=null` | P0 | phase-0a-3 batch1 sk_4ec/sk_69c |
| F4 | Orphan — system-seed naming (0B-1 阶段无 sub-class) | DB active + 0 consumer + title 含 "Default" → `classification=Orphan, sub=null, title_signal_score=1` | P0 | phase-0a-3 batch3 Default pk |
| F5 | Live — single consumer | 单 storefront pk_ → `classification=Live, consumer_paths=[1]` | P0 | phase-0a-3 batch3 |
| F6 | Live — multi consumer | admin token 跨 N storefronts → 单 record + `consumer_paths=[N]`，**不能** N records | P0 | phase-0a-3 batch3 sk_16b |
| F7 | Live — master + replica | pk_ 在 silkbay/.env.localkeys + sf-*/.env.local → 单 record + `consumer_paths=[2]` | P0 | phase-0a-3 batch3 |
| F7b | Live — active production env | 同 fp 在 `.env.local` + `.env.production`（active 非 example）→ `consumer_paths=[2], disk_duplicate_paths=[]` | P0 | Decision 2 (c) 反向覆盖 |
| F8 | JWT — post-cleanup re-injection | actor_id JWT 出现在 user-level config → 被 scan 命中 | P0 | phase-0a-2 |
| F10 | Schema version backward compat | target-classes.yaml v3 文件 → parser 接受（envelope min=3 通过） | P0 | Batch 2 派生约束 |
| F11 | Path normalization | `~` / `$HOME` / relative → realpath 绝对化匹配 | P0 | §4.5 |
| F12 | Empty .env.local | 无 secret，parser 不崩 | P1 | edge case |
| F13 | Malformed JSON settings.local | parser 容错，记 WARN，跳过该文件 | P1 | edge case |
| F14 | DB unreachable | parser graceful degrade → `db_validity="unknown"`，summary 含 `unknown_db_validity_count` | P1 | edge case |
| F15 | Multiple keys same fp | 假设极小概率冲突 → parser 合并 disk_sources，不分裂 record | P1 | edge case |

**F7b rationale**: parser 实现 disk-duplicate regex 易用宽 glob `*.production*` 误排除 active `.env.production`，F7b 是反向覆盖。

**0B-2 fixture（预留）**：

| # | 内容 |
|---|---|
| F4b | Orphan + system-seed-suspected sub-classification（gate 命中后） |
| F16 | Rotation chain reading：parser 从 audit jsonl 重建 fp 历史（old→new mapping） |
| 未来 | system-seed gate 触发 read-only smoke 探针（如 0B-2 需） |

**移出**（明文记录）：

| 原 # | 处置 | 理由 |
|---|---|---|
| F9（hard-constraint path access）| 移出 Phase 0B | parser 不做 hook 决策；Phase 0C fixture |
| F16（rotation atomic gap） | 移到 0B-2 | rotation 是 0C 责任，0B 仅读 audit chain |

---

## 8. Compatibility envelope (schema_version)

### 8.1 双阈值模型（Decision 5 锁定）

```python
class SchemaEnvelope:
    name: str               # e.g. "target_classes"
    min_compatible: int     # hard floor; below → ERROR + abort
    target_compatible: int  # soft target; above → WARN + proceed
```

### 8.2 Per-schema envelope（**每 schema 独立**）

| Schema | min_compatible | target_compatible | 当前 portfolio version |
|---|---|---|---|
| `target_classes` | 3 | 4 | 4 |
| `automation_governance` | 4 | 4 | 4 |
| `automation_trust` | 3 | 3 | 3 |
| `sealed_registry` | 1 | 1 | 1 (parser own output) |
| `audit_event` (per-record, R1) | 1 | 1 | 1 (per jsonl record) |

**R1 (Decision 5 refinement)**: `audit_event` per-record envelope 加入，parser 读 rotation chain 时按 record 级 schema_version 校验。

### 8.3 行为

```
version absent       → SchemaMissingError, abort
version < min        → SchemaTooOldError, abort
version > target     → WARN "v{n} > parser target v{m}, may miss new fields"，继续
min <= version <= target → silent OK
```

### 8.4 Bump 协议（Decision 5 锁定：同 PR 同步）

portfolio 文件 bump version 必须与 parser envelope target bump 同 PR，CI gate 验证。

### 8.5 Bump 触发 semver 表（R2 refinement）

| 变更类型 | bump target | bump min |
|---|---|---|
| 新增 optional field | ✓ | — |
| 新增 required field | ✓ | ✓ |
| 删除字段 | ✓ | ✓ |
| 重命名字段 | ✓ | ✓ |
| 类型变更（int→string 等） | ✓ | ✓ |
| 语义变更（同字段含义变，e.g. score 0-1 → 0-100） | ✓ | ✓ |
| enum 新增值 | ✓ | — |
| enum 删除值 | ✓ | ✓ |

**Trap**: 语义变更（字段名/类型不变但语义变）必须 bump min，否则 parser silent miscompat。

### 8.6 Operation modes (R3 refinement)

- **default mode**: §8.3 行为（min ≤ v ≤ target silent；v > target WARN continue；v < min ERROR abort）
- **`--strict` mode**: 所有 WARN 强制转 ERROR；CI 调用 parser 时启用 `--strict`

---

## 9. Phase 0C handoff points

Phase 0B 输出 → Phase 0C 消费的接口契约：

| Phase 0C 行为 | 依赖 Phase 0B 输出 |
|---|---|
| `liye-audit-append` | 读 `sealed-registry.json` 验证 fp 存在，再 append 对应 audit record |
| `liye-rotate` | 读 `classification=Live` records + `consumer_paths` 决定 sync target |
| `liye-break-glass` | 读 `is_sealed` / target_class 判定 scope 合法性 |
| `liye-install-hook` | 读 parser 二进制存在 + envelope state |
| PreToolUse self-mod block hook | 读 target-classes.yaml + 调用 parser `is_sealed(path)` |
| PostToolUse audit log hook | 读 `report_sealed_registry` 历史输出对照 |
| monitored-orphan 状态机（0B-2 + 0C） | 0B-2 输出 `sub_classification=system-seed-suspected-orphan`；0C 触发 smoke test workflow |

**接口稳定性**：sealed-registry.json schema_version + parser_version 是 0B↔0C 兼容性 contract。Phase 0C 必须接受 sealed-registry envelope check。

---

## 10. Non-goals

明确不在 Phase 0B 实现的事项：

- ❌ 任何 write side effect（audit append / DB revoke / DB create / DB link / consumer sync / hook install / session 文件管理）
- ❌ `apply_*` / `rotate_*` / `revoke_*` / `append_*` / `create_*` / `install_*` 动词命名工具
- ❌ Rotation atomic / zero-downtime workflow（属 0C, Phase 0a-3 batch3 line 165 派生约束：rotation atomic 是 best-effort 非强保证；prod 需 0C 实现 zero-downtime workflow）
- ❌ Git history scan（性能 + scope 控制；consumer/disk-duplicate 仅当前 working tree）
- ❌ User-level config 推断（如 `~/.bashrc` env 推断）— 0B 不读 shell env，仅静态文件
- ❌ Sealed-registry 自身 unseal flow（Phase 0 不实现）
- ❌ Cross-portfolio scan（liye_os 域外仓库 — 索引外仓库见 CLAUDE.md）
- ❌ Title-signal float threshold（0/1 binary 至 0B-2 实证后再决定）
- ❌ Sub-classification 在 0B-1（仅 0B-2）

---

## 11. Implementation plan

### 11.1 0B-1 milestones

| M | Deliverable | Acceptance |
|---|---|---|
| M1 | Project skeleton + envelope module + F10/F11 fixture | `scan_*` / `report_*` 函数签名定义；envelope 双阈值实现 |
| M2 | `scan_disk` + F1/F8/F12/F13 fixture | disk plaintext fingerprint set 输出 |
| M3 | `scan_db` + F14 fixture | Medusa DB cross-check（read-only `listApiKeys`） |
| M4 | `scan_consumers` + F5/F6/F7/F7b/F15 fixture | consumer_paths vs disk_duplicate_paths 分离正确 |
| M5 | `classify_credentials` + F2/F3/F4 fixture | Ghost/Orphan/Live 三向输出 + title_signal_score=0/1 |
| M6 | `report_sealed_registry` + summary + `--strict` mode + output path whitelist assert | sealed-registry.json 输出 + schema envelope 全验证 + write boundary 守门 |
| M7 | CI lint (verb prefix whitelist enforcement + subprocess/HTTP mutation grep) + full 15-fixture green | 0B-1 ship 条件 |

### 11.2 0B-2 milestones

| M | Deliverable |
|---|---|
| M8 | `is_system_seed_suspected` + F4b fixture（sub_classification 填充） |
| M9 | `scan_audit_chain` + F16 fixture（rotation chain reading） |
| M10 | Phase 0C handoff contract test（sealed-registry → 0C 消费方 stub） |

---

## 12. Open questions

未在本 refresh session 解决，留 Phase 0B 实施时再决定：

1. **CI lint 实现位置**：放 liye_os 仓库 .github/workflows/ 还是 parser 项目内？建议后者，但需确认 parser 项目位置（待 0B-1 M1 决定）。
2. **DB connection 配置**：Medusa DB connection string 从哪获取？走 trust.local.yaml？走环境变量？需 0C session 文件还是 0B 也有独立 config？倾向独立 config + env var binding。
3. **portfolio root 探测**：parser 怎么知道 portfolio root？候选 — `.liye-portfolio-marker` 文件 / 写死 `~/github/` / CLAUDE.md 解析。倾向 marker 文件，但需 Phase 0C 写入流程支持。
4. **0B-1 vs 0B-2 时序**：0B-1 ship 后多久启动 0B-2？取决于 0B-1 实战 feedback 周期。倾向 0B-1 跑 2-4 周后再启动。
5. **language**: parser 用 Python / TypeScript / Bash？倾向 Python（json/yaml 处理友好，subprocess Medusa CLI 调用方便）。

**Closed in v2 refinement**：fingerprint 算法已锁定（见 §5.2 Fingerprint specification）— `sha256[:12]` no salt UTF-8 lowercase hex；与 audit-init.jsonl 历史一致；升级路径见 §5.3。

---

## 13. File layout (Decision 6 + R1)

```
liye_os/_meta/portfolio/
├── PHASE-0B-SPEC.md            # 本文（target_class=governance_documentation）
├── AUTOMATION_GOVERNANCE.md
├── target-classes.yaml
├── automation-trust.yaml
├── automation-trust.local.yaml.template
├── audit-policy.md
├── automation-log.schema.json
├── automation-session.schema.md
├── SYSTEMS.md
└── phase-0b/                   # 附属资产子目录（待 0B-1 M1 创建）
    ├── fixtures/               # F1-F15 fixture 数据
    ├── examples/               # 示例 sealed-registry.json
    └── README.md
```

**约定**：
- 主 SPEC 文件保持单文件可索引（在 portfolio/ root）
- 附属 fixture / 示例 / 子文档收纳到 `phase-N/` 子目录
- 命名规范：`PHASE-N-SPEC.md` 主文件在 root，`phase-N/` 子目录承载附属

---

## 14. Governance status

- 本文档 target_class = `governance_documentation`（per target-classes.yaml v4 line 71-81）
- **Patch 5.1 Landed 2026-05-20 04:17Z**：`PHASE-0B-SPEC.md` 已加入 AUTOMATION_GOVERNANCE.md §9 hard-constraint narrow list（与其他 portfolio 治理文档平行受保护）。
- **当前 L1 hard-constraint protected**（agent 禁 Edit/Write；任何修改必须 user-paste 或 break-glass record）。
- 修改流程：(1) 申请 break-glass record；OR (2) user paste-only edit；OR (3) 走 PR review + 二次审计 + paste-ready script 路径（参考 Patch 5/5.1 pattern）。
- Schema bump 协议见 §8.4 + §8.5 semver 表。

---

## 15. Version

| Schema | Date | Change |
|---|---|---|
| 1 | 2026-05-20 | Initial draft — phase-0a-3 refresh outcome（Decision 1-6 + R1-R3 全部 refinement） |
| 2 | 2026-05-20 | v2 refinement — Gap A: `classify_*` verb（白名单第 5 类）；Gap B: CI lint blacklist→whitelist；Gap C: fingerprint spec lock（§5.2 公式 + §5.3 collision handling）；Gap D: §6.4 write boundary（output path whitelist + 双层 mutation ban + subprocess/HTTP lint） |
| 3 | 2026-05-20 | Governance status promotion — P5.1 landed, SPEC.md upgraded from L2 (session+non-main writable) to L1 (hard-constraint protected). No content change in this revision; status-only bump. |

修改本文件：(1) 提升 schema_version；(2) Date 加新行；(3) Change 一句话。
本文已 **L1 hard-constraint protected**（Patch 5.1 landed 2026-05-20）；修改流程见 §14。
