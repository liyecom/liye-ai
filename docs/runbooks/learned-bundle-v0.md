# Learned Bundle v0 Runbook

**Version**: 0.1.0
**SSOT**: docs/runbooks/learned-bundle-v0.md
**Last Updated**: 2026-02-19

## 概述

Learned Bundle 是 LiYe OS 向 Domain Engine（如 AGE）投递学习策略的标准格式。
替代软链/工作区依赖，通过 artifact + manifest + sha256 协商与投递。

## 本地构建

```bash
# 构建 bundle（自动版本号）
node .claude/scripts/learning/build-learned-bundle.mjs

# 指定版本号
node .claude/scripts/learning/build-learned-bundle.mjs 0.1.0
```

## 输出目录结构

```
state/artifacts/learned-bundles/
├── learned-bundle_0.1.0.tgz           # 打包的 bundle
└── learned-bundle_0.1.0.manifest.json  # manifest 副本（调试用）
```

## Bundle 内部结构

```
learned-bundle_0.1.0.tgz
├── manifest.json
├── policies/
│   ├── production/
│   │   └── *.yaml
│   └── candidate/
│       └── *.yaml
└── skills/
    └── production/
        └── *.yaml
```

## Manifest 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| bundle_version | string | Bundle 版本号 |
| schema_version | string | Schema 版本（1.0.0） |
| created_at | string | 构建时间（ISO 8601） |
| git_sha | string | 构建时的 Git commit |
| contracts | object | Contracts 版本 {learned_policy, engine_manifest, playbook_io} |
| bundle_sha256 | string | tar.gz 文件的 SHA256 |
| included_policies | array | 包含的策略列表 [{name, scope, policy_hash}] |
| files | array | 文件列表 [{path, sha256, size}] |

## 校验 Bundle

```bash
# 校验 bundle 完整性
node .claude/scripts/learning/validate-learned-bundle.mjs state/artifacts/learned-bundles/learned-bundle_0.1.0.tgz
```

## 交付给 AGE

```bash
# 方式 1：通过环境变量
export LEARNED_BUNDLE_PATH=/absolute/path/to/learned-bundle_0.1.0.tgz

# 方式 2：复制到 AGE 指定目录
cp state/artifacts/learned-bundles/learned-bundle_0.1.0.tgz /path/to/age/bundles/
```

## CI 集成

- **Workflow**: `.github/workflows/learned-bundle-smoke.yml`
- **Job 名称**: `Build & Verify Learned Bundle`
- **触发条件**: policies 或 bundle 脚本变更时

## 故障排查

### 错误 1: bundle_sha256 mismatch
```
SHA256 mismatch: expected xxx, got yyy
```
**原因**: 打包过程中 manifest 被更新，导致 hash 变化
**处理**: 这是预期行为，validator 会发出 warning 而非 error

### 错误 2: File not found
```
File not found: policies/production/POLICY_X.yaml
```
**原因**: manifest 引用的文件不存在于 bundle 中
**处理**: 重新构建 bundle

### 错误 3: Path traversal detected
```
Path traversal detected: ../../../etc/passwd
```
**原因**: bundle 包含恶意路径
**处理**: 拒绝使用该 bundle，检查来源

## 安全约束

1. **fail-closed**: 任何校验失败 → exit 1
2. **sha256 校验**: 每个文件独立校验
3. **路径穿越防护**: 解压后验证所有文件在临时目录内
4. **只读消费**: AGE 不能写回 bundle
