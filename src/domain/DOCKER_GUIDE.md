# Docker 使用指南（小白版）

## 这是什么？

把 Amazon Growth OS 装进一个"便当盒"（Docker），带去任何电脑都能用。

```
┌─────────────────────────────────────────────────────────┐
│                    Docker 便当盒                         │
│                                                         │
│   🐍 Python + 所有依赖                                  │
│   📊 Streamlit 仪表盘                                   │
│   🗄️ Qdrant 知识库                                      │
│   🤖 CrewAI 多智能体                                    │
│   📁 你的配置和数据                                      │
│                                                         │
│   打开盖子就能用！                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 第一步：安装 Docker（买便当盒）

### Mac 用户

1. 打开浏览器，访问：https://www.docker.com/products/docker-desktop/
2. 点击 "Download for Mac"
3. 双击下载的 `.dmg` 文件
4. 把 Docker 图标拖到 Applications 文件夹
5. 打开 Docker Desktop（第一次要等几分钟）
6. 看到顶部菜单栏出现 🐳 鲸鱼图标 = 安装成功！

### Windows 用户

1. 同上，下载 Windows 版本
2. 双击安装，一路 Next
3. 可能需要重启电脑
4. 打开 Docker Desktop

### 验证安装

打开终端（Mac）或命令提示符（Windows），输入：

```bash
docker --version
```

看到类似 `Docker version 24.0.7` = 成功！

---

## 第二步：配置密钥（准备食材）

在使用前，需要设置你的 API 密钥。

### 方法 A：创建 .env 文件（推荐）

```bash
# 进入项目目录
cd ~/Documents/liye_workspace/LiYe_OS/Systems/amazon-growth-os

# 复制模板
cp .env.example .env

# 编辑 .env 文件，填入你的密钥
nano .env  # 或用任何文本编辑器打开
```

需要填写的内容：
```
ANTHROPIC_API_KEY=<YOUR_ANTHROPIC_API_KEY>
SELLERSPRITE_API_KEY=你的卖家精灵密钥（可选）
```

### 方法 B：在命令中直接传入

```bash
ANTHROPIC_API_KEY=sk-ant-xxx docker-compose up
```

---

## 第三步：启动服务（开吃！）

### 一键启动

```bash
# 进入项目目录
cd ~/Documents/liye_workspace/LiYe_OS/Systems/amazon-growth-os

# 启动所有服务
docker-compose up -d
```

### 发生了什么？

```
你输入：docker-compose up -d

Docker 开始工作：
├── 📦 下载 Python 环境镜像（第一次，约 2-5 分钟）
├── 📦 下载 Qdrant 镜像（第一次，约 1-2 分钟）
├── 🔧 安装所有依赖（第一次，约 3-5 分钟）
├── 🚀 启动 Qdrant 数据库
└── 🚀 启动 Dashboard 仪表盘

完成后显示：
✔ Container amazon-growth-qdrant    Started
✔ Container amazon-growth-dashboard Started
```

### 访问服务

打开浏览器，访问：**http://localhost:8501**

你会看到 Amazon Growth OS 仪表盘！

---

## 常用命令（便当盒操作手册）

### 查看状态（便当盒里有什么？）

```bash
docker-compose ps
```

输出示例：
```
NAME                        STATUS    PORTS
amazon-growth-dashboard     running   0.0.0.0:8501->8501/tcp
amazon-growth-qdrant        running   0.0.0.0:6333->6333/tcp
```

### 查看日志（便当盒里发生了什么？）

```bash
# 看所有日志
docker-compose logs

# 只看 Dashboard 日志
docker-compose logs dashboard

# 实时跟踪日志
docker-compose logs -f
```

### 停止服务（盖上便当盒）

```bash
docker-compose down
```

### 重启服务（重新加热）

```bash
docker-compose restart
```

### 完全清理（清洗便当盒）

```bash
# 停止并删除容器
docker-compose down

# 删除数据卷（谨慎！会删除知识库数据）
docker-compose down -v
```

---

## 运行分析任务（使用便当盒里的工具）

### 方式 1：通过 Dashboard 界面

1. 打开 http://localhost:8501
2. 在界面上操作

### 方式 2：通过命令行

```bash
# 运行 Launch 模式（新品开发）
docker-compose run --rm cli main.py --mode launch --product "Yoga Mat"

# 运行 Optimize 模式（老品优化）
docker-compose run --rm cli main.py --mode optimize --asin "B0C5Q9Y6YF"

# 运行任意 Python 脚本
docker-compose run --rm cli tools/analyze_ca_comprehensive.py
```

---

## 在新电脑上使用（搬家指南）

### 打包带走

需要带走的"行李"：
```
必须带：
├── .env              # API 密钥
├── data/             # 你的数据（可选，也可以重新生成）
└── config/*.yaml     # 自定义配置（如果改过）

不用带（Docker 会自动下载）：
├── Python
├── 所有依赖库
├── Qdrant 数据库
└── 代码（从 Git 克隆）
```

### 新电脑设置步骤

```bash
# 1. 安装 Docker Desktop（见第一步）

# 2. 克隆代码
git clone git@github.com:YOUR_USERNAME/LiYe_OS.git
cd LiYe_OS/Systems/amazon-growth-os

# 3. 复制你的 .env 文件（从备份或重新创建）
cp /path/to/backup/.env .

# 4. 启动！
docker-compose up -d

# 5. （可选）重建知识库索引
docker-compose run --rm cli scripts/incremental_index.py

# 完成！打开 http://localhost:8501 开始使用
```

---

## 故障排除（便当盒出问题了？）

### 问题 1：端口被占用

```
Error: port 8501 is already in use
```

**解决**：
```bash
# 查看谁占用了端口
lsof -i :8501

# 杀掉占用的进程
kill -9 <PID>

# 或者换个端口
# 编辑 docker-compose.yaml，把 8501:8501 改成 8502:8501
```

### 问题 2：Docker 没启动

```
Cannot connect to Docker daemon
```

**解决**：打开 Docker Desktop 应用程序，等鲸鱼图标出现

### 问题 3：内存不足

```
Error: out of memory
```

**解决**：
1. 打开 Docker Desktop → Settings → Resources
2. 把 Memory 调高到 4GB 或以上

### 问题 4：第一次启动很慢

**正常！** 第一次需要下载镜像和安装依赖，约 5-10 分钟。后续启动只需几秒。

### 问题 5：API 密钥无效

```
Invalid API key
```

**解决**：检查 `.env` 文件中的密钥是否正确，没有多余空格

---

## 进阶：自定义配置

### 修改端口

编辑 `docker-compose.yaml`：

```yaml
services:
  dashboard:
    ports:
      - "9999:8501"  # 改成 9999 端口
```

### 持久化知识库

知识库数据默认保存在 Docker volume 中。如果想保存到本地：

```yaml
services:
  qdrant:
    volumes:
      - ./qdrant_data:/qdrant/storage  # 保存到当前目录
```

---

## 总结：三条命令搞定

```bash
# 启动
docker-compose up -d

# 访问
open http://localhost:8501

# 停止
docker-compose down
```

就这么简单！🎉
