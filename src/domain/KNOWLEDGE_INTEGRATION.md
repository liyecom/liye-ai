# 知识库集成架构

## 📊 当前环境

**已安装组件**:
- ✅ Qdrant 向量数据库 (localhost:6333)
- ✅ Ollama (nomic-embed-text 模型)
- ✅ Obsidian (~/Documents/Obsidian Vault)
- ✅ sentence-transformers (all-MiniLM-L6-v2)
- ✅ Amazon 知识库 (389 MD 文件, 3263 chunks)

**待集成组件**:
- ⚠️ Supermemory (可选，需要安装)

---

## 🎯 集成目标

### 统一知识检索层

```
┌─────────────────────────────────────────────────────────┐
│ AI Agents (CrewAI / Claude / Gemini)                    │
│ ├─ amazon-operations-crew                               │
│ └─ 其他 Skills                                           │
├─────────────────────────────────────────────────────────┤
│ 统一知识检索 API                                         │
│ (UnifiedKnowledgeRetriever)                             │
├─────────────────────────────────────────────────────────┤
│ 知识源层 (Knowledge Sources)                             │
│ ├─ Amazon 知识库 (~/Documents/出海跨境/Amazon/)          │
│ ├─ Obsidian Vault (~/Documents/Obsidian Vault/)        │
│ ├─ LiYe OS Skills (~/Documents/liye_workspace/LiYe_OS/) │
│ └─ Supermemory (可选)                                    │
├─────────────────────────────────────────────────────────┤
│ 向量化层 (Vector Layer)                                  │
│ ├─ Qdrant Collections:                                 │
│ │  ├─ amazon_knowledge_base (现有)                      │
│ │  ├─ obsidian_vault (新增)                             │
│ │  └─ liye_os_skills (新增)                             │
│ └─ Embedding 引擎:                                       │
│    ├─ Ollama (nomic-embed-text) - 优先                  │
│    └─ sentence-transformers - 备用                      │
└─────────────────────────────────────────────────────────┘
```

---

## 📅 三阶段实施计划

### Phase 1: Ollama Embedding 集成（1-2 小时）

**目标**: 使用 Ollama 替换 sentence-transformers，实现零 API 成本

**优势**:
- ✅ 零成本（本地运行）
- ✅ 更好的语义理解
- ✅ 支持多语言（nomic-embed-text）
- ✅ 统一 embedding 引擎

**实施步骤**:

1. **创建 Ollama Embedder**
   ```python
   # tools/ollama_embedder.py
   import requests

   class OllamaEmbedder:
       def __init__(self, model="nomic-embed-text"):
           self.model = model
           self.base_url = "http://localhost:11434"

       def embed_text(self, text: str) -> list[float]:
           response = requests.post(
               f"{self.base_url}/api/embeddings",
               json={"model": self.model, "prompt": text}
           )
           return response.json()["embedding"]
   ```

2. **更新 incremental_index.py**
   - 替换 SimpleEmbedder 为 OllamaEmbedder
   - 添加 fallback 机制（Ollama 不可用时使用 sentence-transformers）

3. **重建向量索引**（一次性）
   ```bash
   # 备份现有索引
   docker exec amazon-kb-qdrant \
     tar czf /qdrant/storage/backup_$(date +%Y%m%d).tar.gz /qdrant/storage/collections

   # 重建索引（使用 Ollama embeddings）
   NO_PROXY=localhost,127.0.0.1 python scripts/rebuild_with_ollama.py
   ```

**预期效果**:
- Embedding 质量提升 10-15%
- 处理速度：~100-150 条/秒（Mac Studio M2 Ultra）

---

### Phase 2: Obsidian Vault 集成（2-3 小时）

**目标**: 将 Obsidian 笔记纳入统一知识库，支持 wikilinks 和标签

**Obsidian 特性**:
- Wikilinks: `[[另一篇笔记]]`
- 标签: `#amazon #广告优化`
- 双向链接
- Dataview 查询（如果已安装插件）

**实施步骤**:

1. **创建 Obsidian Source Reader**
   ```python
   # tools/obsidian_reader.py
   class ObsidianReader:
       def __init__(self, vault_path: Path):
           self.vault_path = vault_path

       def scan_notes(self) -> list[dict]:
           """扫描所有笔记，提取元数据"""
           notes = []
           for md_file in self.vault_path.rglob("*.md"):
               content = md_file.read_text()

               # 提取 frontmatter (YAML)
               frontmatter = self._extract_frontmatter(content)

               # 提取 wikilinks
               wikilinks = self._extract_wikilinks(content)

               # 提取标签
               tags = self._extract_tags(content)

               notes.append({
                   'path': md_file,
                   'content': content,
                   'frontmatter': frontmatter,
                   'wikilinks': wikilinks,
                   'tags': tags
               })

           return notes
   ```

2. **创建 Obsidian Collection**
   ```python
   # scripts/index_obsidian_vault.py
   qdrant.recreate_collection(
       collection_name="obsidian_vault",
       vectors_config=VectorParams(
           size=768,  # nomic-embed-text dimension
           distance=Distance.COSINE
       )
   )
   ```

3. **索引 Obsidian 笔记**
   ```bash
   NO_PROXY=localhost,127.0.0.1 python scripts/index_obsidian_vault.py \
     --vault ~/Documents/Obsidian\ Vault/
   ```

4. **自动监听更新**（可选）
   - 使用 fswatch (macOS) 监听文件变化
   - 自动增量索引修改的笔记

**Metadata 设计**:
```python
payload = {
    'source': 'obsidian',
    'file_path': relative_path,
    'vault_name': 'Obsidian Vault',
    'tags': ['#amazon', '#广告优化'],
    'wikilinks': ['[[PPC策略]]', '[[关键词研究]]'],
    'created_at': frontmatter.get('created'),
    'modified_at': file_stat.st_mtime,
    'text_preview': content[:300]
}
```

---

### Phase 3: 统一检索接口（1-2 小时）

**目标**: 创建单一 API 同时检索所有知识源

**实施步骤**:

1. **创建统一检索工具**
   ```python
   # tools/unified_knowledge_retriever.py
   from crewai.tools import BaseTool

   class UnifiedKnowledgeRetriever(BaseTool):
       name: str = "Search Unified Knowledge Base"
       description: str = """统一检索所有知识源:
       - Amazon 运营知识库 (3263 chunks)
       - Obsidian 个人笔记
       - LiYe OS Skills 模板

       使用语义搜索，返回最相关的 5 条结果"""

       def __init__(self):
           self.qdrant = QdrantClient(url="http://localhost:6333")
           self.embedder = OllamaEmbedder(model="nomic-embed-text")

       def _run(self, query: str, sources: list[str] = None) -> str:
           """
           query: 搜索查询
           sources: 限定知识源 ['amazon', 'obsidian', 'skills']
                   None = 搜索全部
           """
           # 生成查询向量
           query_vector = self.embedder.embed_text(query)

           results = []

           # 搜索 Amazon 知识库
           if sources is None or 'amazon' in sources:
               amazon_results = self.qdrant.search(
                   collection_name="amazon_knowledge_base",
                   query_vector=query_vector,
                   limit=3
               )
               results.extend(self._format_results(amazon_results, 'Amazon'))

           # 搜索 Obsidian 笔记
           if sources is None or 'obsidian' in sources:
               obsidian_results = self.qdrant.search(
                   collection_name="obsidian_vault",
                   query_vector=query_vector,
                   limit=2
               )
               results.extend(self._format_results(obsidian_results, 'Obsidian'))

           # 按相关度排序
           results.sort(key=lambda x: x['score'], reverse=True)

           # 返回 Top 5
           return self._format_output(results[:5])
   ```

2. **集成到 amazon-operations-crew**
   ```python
   # main.py
   from tools.unified_knowledge_retriever import UnifiedKnowledgeRetriever

   # 替换现有的 QdrantKnowledgeTool
   unified_kb = UnifiedKnowledgeRetriever()

   analyst = Agent(
       config=agents_config['keyword_analyst'],
       tools=[unified_kb, ss_tool],  # 使用统一检索
       llm=claude_model_name
   )
   ```

---

## 🔄 Supermemory 集成（可选，第四阶段）

**仅在以下情况下考虑**:
- 需要 Web UI 管理知识
- 需要与团队共享知识
- 需要 Chrome 插件捕获网页内容

**集成方式**:

### 选项 A: Supermemory 作为独立系统

