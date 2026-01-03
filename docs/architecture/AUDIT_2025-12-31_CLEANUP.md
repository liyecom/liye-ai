=== P-1: 引用扫描审计 ===
生成时间: Thu Jan  1 10:00:12 CST 2026

## 1. src/domain/src/ 引用扫描
```
无 Python 引用
```

## 2. src/domain/agents/ 引用扫描
```
无引用
```

## 3. config/agents.yaml 引用扫描
```
./_meta/docs/ARCHITECTURE_CONSTITUTION.md:254:│   ├── agents.yaml           # Agent 定义（系统内部）
./docs/methodology/06_Technical_Development/CrewAI_Multi_Agent_Framework/templates/seo_content_activation.md:40:- `agents.yaml` - Agent configurations
./docs/methodology/06_Technical_Development/CrewAI_Multi_Agent_Framework/templates/amazon_keyword_activation.md:40:- `agents.yaml` - Agent configurations
./docs/methodology/06_Technical_Development/CrewAI_Multi_Agent_Framework/templates/medical_research_activation.md:40:- `agents.yaml` - Agent configurations
./docs/architecture/TRI_FORK_IMPLEMENTATION.md:140:/crewai 生成 agents.yaml 配置
./docs/architecture/TRI_FORK_IMPLEMENTATION.md:275:| **生成 YAML 配置** | Claude Code | `/crewai 生成 agents.yaml` |
./src/domain/SOP_操作手册.md:414:    ├── agents.yaml        ← AI 员工配置
./src/domain/docs/系统架构说明.md:405:│   ├── agents.yaml                 ← 9个智能体定义
./src/domain/main.py:44:    agents_config = load_config('config/agents.yaml')
./src/domain/amazon-growth/docs/系统架构说明.md:405:│   ├── agents.yaml                 ← 9个智能体定义
./src/domain/amazon-growth/main.py:274:    agents_config = load_config(str(config_dir / 'agents.yaml'))
```

