# Release v6.2.0 World Model Gate Checklist

> **版本**: v6.2.0-dev
> **创建日期**: 2026-01-01
> **状态**: 进行中
> **目标**: 在 amazon-growth 落地 World Model Gate，确保执行前必须生成合规的 T1/T2/T3

---

## 基线快照

| 项目 | 值 |
|------|-----|
| **Base Git SHA** | `be043bf6aa471343a362a879552fe8addaf62d9d` |
| **Base Branch** | `release/v6.1.1-hardening` |
| **Feature Branch** | `feature/v6.2.0-world-model-gate` |
| **Target Domain** | `amazon-growth` |
| **创建时间** | 2026-01-01 |

---

## 核心目标

1. **硬阻断**：任何 amazon-growth 执行必须先生成合规的 T1/T2/T3
2. **可追溯**：world_model_result 必须写 trace（json）+ 人类可读报告（md）
3. **可测试**：Gate 必须可测试、可审计、可被 CI 强制
4. **可扩展**：MVP 规则正确，架构可扩展到其他 domain

---

## 验收标准

### World Model Contract
- [ ] WorldModelResult schema 定义完整
- [ ] validate_world_model_result() 返回可读错误
- [ ] 必填字段全部强制校验

### T1/T2/T3 单元库
- [ ] T1 失败模式 >= 3 个单元
- [ ] T2 状态证据 >= 2 个单元
- [ ] T3 形态 >= 2 个单元
- [ ] 内容用普通人语言，无"保证效果"类词

### Runner & Artifacts
- [ ] run_world_model() 返回合规 WorldModelResult
- [ ] 自动写入 trace json 到 data/traces/world_model/
- [ ] 自动写入 report md 到 Artifacts_Vault/reports/

### Gate Enforcement
- [ ] amazon-growth 入口必须调用 run_world_model
- [ ] validate 失败 => 硬阻断（WORLD_MODEL_REQUIRED）
- [ ] --dry-run 模式只生成 trace/artifact，不执行实际操作

### CI Gate
- [ ] verify_v6_2.py 检查 Gate 强制
- [ ] 禁止旁路标记（skip_world_model, bypass_gate 等）
- [ ] CI workflow 集成 verify_v6_2

### Smoke Tests
- [ ] 正常路径：dry-run 生成 trace + report
- [ ] 失败路径：缺字段时抛异常并终止

### Documentation
- [ ] 宪法新增 World Model Gate 条款
- [ ] WORLD_MODEL_CONSTITUTION.md 普通人说明
- [ ] CLAUDE.md 更新执行指引

---

## 变更记录

| 日期 | 阶段 | 变更 |
|------|------|------|
| 2026-01-01 | PHASE 0 | 创建分支，版本设为 v6.2.0-dev |

