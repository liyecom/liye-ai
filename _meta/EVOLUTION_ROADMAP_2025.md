# LiYe OS Evolution Roadmap 2025-2026

**Vision**: Build a self-evolving personal operating system powered by dual AI engines (Claude Code + Antigravity)

**Last Updated**: 2026-04-17
**Status**: Active Planning

---

## 🔒 Phase Status

| Phase | Component | Status | Tag |
|-------|-----------|--------|-----|
| **P1** | Governance Gateway | **CLOSED** | `integration-dify-gateway-v1.1.0` |

> **P1 Governance Gateway: CLOSED.** No new features until P2 approved.
> - Public endpoint: `https://gateway.liye.ai`
> - Runbook: `docs/ops/RUNBOOK_GATEWAY.md`
> - Dify integration verified (ALLOW/BLOCK scenarios)

---

## 🧭 BGHS Track (2026-04-)

> **双轨并存**：此 section 与上方 2025 Governance Gateway 轨道**正交**——「P1」等编号在两条轨道里含义不同，不得混用。BGHS Track 的 P 编号是 **Capability Harvest + Contract ADR 批次**，不是 Gateway 里程碑。

### 轨道定义

- **主题**：BGHS 四分类（Brain / Governance / Hands / Session）体系落地 + 参考项目（OpenClaw / Hermes / AGE）能力收割
- **SSOT**：`_meta/adr/` 所有 `ADR-*-*.md`（YAML frontmatter 体系，**不是** 旧 MaaP `- decision_id: ADR-XXXX` 格式）
- **ADR validator**：`.claude/scripts/validate_adr_bghs.mjs`（本 Track 专用，**不**复用 `validate_adr.mjs`）

### P1 批次 · Capability Harvest + Contract ADR（已封板 2026-04-17）

**Status**: SEALED ✅ · Accepted on 2026-04-17

| ID | ADR 文件 | Role | Target Layer |
|---|---|---|---|
| Doctrine | [ADR-Architecture-Doctrine-BGHS-Separation.md](./adr/ADR-Architecture-Doctrine-BGHS-Separation.md) | doctrine | cross |
| P1-a | [ADR-OpenClaw-Capability-Boundary.md](./adr/ADR-OpenClaw-Capability-Boundary.md) | harvest | 0 |
| P1-b | [ADR-Hermes-Skill-Lifecycle.md](./adr/ADR-Hermes-Skill-Lifecycle.md) | harvest | cross |
| P1-c | [ADR-Hermes-Memory-Orchestration.md](./adr/ADR-Hermes-Memory-Orchestration.md) | harvest | 1 |
| P1-d | [ADR-Loamwise-Guard-Content-Security.md](./adr/ADR-Loamwise-Guard-Content-Security.md) | harvest | 1 |
| P1-e | [ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query.md](./adr/ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query.md) | contract | cross |
| P1-f | [ADR-Credential-Mediation.md](./adr/ADR-Credential-Mediation.md) | contract | cross |
| P1-g | [ADR-AGE-Wake-Resume.md](./adr/ADR-AGE-Wake-Resume.md) | contract | 2 |

**历史参考**（Superseded 2026-04-17，保留为审计痕迹，不再生效）：

| 旧 ADR | Superseded-By |
|---|---|
| ADR-004-OpenClaw-Capability-Boundary.md | ADR-OpenClaw-Capability-Boundary.md |
| ADR-005-Hermes-Skill-Lifecycle.md | ADR-Hermes-Skill-Lifecycle.md |
| ADR-006-Hermes-Memory-Orchestration.md | ADR-Hermes-Memory-Orchestration.md |
| ADR-007-Loamwise-Guard-Content-Security.md | ADR-Loamwise-Guard-Content-Security.md |

### 实施阶段 · Sprint 0 → Sprint 7

封板后的实施顺序严格按下表执行（非概念顺序，是**代码库实况兼容的施工顺序**）：