## 4. Agents/ 目录引用扫描
```
./Crews/_template.yaml:16:    agent_id: orchestrator        # Reference to Agents/*.yaml
./.claude/skills/liye-agent.md:24:1. Copy `Agents/_template.yaml` to `Agents/core/` or `Agents/domain/`
./Agents/README.md:12:Agents/
./_meta/docs/ARCHITECTURE_CONSTITUTION.md:76:├── Agents/                   # 智能体定义（原子）
./_meta/docs/ARCHITECTURE_CONSTITUTION.md:141:             Agents/   ┌─────────────────────────────┐
./_meta/docs/ARCHITECTURE_CONSTITUTION.md:320:│  🤖 单个 AI 角色定义             → Agents/                  │
./_meta/docs/FILE_SYSTEM_GOVERNANCE.md:205:├── Agents/                   # 🔴 空目录 - 移除或合并
./_meta/docs/FILE_SYSTEM_GOVERNANCE.md:748:| `Agents/` | (删除) | 移除空目录 |
./docs/a private repository/v4.2/WORKFLOW_v4.2.md:124:├── Agents/amazon-growth/
./docs/architecture/AGENT_SPEC.md:44:Agents/
./docs/architecture/BOUNDARY_DEHYDRATION.md:47:│                    Agents/ (execution only)                  │
./docs/architecture/BOUNDARY_DEHYDRATION.md:205:**Scope:** `Agents/`
./docs/architecture/BOUNDARY_DEHYDRATION.md:221:if grep -rn "bmaddata:" Agents/ src/agents/ src/runtime/ 2>/dev/null; then
./docs/architecture/BOUNDARY_DEHYDRATION.md:246:  - Agents/
./docs/architecture/BOUNDARY_DEHYDRATION.md:259:| 2025-12-30 | 13 BMAD leaks in Agents/ | See `docs/incidents/2025-12-bmad-boundary/` | Batch dehydration |
./docs/architecture/NAMING.md:107:  - `Agents/`
./docs/architecture/DIRECTORY_STRUCTURE.md:13:├── Agents/               # Agent 定义 - 13个 YAML 配置
./docs/architecture/DIRECTORY_STRUCTURE.md:75:│  位置: /src/domain/ + /Agents/ + /Crews/                    │
./docs/architecture/DIRECTORY_STRUCTURE.md:115:/Agents/
./docs/architecture/DIRECTORY_STRUCTURE.md:348:4. **YAML声明式**: Agents/Crews/Tasks 用 YAML 定义，与运行时代码分离
./docs/incidents/2025-12-bmad-boundary/leaks_index.md:27:| 1 | `Agents/amazon-growth/sprint-orchestrator.yaml` | 4 | `title: 3-Day Sprint Orchestration Master (BMAD Integrated)` | Remove "(BMAD Integrated)" |
./docs/incidents/2025-12-bmad-boundary/leaks_index.md:28:| 2 | `Agents/amazon-growth/sprint-orchestrator.yaml` | 11 | `role: BMad Master / Scrum Orchestrator` | Change to "Sprint Orchestrator" |
./docs/incidents/2025-12-bmad-boundary/leaks_index.md:34:| 3 | `Agents/_template.yaml` | 11 | `# Persona Layer (WHO) - from BMad Method` | Remove "- from BMad Method" |
./docs/incidents/2025-12-bmad-boundary/leaks_index.md:35:| 4 | `Agents/README.md` | 33 | `persona:           # WHO - from BMad Method` | Remove "- from BMad Method" |
./docs/incidents/2025-12-bmad-boundary/leaks_index.md:41:| 5 | `Agents/amazon-growth/sprint-orchestrator.yaml` | 77 | `- uri: file://~/.npm/_npx/.../bmad-method/` | Remove entire URI reference |
./docs/incidents/2025-12-bmad-boundary/leaks_index.md:47:| 6 | `Agents/amazon-growth/market-analyst.yaml` | 64 | `bmaddata:` | Remove entire bmaddata block |
./docs/incidents/2025-12-bmad-boundary/leaks_index.md:48:| 7 | `Agents/amazon-growth/quality-gate.yaml` | 44 | `bmaddata:` | Remove entire bmaddata block |
./docs/incidents/2025-12-bmad-boundary/leaks_index.md:49:| 8 | `Agents/amazon-growth/execution-agent.yaml` | 57 | `bmaddata:` | Remove entire bmaddata block |
./docs/incidents/2025-12-bmad-boundary/leaks_index.md:50:| 9 | `Agents/amazon-growth/keyword-architect.yaml` | 67 | `bmaddata:` | Remove entire bmaddata block |
./docs/incidents/2025-12-bmad-boundary/leaks_index.md:51:| 10 | `Agents/amazon-growth/review-sentinel.yaml` | 50 | `bmaddata:` | Remove entire bmaddata block |
```

## 5. 目录快照（删除前）

### src/domain/src/ 文件列表
```
      47
个 Python 文件
1.4M	src/domain/src
```

### src/domain/agents/ 文件列表
```
total 80
drwxr-xr-x@ 11 liye  staff   352 Dec 27 12:05 .
drwxr-xr-x@ 39 liye  staff  1248 Dec 31 03:00 ..
-rw-------@  1 liye  staff  3168 Dec 27 12:04 diagnostic-architect.yaml
-rw-------@  1 liye  staff  2754 Dec 27 12:04 execution-agent.yaml
-rw-------@  1 liye  staff  3696 Dec 27 12:02 keyword-architect.yaml
-rw-------@  1 liye  staff  3389 Dec 27 12:02 listing-optimizer.yaml
-rw-------@  1 liye  staff  3269 Dec 27 12:01 market-analyst.yaml
-rw-------@  1 liye  staff  3533 Dec 27 12:04 ppc-strategist.yaml
-rw-------@  1 liye  staff  2808 Dec 27 12:05 quality-gate.yaml
-rw-------@  1 liye  staff  3096 Dec 27 12:05 review-sentinel.yaml
-rw-------@  1 liye  staff  4423 Dec 27 12:05 sprint-orchestrator.yaml
```

## 6. 审计结论

| 目录 | 文件数 | 大小 | 引用数 | 可删除 |
|------|--------|------|--------|--------|
| src/domain/src/ | 47 .py | 1.4MB | 0 | ✅ 是 |
| src/domain/agents/ | 9 .yaml | 40KB | 0 | ✅ 是 |
| src/domain/config/agents.yaml | 1 | 2KB | 2 | ⚠️ 需迁移 |

**config/agents.yaml 被引用于：**
- src/domain/main.py:44
- src/domain/amazon-growth/main.py:274
