# Geo Pipeline Websites（源码目录）

**本质：** 📝 **设计图纸**（源码 + 模板 + 生成规则）
**层级：** 能力层（类型）

---

## 📋 目录说明

本目录存放所有 Geo Pipeline 生成的垂类网站**源码**，遵循 [架构宪法](../_meta/docs/DIRECTORY_NAMING_CONSTITUTION.md) 定义的语义规则。

### 语义定义

```
websites/ = "我能生产网站"（能力声明）
```

**特点：**
- ✅ **必须入 Git**（这是核心资产）
- ❌ **删除了就真的没了**（除非 Git 能恢复）
- ✅ 从这里 `npm run build` 生成到 `~/websites/`

---

## 🏗️ 目录结构

```
websites/
├── _templates/              # 模板库
│   ├── astro-affiliate/     # 联盟营销 Astro 模板
│   └── astro-minimal/       # 最小化 Astro 模板
│
├── kuachu/                  # 跨境电商网站 (kuachu.com)
├── zhangxiang/              # 亚马逊代运营官网 (zhangxiang.com)
└── ... (未来更多网站)
```

---

## 🚀 工作流

### 新建网站（推荐：Contract + Builder）

```bash
# 1. 创建 Astro 项目
cd ~/github/liye_os/websites/
npx create astro@latest new-site --template minimal

# 2. 创建 Contract（定义品牌、颜色、字体）
mkdir -p ~/github/liye_os/tracks/new-site
# 编辑 tracks/new-site/site-design.contract.yaml
# 可使用 ui-ux Skill 获取建议：
# python Skills/00_Core_Utilities/development-tools/ui-ux/scripts/search.py "SaaS modern" --domain style

# 3. 生成主题
cd ~/github/liye_os
npx tsx builders/theme-factory/builder.ts new-site
# → 输出到 tracks/new-site/dist/theme.css

# 4. 集成主题到 Astro 项目
# 将 theme.css 内容复制到 new-site/src/styles/global.css

# 5. 开发
cd websites/new-site
npm run dev

# 6. 构建
npm run build

# 7. 部署
vercel deploy --prod
```

### 新建网站（简单模式）

```bash
# 1. 进入源码目录
cd ~/github/liye_os/websites/

# 2. 创建新站点（使用 Astro）
npm create astro@latest new-site

# 3. 配置构建输出
# 编辑 new-site/astro.config.mjs
# outDir: ~/websites/new-site/dist/

# 4. 开发
cd new-site
npm run dev

# 5. 构建（自动输出到 ~/websites/new-site/dist/）
npm run build

# 6. 部署
vercel deploy --prod
```

---

### 更新已有网站

```bash
# 修改源码
cd ~/github/liye_os/websites/existing-site/
# 修改代码...

# 构建
npm run build  # → ~/websites/existing-site/dist/

# 部署
vercel deploy --prod
```

---

## ⚠️ 重要提醒

### ❌ 不要做的事

1. **不要直接修改构建产物**
   ```bash
   # ❌ 错误
   cd ~/websites/existing-site/dist/
   # 修改 HTML... ← 下次构建会丢失！
   ```

2. **不要把构建产物提交到 Git**
   - `dist/`、`node_modules/` 已在 `.gitignore` 中
   - 如果意外提交，会被 Git Hooks 阻止

3. **不要在此目录外创建 Geo Pipeline 网站**
   - 所有 Geo Pipeline 网站源码必须在此目录
   - 独立项目放在 `~/github/sites/` 或其他独立仓库

---

## 📁 与其他目录的关系

| 目录 | 作用 | 关系 |
|------|------|------|
| `websites/` | 📝 Astro 源码 | **你在这里** |
| `tracks/<site>/` | 📋 Contract + 生成物 | 定义品牌、生成主题 |
| `builders/` | 🔧 Builder 工具 | 从 Contract 生成 CSS |
| `Skills/.../ui-ux/` | 💡 设计建议 | 辅助填写 Contract |

---

## 🔗 参考文档

- [Builder 接口规范](../builders/INTERFACE.md)
- [UI/UX Skill](../Skills/00_Core_Utilities/development-tools/ui-ux/SKILL.md)
- [架构宪法](../_meta/docs/DIRECTORY_NAMING_CONSTITUTION.md)

---

**版本：** 2.0
**最后更新：** 2026-01-14