| Sprint | 内容 | 关键路径 | 前置 |
|---|---|---|---|
| **0** | Baseline 收口：roadmap + `validate_adr_bghs.mjs` + 未提交代码盘点 | `_meta/`, `.claude/scripts/`, `.planning/baseline/` | — |
| **1** | AGE 恢复闭环（P1-e StreamRegistry + P1-g wake validator + 3 store `--diff`） | `src/runtime/governance/session/`, `src/runtime/governance/wake/`, `/Users/liye/github/amazon-growth-engine/scripts/onboarding/_lib/wake_contract.py` | Sprint 0.3 |
| **2** | P1-f CredentialBroker seam + env hygiene gate | `src/runtime/credential/`, `.claude/.githooks/pre-commit` (Check 7), `.github/workflows/env-hygiene-gate.yml` | — |
| **3** | P1-d Guard runtime skeleton（**不接线**） | `src/runtime/governance/guard/`（evidence 走 `src/audit/evidence/`） | — |
| **4** | P1-a BGHS CapabilityRegistry + README 硬边界 | `src/runtime/governance/capability/`（**不动** `src/control/registry.ts`） | — |
| **5** | P1-b Skill Lifecycle + Guard 接线-1（skill candidate submit） | `src/runtime/governance/skill_lifecycle/`（**不动** `src/skill/`） | Sprint 3 |
| **6** | P1-c Memory frozen + Guard 接线-2（memory write / assembly fragment ingest） | `src/runtime/governance/memory/`（**不动** `src/memory/`） | Sprint 3 |
| **7** | Guard escalation 评审（SHADOW → ADVISORY） | 数据驱动；前置 Sprint 3 shadow ≥ 1 周数据 | Sprint 3, 5, 6 |

### 架构硬约束（跨 Sprint 不变）

1. **新 BGHS runtime 统一落 `src/runtime/governance/`**（不动 `src/control/` / `src/skill/` / `src/memory/` / `src/brokers/`——这些目录已有不同语义的占位者）
2. **`src/runtime/governance/capability/` ⇎ `src/control/registry.ts` 不得跨 import**（BGHS capability vs AI agent capability，语义不同）
3. **Evidence 只有一套基建**：`src/audit/evidence/`（不得建第三套 mjs/ts 变体）
4. **P2 Guard 必须 SHADOW → ADVISORY → ACTIVE 逐级升级**（P1-d §5 强制）
5. **P3 学习环必须 quarantine-first**（P1-b 强制）
6. **P4 检索默认 strict_truth**（P1-c / P1-e 强制）

### Track 版本

- v1.0（2026-04-17）：P1 封板 · 8 ADR Accepted · 4 ADR Superseded · Sprint 0–7 计划就绪

---

## 🎯 Strategic Goals

### Q1 2025 (Dec-Feb): Foundation & Tooling
**Theme**: "Build the Builder"

**Goal**: Establish robust AI collaboration workflow and core infrastructure

**Key Projects**:
1. ✅ **Antigravity Setup** (Week 1) - COMPLETED
   - Configure Proxifier for China access
   - Establish Google account authentication
   - Verify Gemini 3 access

2. **Notion Enhanced Sync** (Week 2-3)
   - Build real-time dashboard
   - Improve categorization with ML
   - Add conflict resolution UI
   - **Lead**: Claude Code → Antigravity → Claude Code

3. **Skills System v2** (Week 4-5)
   - Create skill generation pipeline
   - Build 5 priority skills:
     - Amazon Optimization Expert
     - TikTok Content Strategist
     - Medical Research Analyst (v2)
     - AI Tool Researcher
     - Personal Growth Coach
   - **Lead**: Claude Code (design) → Antigravity (parallel creation) → Claude Code (quality)

4. **LiYe OS CLI** (Week 6-8)
   - Unified command interface
   - `liye sync` - Notion sync
   - `liye skill [name]` - Activate skill
   - `liye evolve` - Knowledge sedimentation
   - `liye dashboard` - System overview
   - **Lead**: Antigravity (CLI framework) → Claude Code (business logic)

**Success Metrics**:
- [ ] Notion sync runs daily automatically
- [ ] 5 production-ready skills created
- [ ] CLI replaces manual script execution
- [ ] 90% of tasks use dual-engine workflow

---

