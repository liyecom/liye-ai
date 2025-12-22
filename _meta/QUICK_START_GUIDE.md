# Quick Start Guide: Claude Code + Antigravity

**Welcome to the dual-engine workflow!** This guide gets you productive in 15 minutes.

---

## ⚡ 5-Minute Setup

### 1. Verify Tools Are Ready

```bash
# Check Claude Code is running (you're using it now!)
# Check Antigravity is logged in
open -a Antigravity
```

### 2. Set Up Your Workspace

```bash
# Your work area is already created at:
cd ~/Documents/liye_workspace/_work_in_progress
ls -la
```

You should see:
- ✅ `README.md`
- ✅ `PROJECT_TEMPLATE.md`
- ✅ `EXAMPLE_01_notion_enhanced_sync/`

### 3. Review Key Documents

**Must read** (5 minutes):
- `~/Documents/liye_workspace/LiYe_OS/_meta/AI_COLLABORATION_GUIDE.md`
- `~/Documents/liye_workspace/LiYe_OS/_meta/EVOLUTION_ROADMAP_2025.md`

---

## 🎯 Your First Dual-Engine Project (30 minutes)

Let's build something small but useful: **A daily standup note generator**

### Step 1: Design (Claude Code - 10 min)

In Claude Code, say:

```
"Help me create an implementation plan for a daily standup note generator that:
1. Asks 3 questions: What I did yesterday, What I'll do today, Any blockers
2. Saves to Documents/liye_workspace/00 Inbox/
3. Auto-categorizes topics based on my PARA areas
4. Generates a summary for the week

Use the PROJECT_TEMPLATE.md structure."
```

Claude Code will:
- Create project folder
- Write IMPLEMENTATION_PLAN.md
- Define tasks for Antigravity agents

### Step 2: Build (Antigravity - 15 min)

1. Open Antigravity
2. File → Open Folder → Select the project folder
3. Open Agent Manager (icon in top toolbar)
4. Copy the agent prompts from IMPLEMENTATION_PLAN.md
5. Create 2-3 agents:
   - Agent 1: CLI interface
   - Agent 2: Categorization logic
   - Agent 3: Summary generator
6. Let them run!

### Step 3: Polish (Claude Code - 5 min)

Return to Claude Code:

```
"Review the code created by Antigravity agents at [project_path].
Check for:
- Integration with existing PARA structure
- Error handling
- Code quality
Then add it to my daily workflow."
```

### Step 4: Use It!

```bash
# Add to your path or create alias
alias standup="node ~/Documents/liye_workspace/_work_in_progress/standup/src/standup.js"

# Try it
standup
```

**Congratulations!** You just completed your first dual-engine project. 🎉

---

## 🎨 Common Workflows

### Workflow 1: "Claude Designs, Antigravity Builds"

**Use when**: You need something built quickly with clear requirements

```
Claude Code:
  → Create detailed plan
  → Define architecture
  → Write agent prompts

Antigravity:
  → Execute in parallel
  → Generate code rapidly
  → Create UI/interfaces

Claude Code:
  → Review & optimize
  → Integrate into system
  → Document & deploy
```

**Example projects**:
- Dashboards and UIs
- Batch data processors
- Content generators
- Automation scripts

---

### Workflow 2: "Claude Explores, Antigravity Expands"

**Use when**: Solving a new problem or exploring a domain

```
Claude Code:
  → Research existing solutions
  → Analyze your current systems
  → Propose multiple approaches
  → Pick best approach

Antigravity:
  → Prototype each approach
  → Run experiments
  → Generate variations
  → Test different UX

Claude Code:
  → Evaluate results
  → Choose winning approach
  → Refine and productionize
  → Extract learnings
```

**Example projects**:
- New skill development
- System optimizations
- Learning new technologies
- Competitive analysis

---

### Workflow 3: "Antigravity Generates, Claude Curates"

**Use when**: You need lots of variations or content

```
Antigravity:
  → Generate 10+ variations
  → Create multiple approaches
  → Explore design space
  → Produce content at scale

Claude Code:
  → Evaluate quality
  → Select best options
  → Merge and combine
  → Polish and finalize
  → Organize into PARA
```

**Example projects**:
- Skill templates (create 10 skills at once)
- Content creation (blog posts, social media)
- Test case generation
- Documentation writing

---

## 🔧 Essential Commands

### In Claude Code (Terminal)

```bash
# Navigate to work area
cd ~/Documents/liye_workspace/_work_in_progress

# Create new project from template
cp -r PROJECT_TEMPLATE.md my_new_project/IMPLEMENTATION_PLAN.md

# Sync Notion
cd ~/Documents && npm run sync

# Check system status
ls -lah ~/Documents/liye_workspace/
```

### In Antigravity (Agent Manager)

