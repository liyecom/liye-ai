# 🔧 运行时环境配置说明

## 方案B：物理隔离架构

本系统采用**物理隔离**架构，将代码和数据分离：
- **代码仓库**：`~/github/liye_os/Systems/amazon-growth-os/`（Git管理）
- **运行时数据**：`~/Documents/amazon-runtime/`（不在Git中）

---

## 📂 目录结构

### 工作目录（你在这里工作）
```
~/github/liye_os/Systems/amazon-growth-os/
├── agents/              ← 源代码（Git管理）
├── config/              ← 配置模板（Git管理）
├── .env                 ← 软链接 → ~/Documents/amazon-runtime/.env
├── uploads/             ← 软链接 → ~/Documents/amazon-runtime/uploads/
├── data/                ← 软链接 → ~/Documents/amazon-runtime/data/
├── logs/                ← 软链接 → ~/Documents/amazon-runtime/logs/
└── reports/             ← 软链接 → ~/Documents/amazon-runtime/reports/
```

### 运行时目录（数据真实存储位置）
```
~/Documents/amazon-runtime/
├── .env                 ← 真实配置（包含API密钥）
├── uploads/             ← 客户数据
│   ├── Timo-CA/         ← 加拿大站数据
│   └── Timo-US/         ← 美国站数据
├── data/                ← DuckDB数据库、缓存
├── logs/                ← 运行日志
└── reports/             ← 生成的分析报告
```

---

## 🚀 首次部署（新机器）

如果你在新机器上克隆这个仓库，需要手动创建运行时环境：

### 1. 创建运行时目录
```bash
mkdir -p ~/Documents/amazon-runtime/{uploads/Timo-CA,uploads/Timo-US,data,logs,reports}
```

### 2. 配置环境变量
```bash
cp .env.example ~/Documents/amazon-runtime/.env
vim ~/Documents/amazon-runtime/.env  # 填入真实API密钥
```

### 3. 创建软链接
```bash
cd ~/github/liye_os/Systems/amazon-growth-os/
ln -s ~/Documents/amazon-runtime/uploads uploads
ln -s ~/Documents/amazon-runtime/data data
ln -s ~/Documents/amazon-runtime/logs logs
ln -s ~/Documents/amazon-runtime/reports reports
ln -s ~/Documents/amazon-runtime/.env .env
```

### 4. 验证
```bash
# 检查软链接
ls -la | grep "^l"

# 测试配置文件
cat .env

# 测试数据访问
ls uploads/
```

---

## 💡 日常使用

你的工作流程**完全不变**：

```bash
# 进入工作目录
cd ~/github/liye_os/Systems/amazon-growth-os/

# 上传数据（看起来传到这里，实际存到 amazon-runtime）
cp ~/Downloads/BusinessReport-US.csv uploads/Timo-US/

# 运行分析
./run.sh --mode optimize --asin "B08SWLTTSW"

# 查看报告
cat reports/markdown/TIMO-US-诊断.md

# 修改代码
vim agents/keyword_architect.py

# 提交代码（不会提交数据，因为.gitignore忽略了软链接）
git add agents/keyword_architect.py
git commit -m "优化关键词逻辑"
git push
```

---

## 🔒 开源安全性

### ✅ 为什么这个方案是安全的？

1. **数据物理隔离**
   - 敏感数据在 `~/Documents/amazon-runtime/`（Git仓库外）
   - 即使执行 `git add .` 也不会添加数据（软链接被.gitignore忽略）

2. **无法误提交**
   - 软链接本身被.gitignore明确排除
   - API密钥在运行时目录，永远不会进入Git

3. **随时可以开源**
   - `git push` 只推送代码，不会推送数据
   - 可以安全地将仓库设为public

---

## 🧹 备份与清理

### 备份运行时数据
```bash
cd ~/Documents/
tar -czf amazon-runtime-backup-$(date +%Y%m%d).tar.gz amazon-runtime/
```

### 清理旧日志
```bash
cd ~/Documents/amazon-runtime/logs/
find . -name "*.log" -mtime +30 -delete  # 删除30天前的日志
```

### 清理临时报告
```bash
cd ~/Documents/amazon-runtime/reports/
# 手动检查后删除不需要的报告
```

---

## ⚠️ 注意事项

1. **不要在运行时目录直接工作**
   - 始终在 `~/github/liye_os/Systems/amazon-growth-os/` 工作
   - 通过软链接访问数据

2. **软链接不能跨平台**
   - Windows不支持Unix软链接
   - 如需Windows支持，改用符号链接或Junction

3. **备份运行时目录**
   - 运行时数据不在Git中，需要单独备份
   - 建议定期备份到云存储

---

## 📋 故障排除

### 问题：软链接失效（显示红色或断开）

```bash
# 检查目标目录是否存在
ls ~/Documents/amazon-runtime/

# 重新创建软链接
cd ~/github/liye_os/Systems/amazon-growth-os/
rm -f uploads data logs reports .env  # 删除旧链接
ln -s ~/Documents/amazon-runtime/uploads uploads
ln -s ~/Documents/amazon-runtime/data data
ln -s ~/Documents/amazon-runtime/logs logs
ln -s ~/Documents/amazon-runtime/reports reports
ln -s ~/Documents/amazon-runtime/.env .env
```

### 问题：Git显示大量untracked files

```bash
# 检查.gitignore是否生效
git check-ignore -v uploads data logs reports .env

# 如果没有生效，检查.gitignore文件
cat .gitignore
```

### 问题：运行时找不到配置文件

```bash
# 检查.env是否存在
ls -la ~/Documents/amazon-runtime/.env

# 检查软链接是否正确
ls -la .env

# 测试读取
cat .env
```

---

**最后更新**: 2025-12-25
**维护者**: LiYe OS Team
