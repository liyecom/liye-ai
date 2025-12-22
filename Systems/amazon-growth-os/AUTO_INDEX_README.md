# Amazon 知识库自动索引系统

本系统确保新增或修改的 MD 文档能够自动同步到向量数据库，供 AI Agent 查询使用。

## 🎯 系统特点

- ✅ **增量索引**：只处理新增或修改的文件，速度快（通常 < 1 分钟）
- ✅ **定时执行**：每天凌晨 2:00 自动运行
- ✅ **状态追踪**：维护文件修改时间，避免重复处理
- ✅ **自动清理**：删除已不存在文件的向量
- ✅ **日志记录**：保留 30 天运行日志

## 📦 组件说明

### 1. 核心脚本

| 文件 | 说明 |
|------|------|
| `scripts/incremental_index.py` | 增量索引器（Python） |
| `scripts/daily_index.sh` | 每日执行脚本（Bash） |
| `scripts/manage_auto_index.sh` | 管理工具（安装/卸载/状态） |
| `scripts/com.liye.amazon-kb-indexer.plist` | macOS 定时任务配置 |

### 2. 状态文件

| 文件 | 说明 |
|------|------|
| `.index_state.json` | 记录已索引文件的修改时间 |
| `logs/daily_index_YYYYMMDD.log` | 每日运行日志 |
| `logs/indexer_stdout.log` | 标准输出日志 |
| `logs/indexer_stderr.log` | 错误日志 |

## 🚀 快速开始

### 安装自动索引任务

```bash
cd ~/Documents/liye_workspace/LiYe_OS/Skills/02_Operation_Intelligence/amazon-operations-crew

# 安装定时任务
./scripts/manage_auto_index.sh install
```

**输出示例**:
```
Installing Amazon KB Auto-Indexer...
✓ Auto-indexer installed successfully!

The indexer will run daily at 2:00 AM
You can run it manually anytime with: ./scripts/manage_auto_index.sh run-now
```

### 查看状态

```bash
./scripts/manage_auto_index.sh status
```

**输出示例**:
```
Checking Amazon KB Auto-Indexer status...

✓ Auto-indexer is INSTALLED

Schedule: Daily at 2:00 AM
Plist file: /Users/liye/Library/LaunchAgents/com.liye.amazon-kb-indexer.plist

✓ Task is LOADED and ACTIVE

Index State:
  Tracked files: 389
  Last update: 2025-12-21 09:47:23

Latest log: logs/daily_index_20251221.log
Last run: 2025-12-21 02:00:01
```

### 立即执行索引

```bash
./scripts/manage_auto_index.sh run-now
```

这会立即执行增量索引，适用于：
- 刚添加了新文档，想立即测试
- 修改了重要文件，需要马上更新索引
- 验证索引系统是否正常工作

### 查看日志

```bash
./scripts/manage_auto_index.sh logs
```

显示最近一次运行的日志（最后 50 行）。

### 卸载定时任务

```bash
./scripts/manage_auto_index.sh uninstall
```

## 📊 工作流程

### 自动索引流程

```
每天凌晨 2:00
    ↓
启动 daily_index.sh
    ↓
执行 incremental_index.py
    ↓
1. 加载状态文件 (.index_state.json)
    ↓
2. 扫描 ~/Documents/出海跨境/Amazon/ 目录
    ↓
3. 对比文件修改时间
    ↓
4. 识别新增/修改/删除的文件
    ↓
5. 删除已不存在文件的向量
    ↓
6. 索引新增/修改的文件
    ↓
7. 更新状态文件
    ↓
8. 保存日志
```

### 增量索引逻辑

**状态文件格式** (`.index_state.json`):
```json
{
  "README.md": 1734753443.5,
  "亚马逊30天新品爆款打造全攻略_完整版.md": 1734753450.2,
  ...
}
```

**判断逻辑**:
- **新增文件**: 文件在目录中，但不在状态文件中
- **修改文件**: 文件的修改时间 > 状态文件中记录的时间
- **删除文件**: 文件在状态文件中，但不在目录中

## 🛠️ 使用场景

### 场景 1: 添加新的广告打法文档

```bash
# 1. 添加新文件到知识库
cp ~/Downloads/新广告打法.md ~/Documents/出海跨境/Amazon/亚马逊资料/

# 2. 选项A：等待自动索引（最多 24 小时）
# 无需操作，明天凌晨 2:00 自动索引

# 2. 选项B：立即索引
cd ~/Documents/liye_workspace/LiYe_OS/Skills/02_Operation_Intelligence/amazon-operations-crew
./scripts/manage_auto_index.sh run-now
```

**索引结果**:
```
Incremental Amazon Knowledge Base Indexer
============================================================

Scanning directory: /Users/liye/Documents/出海跨境/Amazon
✓ Found 1 new/modified files
✓ Found 0 deleted files

Indexing 1 files...

[1/1] Processing: 新广告打法.md
  Generated 15 chunks
  ✓ Uploaded 15 chunks

✅ Indexing complete!
Total files processed: 1
Total chunks indexed: 15

Summary:
  New/Modified files: 1
  Deleted files: 0
  Total tracked files: 390
```

### 场景 2: 修改现有文档

```bash
# 1. 修改文件
vim ~/Documents/出海跨境/Amazon/README.md

# 2. 立即更新索引
./scripts/manage_auto_index.sh run-now
```

**索引器会**:
1. 检测到 README.md 的修改时间变化
2. 删除该文件的旧向量
3. 重新索引该文件的新内容

### 场景 3: 删除文档

```bash
# 1. 删除不需要的文件
rm ~/Documents/出海跨境/Amazon/某个过时的文档.md

# 2. 等待自动索引，或立即执行
./scripts/manage_auto_index.sh run-now
```