### Q2 2025 (Mar-May): Domain Amplification
**Theme**: "Scale Through Specialization"

**Goal**: Build domain-specific tools and deepen expertise

**Key Projects**:
1. **Amazon Analytics Dashboard** (Week 1-3)
   - Parse 72+ advertising strategy documents
   - Build ROI calculator
   - Create campaign optimizer
   - Integration with existing client work
   - **Lead**: Claude Code (data modeling) → Antigravity (UI + backend)

2. **TikTok Content Pipeline** (Week 4-6)
   - Automate 6-stage operation system
   - Content ideation AI
   - Script generator
   - Performance tracker
   - **Lead**: Antigravity (rapid prototype) → Claude Code (TikTok logic)

3. **Health Data Aggregator** (Week 7-9)
   - Centralize mom's medical records
   - Build timeline visualization
   - Treatment correlation analysis
   - Medical literature search integration
   - **Lead**: Claude Code (sensitive data handling) → Antigravity (UI)

4. **Cross-Domain Knowledge Graph** (Week 10-12)
   - Visualize connections across:
     - E-commerce ↔ AI Tools
     - Health ↔ Personal Growth
     - Technical Skills ↔ Business Operations
   - Auto-suggest skill combinations
   - **Lead**: Claude Code (graph design) → Antigravity (visualization)

**Success Metrics**:
- [ ] 1 client project using Amazon Dashboard
- [ ] TikTok pipeline reduces content creation time by 50%
- [ ] Health data 100% digitized
- [ ] Knowledge graph reveals 10+ non-obvious connections

---

### Q3 2025 (Jun-Aug): Intelligence Layer
**Theme**: "From Reactive to Proactive"

**Goal**: Add predictive and proactive intelligence

**Key Projects**:
1. **Smart Recommender System** (Week 1-4)
   - "You might want to..."
   - Based on:
     - Current projects
     - PARA structure
     - Time patterns
     - Domain expertise
   - **Lead**: Claude Code (recommendation logic) → Antigravity (UI)

2. **Automated Skill Evolution** (Week 5-7)
   - Agents monitor skill usage
   - Auto-suggest improvements
   - A/B test different prompts
   - Continuous learning loop
   - **Lead**: Both (iterative development)

3. **Cross-Project Insights** (Week 8-10)
   - Analyze patterns across all projects
   - "You solved similar problem in Project X"
   - Reusable component library
   - Best practice extraction
   - **Lead**: Claude Code (pattern recognition) → Antigravity (dashboard)

4. **Personal AI Assistant** (Week 11-13)
   - Voice/text interface
   - Context-aware responses
   - Can access entire LiYe OS
   - Proactive suggestions
   - **Lead**: Antigravity (UI/UX) → Claude Code (context integration)

**Success Metrics**:
- [ ] 80% of recommendations are useful
- [ ] Skills improve measurably every month
- [ ] 30% reduction in redundant work
- [ ] AI assistant used daily

---

### Q4 2025 (Sep-Nov): Ecosystem & Sharing
**Theme**: "From Personal to Portable"

**Goal**: Make LiYe OS concepts shareable and reproducible

**Key Projects**:
1. **LiYe OS Framework** (Week 1-4)
   - Extract generalizable patterns
   - Create installation script
   - Template repository
   - Documentation site
   - **Lead**: Claude Code (architecture) → Antigravity (docs site)

2. **Skill Marketplace** (Week 5-8)
   - Share skills with others
   - Import community skills
   - Version control
   - Compatibility checker
   - **Lead**: Both (full-stack development)

3. **Multi-User Support** (Week 9-11)
   - Team workspaces
   - Shared knowledge bases
   - Collaboration features
   - Permission system
   - **Lead**: Claude Code (security) → Antigravity (UI)

4. **LiYe OS Mobile** (Week 12-13)
   - iOS/Android companion app
   - Quick capture
   - Skill activation on-the-go
   - Sync with desktop
   - **Lead**: Antigravity (React Native) → Claude Code (sync logic)

**Success Metrics**:
- [ ] 10 beta users testing LiYe OS
- [ ] 5 community-contributed skills
- [ ] Mobile app in TestFlight
- [ ] Framework documentation complete

