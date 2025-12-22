# AI Collaboration Guide: Claude Code + Antigravity

This guide defines how to use Claude Code and Google Antigravity together to build and evolve LiYe OS.

## Core Principle: Two-Engine Architecture

**Claude Code (System Architect)**: Strategy, Architecture, Quality
**Antigravity (Fast Builder)**: Execution, Parallel Processing, Prototyping

---

## Workflow Templates

### Template 1: New Skill Development

**Phase 1: Design (Claude Code)**
```bash
# In Claude Code terminal
cd ~/Documents/liye_workspace/LiYe_OS/Skills/
# Ask Claude Code to design the new skill architecture
```

**Phase 2: Implementation (Antigravity)**
```
1. Open IMPLEMENTATION_PLAN.md in Antigravity
2. Launch Manager View
3. Create agents for parallel execution:
   - Agent 1: Modules 1-3
   - Agent 2: Modules 4-6
   - Agent 3: Modules 7-10
   - Agent 4: Templates generation
```

**Phase 3: Quality & Integration (Claude Code)**
```bash
# Return to Claude Code
# Review, optimize, and integrate
# Update PARA indexes
# Execute /evolve command
```

---

### Template 2: Notion Sync Enhancement

**Phase 1: Analysis (Claude Code)**
- Analyze current implementation
- Design enhancement architecture
- Create specification document

**Phase 2: Coding (Antigravity)**
- Agent 1: API enhancements
- Agent 2: Error handling
- Agent 3: Progress UI
- Agent 4: Testing

**Phase 3: Integration (Claude Code)**
- Code review and optimization
- Update configuration files
- Update CLAUDE.md documentation

---

### Template 3: Dashboard/UI Development

**Phase 1: Data Architecture (Claude Code)**
- Design data models
- Define API contracts
- Plan integration points

**Phase 2: UI Generation (Antigravity)**
- Leverage zero-shot UI generation
- Create interactive components
- Implement real-time updates

**Phase 3: Business Logic (Claude Code)**
- Implement domain-specific logic
- Add validation and error handling
- Integrate with existing systems

---

## When to Use Which Tool

### Use Claude Code When:
- ✅ Initial system design and architecture
- ✅ Understanding cross-system dependencies
- ✅ Code quality review and optimization
- ✅ Documentation generation
- ✅ Knowledge system updates (PARA, Evolution Lite)
- ✅ Complex decision-making
- ✅ Long-term maintainability concerns

### Use Antigravity When:
- ✅ Rapid prototyping
- ✅ Parallel task execution
- ✅ UI/frontend generation
- ✅ Batch file processing
- ✅ Repetitive code generation
- ✅ Multi-file refactoring (with clear plan)
- ✅ Terminal automation tasks

---

## Communication Protocol

### Handoff from Claude Code to Antigravity

Create handoff documents in: `~/Documents/liye_workspace/_work_in_progress/`

**File naming**: `YYYYMMDD_projectname_IMPLEMENTATION_PLAN.md`

**Required sections**:
1. Objective
2. Architecture overview
3. Task breakdown (for agent assignment)
4. Acceptance criteria
5. Integration points
6. Known constraints

### Handoff from Antigravity to Claude Code

**Create review request**: `YYYYMMDD_projectname_REVIEW_REQUEST.md`

**Include**:
1. What was implemented
2. Decisions made during implementation
3. Open questions
4. Files changed (list)
5. Test results

---

## Quality Gates

Before moving from Antigravity back to Claude Code:
- [ ] All agents completed their tasks
- [ ] No compilation errors
- [ ] Basic functionality verified
- [ ] Files organized according to LiYe OS structure

Before considering a feature "done" (Claude Code final review):
- [ ] Code quality meets standards
- [ ] Documentation updated
- [ ] PARA indexes updated (if applicable)
- [ ] Knowledge sedimented via /evolve (if applicable)
- [ ] CLAUDE.md updated (if needed)

---

## Example: Complete Workflow

**Project**: Build Amazon Product Analysis Dashboard

```
┌─────────────────────────────────────────────────┐
│ Phase 1: Claude Code (2 hours)                  │
├─────────────────────────────────────────────────┤
│ 1. Analyze Documents/出海跨境/Amazon/ data       │
│ 2. Design data models and API architecture      │
│ 3. Create IMPLEMENTATION_PLAN.md                │
│ 4. Define agent task assignments                │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Phase 2: Antigravity (1-2 hours)                │
├─────────────────────────────────────────────────┤
│ Agent 1: Backend API (FastAPI/Node.js)          │
│ Agent 2: Frontend UI (React/Vue)                │
│ Agent 3: Data processing pipeline               │
│ Agent 4: Dashboard components                   │
│ [All run in parallel]                           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Phase 3: Claude Code (1-2 hours)                │
├─────────────────────────────────────────────────┤
│ 1. Code review and quality improvements         │
│ 2. Add Amazon-specific business logic           │
│ 3. Integration testing                          │
│ 4. Documentation                                │
│ 5. Execute /evolve to capture insights          │
└─────────────────────────────────────────────────┘
```

**Total time**: 4-6 hours vs 2-3 days traditional development

---

## Evolution Strategy

### Month 1-2: Learning Phase
- Use Claude Code for 80% of work
- Experiment with Antigravity for simple tasks
- Build familiarity with handoff process

### Month 3-4: Hybrid Phase
- 50/50 split based on task type
- Refine workflow templates
- Document lessons learned

### Month 5+: Optimized Phase
- Clear role division
- Seamless handoffs
- Maximum productivity

---

## Monitoring Success

Track in `~/Documents/liye_workspace/LiYe_OS/_meta/ai_collaboration_log.md`:

- Projects completed
- Time saved vs traditional development
- Code quality metrics
- Knowledge artifacts created
- Lessons learned

---

Last updated: 2025-12-12
Maintained by: Claude Code + LiYe