**索引器会**:
1. 检测到文件已删除
2. 从 Qdrant 中删除该文件的所有向量
3. 从状态文件中移除记录

## 🔍 监控与调试

### 检查最近的索引活动

```bash
# 查看今天的日志
tail -f logs/daily_index_$(date +%Y%m%d).log

# 查看所有日志文件
ls -lh logs/

# 查看错误日志
cat logs/indexer_stderr.log
```

### 验证索引结果

```bash
# 检查 Qdrant 中的 points 数量
NO_PROXY=localhost,127.0.0.1 curl -s http://localhost:6333/collections/amazon_knowledge_base | jq .result.points_count

# 检查状态文件中追踪的文件数
jq 'length' .index_state.json
```

### 手动重建完整索引

如果怀疑增量索引有问题，可以重建完整索引：

```bash
# 删除状态文件
rm .index_state.json

# 运行完整索引（会重新处理所有文件）
NO_PROXY=localhost,127.0.0.1 python scripts/build_vector_index.py
```

## ⚙️ 高级配置

### 修改执行时间

编辑 `scripts/com.liye.amazon-kb-indexer.plist`:

```xml
<!-- 修改为每天下午 6:00 -->
<key>StartCalendarInterval</key>
<dict>
    <key>Hour</key>
    <integer>18</integer>  <!-- 18 = 下午 6 点 -->
    <key>Minute</key>
    <integer>0</integer>
</dict>
```

然后重新加载任务：
```bash
./scripts/manage_auto_index.sh uninstall
./scripts/manage_auto_index.sh install
```

### 修改源目录

编辑 `scripts/incremental_index.py` 和 `scripts/daily_index.sh`，修改：

```python
# incremental_index.py
default=Path("~/Documents/出海跨境/Amazon").expanduser()
```

```bash
# daily_index.sh
PROJECT_DIR="/Users/liye/Documents/liye_workspace/..."
```

### 调整日志保留时间

编辑 `scripts/daily_index.sh`:

```bash
# 改为保留 60 天
find "$LOG_DIR" -name "daily_index_*.log" -mtime +60 -delete
```

## 📝 故障排除

### 问题 1: 任务没有自动运行

**检查步骤**:
```bash
# 1. 确认任务已安装
./scripts/manage_auto_index.sh status

# 2. 检查 launchd 任务列表
launchctl list | grep amazon

# 3. 查看系统日志
log show --predicate 'subsystem == "com.apple.launchd"' --last 1h | grep amazon
```

**解决方案**:
```bash
# 重新加载任务
launchctl unload ~/Library/LaunchAgents/com.liye.amazon-kb-indexer.plist
launchctl load ~/Library/LaunchAgents/com.liye.amazon-kb-indexer.plist
```

### 问题 2: Qdrant 连接失败

**错误信息**:
```
Error connecting to Qdrant at http://localhost:6333
```

**解决方案**:
```bash
# 检查 Qdrant 容器状态
docker ps | grep qdrant

# 如果没有运行，启动容器
cd ~/Documents/出海跨境/Amazon
docker-compose up -d
```

### 问题 3: 权限错误

**错误信息**:
```
Permission denied: /Users/liye/Documents/出海跨境/Amazon/.index_state.json
```

**解决方案**:
```bash
# 修复权限
chmod 644 .index_state.json
chmod 755 scripts/*.sh
chmod 755 scripts/*.py
```

### 问题 4: 虚拟环境找不到

**错误信息**:
```
source: venv/bin/activate: No such file or directory
```

**解决方案**:
```bash
# 重新创建虚拟环境
cd ~/Documents/liye_workspace/LiYe_OS/Skills/02_Operation_Intelligence/amazon-operations-crew
python3 -m venv venv
source venv/bin/activate
pip install qdrant-client sentence-transformers
```

## 📈 性能指标

### 增量索引性能

| 场景 | 文件数 | 执行时间 | 内存占用 |
|------|--------|---------|---------|
| 无变化 | 0 | ~5 秒 | < 100MB |
| 1 个新文件 | 1 | ~10 秒 | ~200MB |
| 10 个新文件 | 10 | ~30 秒 | ~300MB |
| 50 个新文件 | 50 | ~2 分钟 | ~500MB |
| 全量重建 | 389 | ~5 分钟 | ~800MB |

### 存储占用

- 状态文件: ~50KB
- 日志文件（每天）: ~10-50KB
- 向量数据库: ~500MB（3,263 chunks）

## 🎓 最佳实践

1. **定期检查状态**
   ```bash
   # 每周检查一次
   ./scripts/manage_auto_index.sh status
   ```

2. **重要更新后手动索引**
   ```bash
   # 添加重要文档后立即索引
   ./scripts/manage_auto_index.sh run-now
   ```

3. **月度全量重建**
   ```bash
   # 每月 1 号清空状态，重建索引
   rm .index_state.json
   NO_PROXY=localhost,127.0.0.1 python scripts/build_vector_index.py
   ```

4. **备份状态文件**
   ```bash
   # 定期备份状态文件
   cp .index_state.json .index_state.json.backup
   ```

## 🔗 相关文档

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [macOS launchd Guide](https://www.launchd.info/)
- [Sentence Transformers](https://www.sbert.net/)

## 📞 支持

如有问题，检查以下文件：
- `logs/daily_index_*.log` - 运行日志
- `logs/indexer_stderr.log` - 错误日志
- `.index_state.json` - 索引状态

或运行诊断：
```bash
./scripts/manage_auto_index.sh status
./scripts/manage_auto_index.sh logs
```