```bash
# 安装 Supermemory
docker run -d \
  --name supermemory \
  -p 3000:3000 \
  -v supermemory_data:/app/data \
  ghcr.io/supermemoryai/supermemory:latest
```

**优势**: 独立管理，Web UI
**劣势**: 数据冗余，需要双向同步

### 选项 B: Supermemory 使用 Qdrant 作为后端（推荐）

修改 Supermemory 配置，指向现有 Qdrant 实例：

```yaml
# supermemory config
vector_db:
  type: qdrant
  url: http://localhost:6333
  collection_prefix: "supermemory_"
```

**优势**: 数据统一，无冗余
**劣势**: 需要修改 Supermemory 配置

---

## 📊 集成后的使用场景

### 场景 1: Amazon 运营 Agent 查询跨域知识

```python
# Agent 在分析关键词时，同时参考：
# 1. Amazon 广告打法知识库
# 2. Obsidian 中的个人运营笔记
# 3. LiYe OS 中的 SOP 模板

unified_kb.search(
    query="如何降低高客单价产品的 ACOS",
    sources=['amazon', 'obsidian']  # 只搜索这两个源
)

# 返回结果示例：
# 1. [Amazon] 下降20%！高客单价产品ACOS优化打法.md (相关度 89%)
# 2. [Obsidian] 2025-11-20 Timo 客单价优化实验.md (相关度 76%)
# 3. [Amazon] 亚马逊CPC广告10大策略技巧.md (相关度 72%)
```

### 场景 2: Obsidian 作为知识输入，自动同步到 Qdrant

```bash
# 在 Obsidian 中创建新笔记：
# ~/Documents/Obsidian Vault/Amazon/2025-12-21 新品推广实验.md

# 自动触发索引（如果启用了 fswatch）
# 或者明天凌晨 2:00 自动索引
```

### 场景 3: 跨 Skills 知识共享

```python
# Medical Research Analyst Skill 查询 Amazon 知识库中的案例研究方法
# （虽然是医疗领域，但可以借鉴 Amazon 的数据分析方法）

unified_kb.search(
    query="如何进行竞品数据分析",
    sources=['amazon', 'skills']
)
```

---

## 🛠️ 维护和更新

### 自动索引任务

**Amazon 知识库**: 每天凌晨 2:00（已配置）
```bash
./scripts/manage_auto_index.sh status
```

**Obsidian Vault**: 需要配置（第二阶段）
```bash
# 创建类似的 launchd 任务
./scripts/manage_obsidian_auto_index.sh install
```

### 手动重建索引

```bash
# 重建所有索引
./scripts/rebuild_all_indexes.sh

# 只重建特定 collection
NO_PROXY=localhost,127.0.0.1 python scripts/rebuild_index.py \
  --collection obsidian_vault
```

---

## 📈 性能基准

| 操作 | 当前 (sentence-transformers) | 目标 (Ollama) |
|------|----------------------------|---------------|
| Embedding 速度 | ~200 条/秒 | ~100-150 条/秒 |
| Embedding 质量 | 基准 | +10-15% |
| 存储成本 | 0 (本地) | 0 (本地) |
| 查询延迟 | ~50ms | ~80ms |
| 多语言支持 | 一般 | 优秀 |

---

## 🎯 下一步行动

**立即可做** (推荐顺序):

1. **Phase 1**: Ollama 集成（提升质量，2 小时）
   - 创建 `tools/ollama_embedder.py`
   - 测试 embedding 质量对比
   - 决定是否迁移

2. **Phase 2**: Obsidian 集成（扩展知识源，3 小时）
   - 创建 `tools/obsidian_reader.py`
   - 索引现有 Obsidian 笔记
   - 配置自动更新

3. **Phase 3**: 统一检索（简化使用，1 小时）
   - 创建 `UnifiedKnowledgeRetriever` 工具
   - 集成到 amazon-operations-crew
   - 测试跨源检索

**可选**:
4. **Phase 4**: Supermemory（如果需要 Web UI）

---

## 📝 相关文档

- `AUTO_INDEX_README.md` - Amazon 知识库自动索引系统
- `tools/qdrant_kb_tool.py` - 当前 Qdrant 检索工具
- `tools/simple_embedder.py` - 当前 embedding 引擎
- `scripts/incremental_index.py` - 增量索引脚本