---

## 📊 Quarterly Review Process

**Every 3 months**:
1. Review completed projects
2. Measure against success metrics
3. Gather lessons learned
4. Adjust next quarter's plan
5. Update this roadmap

**Review Template**: `Documents/liye_workspace/LiYe_OS/_meta/quarterly_reviews/YYYY_QX.md`

---

## 🚀 Quick Win Projects (Anytime)

These can be inserted between major projects:

**Week-long projects**:
- [ ] GitHub backup automation
- [ ] Screenshot organizer with OCR
- [ ] Meeting notes template generator
- [ ] Expense tracker with category learning
- [ ] Reading list manager with AI summaries

**Weekend projects**:
- [ ] Keyboard shortcuts trainer
- [ ] Focus timer with Pomodoro
- [ ] Daily reflection prompt
- [ ] Weather-based clothing suggester
- [ ] Link rot checker for PARA resources

---

## 🎓 Learning Goals

**Claude Code Mastery**:
- [ ] Master all slash commands
- [ ] Build 3+ custom skills
- [ ] Configure advanced hooks
- [ ] Contribute to Claude Code community

**Antigravity Mastery**:
- [ ] Efficient multi-agent orchestration
- [ ] Custom agent templates
- [ ] Integration with external tools
- [ ] Performance optimization

**System Design**:
- [ ] Knowledge graphs
- [ ] Real-time systems
- [ ] ML/AI integration
- [ ] Mobile app architecture

---

## 🔄 Evolution Principles

**1. Dogfooding**
- Every tool we build must be useful for LiYe OS itself
- If we don't use it daily, question its value

**2. Compound Growth**
- Each project should make future projects easier
- Build reusable components
- Document patterns

**3. Progressive Enhancement**
- Start with CLI, add UI later
- Start with manual, automate gradually
- Start with simple, add intelligence incrementally

**4. Knowledge First**
- Code is temporary, knowledge is permanent
- Always capture insights via `/evolve`
- Update PARA indexes continuously
- Document decisions

**5. Dual-Engine Leverage**
- Use Claude Code for strategy, quality, integration
- Use Antigravity for speed, parallelism, prototyping
- Never do manually what AI can do

---

## 📈 Success Indicators

**System Health**:
- Daily sync success rate > 99%
- Knowledge capture rate: every project → insights
- System uptime: 24/7 accessible
- Response time: < 2s for all operations

**Personal Impact**:
- Hours saved per week: > 10 hours
- Learning velocity: new skills integrated < 1 week
- Decision quality: measurable improvements
- Work satisfaction: subjective improvement

**Knowledge Growth**:
- PARA entries: growing steadily
- Skills catalog: 20+ production skills by EOY
- Cross-references: increasing density
- Insight quality: actionable and reusable

---

## 🛠️ Infrastructure Priorities

**Always maintain**:
- [ ] Daily backups (Time Machine + Cloud)
- [ ] Weekly system health check
- [ ] Monthly security review
- [ ] Quarterly architecture review

**Critical paths**:
- Notion → LiYe OS sync pipeline
- Skills system reliability
- PARA index accuracy
- Evolution Lite automation

---

## 🎯 2026 Vision (Aspirational)

- **LiYe OS as a Product**: Others can adopt and adapt
- **AI-Native Workflows**: Most work done by AI agents
- **Continuous Evolution**: System improves itself daily
- **Community**: 100+ users sharing skills and insights
- **Impact**: Measurable productivity gains
- **Portability**: Works across devices seamlessly

---

## 📝 Notes

**Flexibility**:
This roadmap is a guide, not a contract. Adjust based on:
- Actual time availability
- Emerging opportunities
- Changing priorities
- New technologies

**Review Cycle**:
- Weekly: Check current project progress
- Monthly: Review quarter goals
- Quarterly: Update roadmap
- Yearly: Set vision for next year

**Version History**:
- v1.0 (2025-12-12): Initial roadmap created
- Next review: 2025-03-01

---

Last updated: 2025-12-12 by Claude Code