**Opening Agent Manager**:
- Click icon in top toolbar
- Or: Cmd+Shift+P → "Open Agent Manager"

**Creating an agent**:
```
Agent Name: [Descriptive name]
Task: [Copy from IMPLEMENTATION_PLAN.md]
Files to watch: [Specify directories]
```

**Monitoring agents**:
- Green checkmark = completed
- Spinner = running
- Red X = error (check logs)

---

## 📋 Project Selection Matrix

**When to use Claude Code only**:
- Deep research and analysis
- Architecture design
- Code review and optimization
- Complex decision-making
- Documentation that requires context

**When to use Antigravity only**:
- Simple CRUD applications
- Standard UI components
- Repetitive code generation
- Well-defined tasks
- Prototyping multiple ideas

**When to use both (most projects!)**:
- Anything that combines strategy + execution
- Multi-phase projects
- Quality-critical work
- Long-term maintained systems
- Knowledge-generating work

---

## 🚨 Common Pitfalls

### ❌ **Pitfall 1**: Starting in Antigravity without a plan
**Solution**: Always design in Claude Code first, unless it's trivial

### ❌ **Pitfall 2**: Not reviewing Antigravity's code
**Solution**: Always do a Claude Code review phase

### ❌ **Pitfall 3**: Keeping work isolated
**Solution**: Integrate everything into your PARA system

### ❌ **Pitfall 4**: Forgetting to capture learnings
**Solution**: Run `/evolve` after completing projects

### ❌ **Pitfall 5**: Trying to use both tools simultaneously
**Solution**: Clear handoffs - finish one phase before moving to next

---

## 💡 Pro Tips

### Tip 1: Use IMPLEMENTATION_PLAN.md as contract
- Claude Code writes it
- Antigravity executes it
- Claude Code verifies against it

### Tip 2: Name agents descriptively
- "Backend API Engineer" > "Agent 1"
- "Frontend UI Designer" > "Agent 2"
- Helps track who does what

### Tip 3: Keep work-in-progress organized
```
_work_in_progress/
├── active_projects/
├── completed_this_week/
└── archived/
```

### Tip 4: Set time limits
- Claude Code planning: Max 2 hours
- Antigravity execution: Max 2 hours
- Claude Code review: Max 1 hour
- If exceeding, break into smaller projects

### Tip 5: Document handoff decisions
In IMPLEMENTATION_PLAN.md, note:
```
## Why this task is for Antigravity:
- Parallel execution needed
- Standard UI components
- Clear requirements

## Why this task is for Claude Code:
- Requires LiYe OS context
- Quality-critical
- Complex integration
```

---

## 📚 Next Steps

### Day 1 (Today)
- [x] Set up Antigravity ✅
- [ ] Complete first dual-engine project
- [ ] Read AI_COLLABORATION_GUIDE.md

### Week 1
- [ ] Build 3 small projects using both tools
- [ ] Establish your personal workflow rhythm
- [ ] Update EVOLUTION_ROADMAP with your priorities

### Month 1
- [ ] Complete first major project (e.g., Notion Enhanced Sync)
- [ ] Build 2-3 production-ready skills
- [ ] Refine your collaboration templates
- [ ] Share learnings (write insights)

### Quarter 1
- [ ] System becomes second nature
- [ ] 80% of new work uses dual-engine approach
- [ ] Measurable productivity gains
- [ ] Start helping others set up similar systems

---

## 🆘 Getting Help

### When stuck with Claude Code
- Say: "I'm stuck with [specific issue]"
- Check: `/help` command
- Read: CLAUDE.md in home directory

### When stuck with Antigravity
- Check agent logs (click on agent in Manager)
- Read: https://antigravity.codes/troubleshooting
- Try: Describe problem in Agent prompt

### When workflow feels wrong
- Review: Is this the right tool for this task?
- Ask: "Should I be using Claude Code or Antigravity for this?"
- Consult: AI_COLLABORATION_GUIDE.md decision matrix

---

## 🎉 Success Stories to Inspire You

**Project: Antigravity Setup** (Today)
- Problem: Complex proxy configuration blocking login
- Solution: Claude Code researched → diagnosed → fixed
- Time: 2 hours vs potentially days of trial and error
- Learning: Systematic debugging beats random attempts

**Next Success Story: Yours!**
- What will you build first?
- How much time will you save?
- What will you learn?

---

## 🔄 Continuous Improvement

This system is designed to evolve. After each project:

1. **Reflect**: What worked? What didn't?
2. **Update**: Improve your templates and workflows
3. **Share**: Document insights for future you
4. **Iterate**: Try something new next time

---

**Ready to build?** Pick a project from EVOLUTION_ROADMAP_2025.md and start! 🚀

---

Last updated: 2025-12-12 by Claude Code
