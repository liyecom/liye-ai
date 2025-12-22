# Home Migration Scripts

本机文件系统迁移工具 - 将散落文件统一纳管到 4 边界目录

## 快速开始

### 1. 阅读完整方案

```bash
cat ~/github/liye_os/_meta/docs/HOME_MIGRATION_STRATEGY.md
```

### 2. 执行迁移

```bash
cd ~/github/liye_os/_meta/scripts/home_migration

# 方式 A：分阶段执行（推荐）
./migrate.sh phase0    # 先备份
./migrate.sh phase1    # 迁移 git repos
./migrate.sh phase2    # 迁移工具脚本
./migrate.sh verify    # 验证

# 方式 B：一次性执行（谨慎）
./migrate.sh all       # 执行所有 Phase 0-6
```

## 命令说明

| 命令 | 说明 | 风险 |
|-----|------|------|
| `./migrate.sh phase0` | 准备和备份 | 无 |
| `./migrate.sh phase1` | 迁移 Git Repos | 低 |
| `./migrate.sh phase2` | 迁移工具脚本 | 低 |
| `./migrate.sh phase3` | 迁移大文件到 ~/data | 中 |
| `./migrate.sh phase4` | 迁移 Obsidian Vault | 中 |
| `./migrate.sh phase5` | 清理 Documents | 低 |
| `./migrate.sh phase6` | 验证和报告 | 无 |
| `./migrate.sh all` | 执行全部 Phase | 中 |
| `./migrate.sh verify` | 仅运行验证 | 无 |

## 边界目录

迁移后的目录结构：

```
~/github/           # 所有 git repos
├── liye_os/
├── sites/          # 网站源码
└── tools/          # 工具脚本

~/data/             # 大文件/私有数据
├── archives/       # 归档资料
└── amazon_data/    # Amazon 数据

~/vaults/           # Obsidian 笔记
└── obsidian_main/

~/tools/            # 软链接到 repo 工具
└── notion-sync/    → ~/github/liye_os/tools/notion-sync
```

## 回滚

备份位置：`~/Backups/home_migration_YYYYMMDD_HHMMSS/`

手动回滚：
```bash
# 查看最新备份
cat ~/github/liye_os/_meta/logs/last_backup.txt

# 从备份恢复（示例）
rsync -av ~/Backups/home_migration_*/Documents/ ~/Documents/
```

## 日志

所有操作记录在：`~/github/liye_os/_meta/logs/migration_*.log`

## 注意事项

1. **执行 phase4 前关闭 Obsidian**
2. **所有迁移都会保留软链接** - 旧路径仍可用
3. **建议分 Phase 执行** - 每个 Phase 后验证
4. **6 个月后可删除软链接** - 适应新结构后

## 详细文档

- 完整方案：`_meta/docs/HOME_MIGRATION_STRATEGY.md`
- 专家分析：见方案文档的"多角色专家分析"章节
- 架构决策：见方案文档的 ADR 部分
