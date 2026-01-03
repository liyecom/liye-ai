# CrewAI Multi-Agent Framework - Skill Definition

**Version**: 1.0
**Created**: 2025-12-19
**Last Updated**: 2025-12-19
**Domain**: 06_Technical_Development
**Type**: Technical Framework Skill

---

## Module 01: Skill Identity

### Capability Positioning

**Core Capability**: Orchestrating autonomous multi-agent AI systems for complex, collaborative workflows across diverse domains.

**Unique Value Proposition**:
- Transform complex multi-step tasks into autonomous agent teams
- Enable parallel processing with specialized AI agents
- Maintain quality and consistency through structured workflows
- Scale knowledge work through agent collaboration

**Differentiation from Global Skill**:
- **Global Skill** (`~/.claude/skills/crewai/`): General reference and templates
- **LiYe OS Skill** (this): Integrated with personal knowledge system, domain-specific optimization, artifact tracking

### When to Invoke This Skill

**Primary Triggers**:
1. Multi-stage research requiring different expertise (medical, business, technical)
2. Content production at scale (SEO, 站群, technical documentation)
3. E-commerce operations (Amazon, TikTok keyword analysis and optimization)
4. Complex analysis requiring sequential refinement (data → insights → strategy)
5. Workflows connecting multiple LiYe OS skills

**Integration Points with LiYe OS**:
- **Medical_Research_Analyst** → Use CrewAI for multi-agent literature review teams
- **amazon-keyword-analysis** → Automate keyword discovery and listing optimization
- **Content Creation** → Scale SEO content production with quality control
- **PARA System** → Generate and organize artifacts systematically

### Skill Dependencies

**Prerequisites**:
- Python >=3.10 <3.14
- Basic understanding of AI agent concepts
- OpenAI API key (or alternative LLM provider)

**Complementary Skills**:
- Global CrewAI skill (reference documentation)
- Domain-specific LiYe OS skills (provide methodologies)
- Evolution Lite system (knowledge sedimentation)

---

## Module 02: Capability Model

### Core Capabilities Matrix

| Capability | Proficiency Level | Use Case |
|------------|------------------|----------|
| **Agent Design** | Expert | Define specialized agent roles, goals, backstories |
| **Workflow Orchestration** | Expert | Sequential and hierarchical process design |
| **Domain Integration** | Advanced | Medical, E-commerce, Content, Business domains |
| **Template Customization** | Advanced | Adapt templates to specific scenarios |
| **Flow Engineering** | Intermediate | Event-driven multi-crew orchestration |
| **Tool Integration** | Intermediate | Custom tools and API connections |
| **Performance Optimization** | Intermediate | Rate limiting, caching, model selection |

### Capability Layers

**Layer 1: Foundation** (Always Active)
- Agent-Task-Crew conceptual understanding
- YAML configuration
- Basic workflow design

**Layer 2: Domain Application** (Context-Dependent)
- Medical research workflows (GRADE methodology)
- E-commerce optimization (TES model)
- SEO content creation (SERP analysis)
- Business analysis (SWOT, Porter's Five Forces)

**Layer 3: Advanced Integration** (As Needed)
- Multi-crew Flows
- Custom tool development
- LiYe OS ecosystem integration
- Artifact tracking and evolution

### Quality Standards

**Agent Quality Criteria**:
- Role specificity: >90% clarity (no ambiguous responsibilities)
- Goal measurability: Clear success metrics defined
- Backstory expertise: Domain-appropriate authority level
- Tool appropriateness: Only necessary tools assigned

**Workflow Quality Criteria**:
- Task dependency clarity: 100% explicit context flow
- Output format specification: Detailed expected_output for each task
- Error handling: Graceful degradation strategies
- Performance benchmarks: <2min per agent-task for simple workflows

---

## Module 03: Mental Models

### Primary Mental Model: The Specialist Team Assembly

**Concept**: Building a multi-agent system is like assembling a specialist team for a complex project.

**Key Principles**:
1. **Specialization**: Each agent excels at one thing (researcher, analyst, writer)
2. **Collaboration**: Agents pass work products to each other (context flow)
3. **Autonomy**: Agents make decisions within their domain
4. **Coordination**: Crew or Flow manages the overall workflow

**Analogy**: Think of a medical research project:
- **Literature Searcher** = Research librarian (finds sources)
- **Evidence Analyst** = Biostatistician (evaluates quality)
- **Report Writer** = Medical writer (synthesizes findings)

Each specialist does their job well, then passes results to the next.

### Secondary Mental Model: TES Model (for E-commerce)

**Concept**: Traffic Efficiency Score quantifies keyword value.

**Formula**: `TES = (Search Volume × Purchase Rate) / (Title Density + 1)`

**Interpretation**:
- **TES >100**: Winner keywords → Exact Match, High Bid
- **TES 10-100**: Potential keywords → Phrase Match, Medium Bid
- **TES <10**: Broad keywords → Low Bid discovery

**Application**: Prioritize keyword investment based on conversion potential vs. competition.

### Tertiary Mental Model: Progressive Disclosure

**Concept**: Load information only when needed to manage context efficiently.

**Levels**:
1. **Skill Metadata** (name + description) → Always loaded (~100 words)
2. **SKILL.md** → Loaded when skill triggers (~5k words)
3. **Reference Docs** → Loaded when specific topics needed (~20k words)
4. **Templates** → Loaded when domain-specific implementation requested

**Benefit**: Prevents context bloat while maintaining comprehensive knowledge access.

### Decision Framework: Sequential vs. Hierarchical

```
Task Complexity?
    │
    ├─ Linear workflow (A→B→C)? → Sequential Process
    │   Example: Research → Analyze → Report
    │
    └─ Dynamic coordination needed? → Hierarchical Process
        Example: Manager delegates to specialists based on findings
```

**When to use each**:
- **Sequential**: 80% of use cases, clear dependencies
- **Hierarchical**: Complex projects, need dynamic task allocation

---

## Module 04: Methods & SOPs

### SOP 1: Creating a Domain-Specific Crew

**Objective**: Build a functional multi-agent crew for a specific domain task.

**Prerequisites**:
- Domain understanding (medical, e-commerce, content, business)
- Input/output requirements defined
- Success criteria established

**Process**:

**Step 1: Domain Analysis** (5-10 min)
- [ ] Identify key stages of the workflow
- [ ] List required expertise types
- [ ] Define success metrics
- [ ] Map to existing templates (medical, ecommerce, content, business)

**Step 2: Agent Design** (10-15 min)
- [ ] For each expertise type, create agent with:
  - Role: Specific professional title
  - Goal: Measurable objective with variables
  - Backstory: 2-3 sentences establishing authority
  - Tools: Minimum necessary set
- [ ] Validate no role overlap

**Step 3: Task Configuration** (15-20 min)
- [ ] For each workflow stage, create task with:
  - Description: Detailed instructions (3-5 paragraphs)
  - Expected output: Exact format specification
  - Agent assignment: Match to appropriate agent
  - Context dependencies: Link to previous tasks
- [ ] Validate sequential flow logic

**Step 4: Crew Assembly** (5 min)
```python
crew = Crew(
    agents=[agent_list],
    tasks=[task_list],
    process=Process.sequential,  # or hierarchical
    verbose=True,  # for development
    memory=True    # if agents need recall
)
```

**Step 5: Testing & Iteration** (20-30 min)
- [ ] Run with sample inputs
- [ ] Evaluate output quality against success criteria
- [ ] Identify issues (low quality, missing context, format errors)
- [ ] Refine agent backstories and task descriptions
- [ ] Re-test until quality threshold met

**Step 6: Documentation** (10 min)
- [ ] Document inputs required
- [ ] Note customization points
- [ ] Record performance benchmarks
- [ ] Save to Artifacts_Vault with metadata

**Total Time**: 65-90 minutes for new domain, 30-45 minutes using templates

### SOP 2: Optimizing Crew Performance

**Symptoms Requiring Optimization**:
- Execution time >5 minutes for simple workflows
- Agent outputs are generic or off-topic
- Tasks fail due to rate limiting
- Memory usage excessive

**Optimization Checklist**:

**Model Selection**:
- [ ] Use GPT-4 only for complex reasoning agents
- [ ] Use GPT-3.5 Turbo for formatting, simple tasks
- [ ] Consider Claude for nuanced writing tasks

**Rate Limiting**:
- [ ] Set `max_rpm` appropriate to API tier
- [ ] Distribute load across agents if possible
- [ ] Enable caching: `cache=True`

**Context Management**:
- [ ] Minimize tool count per agent (only what's needed)
- [ ] Use specific task descriptions (reduce exploration)
- [ ] Set `respect_context_window=True`

**Output Format**:
- [ ] Be extremely specific in expected_output
- [ ] Provide examples in task descriptions
- [ ] Use output_file for large outputs

**Memory**:
- [ ] Enable only if agents need cross-task recall
- [ ] Disable for independent parallel tasks

### SOP 3: Integrating with LiYe OS Workflows

**Objective**: Connect CrewAI output to PARA system and Artifacts_Vault.

**When to Use**: After crew execution completes successfully.

**Process**:

**Step 1: Classify Output**
```
Output Type?
    ├─ Research/Analysis? → Save to 30 Resources/
    ├─ Project Deliverable? → Archive to 10 Projects/[project]/
    ├─ Reusable Knowledge? → Extract to 20 Areas/ index
    └─ Evolution Insight? → .liye_evolution/insights/
```

**Step 2: Save to Artifacts_Vault**
- [ ] Create artifact file: `YYYYMMDD_domain_topic.md`
- [ ] Include metadata header:
  ```yaml
  ---
  date: 2025-12-19
  skill: CrewAI_Multi_Agent_Framework
  domain: [medical|ecommerce|content|business]
  crew_config: [brief description]
  inputs: {key: value}
  performance: [execution time, cost]
  ---
  ```
- [ ] Save to: `LiYe_OS/Artifacts_Vault/by_skill/CrewAI_Multi_Agent_Framework/`

**Step 3: Update Evolution Log**
- [ ] Record what worked well
- [ ] Note what could improve
- [ ] Suggest SOP refinements

**Step 4: Cross-Reference**
- [ ] Link to related PARA indexes
- [ ] Connect to domain-specific skills if applicable
- [ ] Update CLAUDE.md if new patterns emerged

---

## Module 05: Execution Protocols

### Protocol 1: Standard Crew Execution

**Context**: Running a configured crew for a specific task.

**Pre-Execution Checklist**:
- [ ] Environment variables set (OPENAI_API_KEY, SERPER_API_KEY)
- [ ] Input variables prepared
- [ ] Output destination confirmed
- [ ] Expected cost estimated (if applicable)

**Execution Steps**:
```python
# 1. Load crew configuration
from my_crew import MyCrew

# 2. Prepare inputs
inputs = {
    'topic': 'AI Agents',
    'word_count': 2000
    # ... other variables
}

# 3. Execute
crew = MyCrew()
result = crew.crew().kickoff(inputs=inputs)

# 4. Verify output
print(f"Result preview: {result[:500]}")

# 5. Save if quality acceptable
if quality_check(result):
    save_to_artifacts(result, inputs)
```

**Post-Execution Actions**:
- [ ] Review output quality
- [ ] Note execution time and cost
- [ ] Save successful outputs to Artifacts_Vault
- [ ] Update evolution_log.md with insights

### Protocol 2: Multi-Crew Flow Orchestration

**Context**: Complex workflows requiring multiple specialized crews.

**Use Cases**:
- Multi-domain analysis (medical + business)
- Iterative refinement (draft → review → revise loop)
- Conditional branching (quality check → route to appropriate crew)

**Structure**:
```python
from crewai.flow.flow import Flow, listen, start

class MultiDomainFlow(Flow):

    @start()
    def domain_1_crew(self):
        # First crew execution
        crew1 = Domain1Crew()
        result = crew1.crew().kickoff(inputs=self.inputs)
        return {"domain_1": result}

    @listen(domain_1_crew)
    def domain_2_crew(self, state):
        # Second crew uses first crew's output
        crew2 = Domain2Crew()
        result = crew2.crew().kickoff(inputs={
            'context': state['domain_1']
        })
        return {"domain_1": state['domain_1'], "domain_2": result}

    @listen(domain_2_crew)
    def synthesize(self, state):
        # Final synthesis crew
        synthesis_crew = SynthesisCrew()
        result = synthesis_crew.crew().kickoff(inputs=state)
        return {"final": result}
```

### Protocol 3: Error Recovery

**Common Errors and Solutions**:

**Rate Limit Exceeded**:
```python
# Solution: Implement retry with backoff
import time
from functools import wraps

def retry_with_backoff(max_retries=3):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except RateLimitError:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt
                        time.sleep(wait_time)
                    else:
                        raise
        return wrapper
    return decorator
```

**Low-Quality Output**:
```python
# Solution: Iterative refinement
def refine_until_quality(crew, inputs, quality_threshold=0.8):
    max_iterations = 3
    for i in range(max_iterations):
        result = crew.kickoff(inputs=inputs)
        quality_score = evaluate_quality(result)

        if quality_score >= quality_threshold:
            return result

        # Refine inputs based on gaps
        inputs = add_refinement_context(inputs, result)

    return result  # Return best attempt
```

---

## Module 06: Output Structure

### Standard Artifact Format

**Filename Convention**: `YYYYMMDD_domain_topic_version.md`

**Metadata Header**:
```yaml
---
date: 2025-12-19
skill: CrewAI_Multi_Agent_Framework
domain: [medical|ecommerce|content|business]
crew_type: [sequential|hierarchical|flow]
agents: [agent1, agent2, agent3]
inputs:
  var1: value1
  var2: value2
performance:
  execution_time: "2m 34s"
  llm_cost: $0.45
  quality_score: 0.85
tags: [research, analysis, ecommerce]
---
```

**Content Structure**:
```markdown
# [Title Based on Topic]

## Executive Summary
[2-3 sentences of key findings]

## Methodology
**Crew Configuration**: [Brief description]
**Agents Used**: [List with roles]
**Workflow**: [Sequential flow description]

## Results

### [Section 1 from Task 1 Output]
...

### [Section 2 from Task 2 Output]
...

## Insights & Observations
[What worked well, what could improve]

## Recommendations
[Actionable next steps]

## References
[If applicable]

---
**Generated by**: CrewAI Multi-Agent Framework (LiYe OS)
**Crew Version**: [version if applicable]
```

### Template Output Formats

**Medical Research Output** (`clinical_report.md`):
- Executive Summary
- Evidence Quality (GRADE rating)
- Efficacy Summary
- Safety Profile
- Patient Selection Criteria
- Monitoring Guidelines
- References

**E-commerce Output** (`optimized_listing.md`):
- Keyword Analysis Table (with TES scores)
- Optimized Title (200 chars)
- Bullet Points (5 benefits-focused)
- Product Description
- Backend Search Terms
- Competitive Intelligence Summary

**Content Creation Output** (`seo_article.md`):
- SEO-optimized article (markdown)
- Meta Title & Description
- URL Slug
- Internal Linking Strategy
- Image Alt Texts
- Schema Markup Recommendations

**Business Analysis Output** (`business_report.md`):
- Executive Summary
- Market Overview
- SWOT Analysis
- Porter's Five Forces
- Strategic Recommendations (short/medium/long-term)
- Implementation Roadmap

---

## Module 07: Templates & Prompts

### Template 1: Medical Research Crew (Quick Start)

**Location**: `templates/medical_research_quick.yaml`

**Use Case**: Rapid evidence-based treatment analysis

**Activation Prompt**:
```
Role: Medical Research Crew Orchestrator
Task: Analyze {treatment} for {condition} using evidence-based methodology
Method: Deploy Literature Searcher → Evidence Analyst → Clinical Writer crew
Output: Clinical Decision Support Report with GRADE evidence quality rating
```

**Customization Points**:
- Search criteria (publication years, sample size thresholds)
- GRADE methodology strictness
- Report depth (summary vs. comprehensive)

### Template 2: Amazon Keyword Optimization Crew

**Location**: `templates/amazon_keyword_crew.yaml`

**Use Case**: Amazon product listing optimization

**Activation Prompt**:
```
Role: Amazon SEO Specialist Team
Task: Optimize listing for {product} in {marketplace}
Method: Calculate TES scores → Generate optimized listing → Analyze competitors
Model: TES = (Search Volume × Purchase Rate) / (Title Density + 1)
Output: Acme Master Keyword Sheet + Optimized Listing Package
```

**Customization Points**:
- TES tier thresholds (adjust for category competitiveness)
- Listing style (benefit-focused vs. feature-focused)
- Backend search term strategy

### Template 3: SEO Content Factory Crew

**Location**: `templates/seo_content_crew.yaml`

**Use Case**: High-volume SEO content production

**Activation Prompt**:
```
Role: SEO Content Production Team
Task: Create SEO-optimized content on {topic} with {word_count} words
Method: SERP Research → Content Writing → On-Page Optimization
Standards: E-E-A-T compliance, natural keyword integration (1-2% density)
Output: Publication-ready article + SEO technical package
```

**Customization Points**:
- Target audience level (beginner/intermediate/expert)
- Content angle (how-to, comparison, listicle)
- Internal linking strategy (pillar content connection)

### Activation Sequence (Universal)

**Step 1: Identify Domain**
```
Which domain matches your need?
- Medical/Healthcare → Use Template 1
- E-commerce/Amazon → Use Template 2
- Content/SEO → Use Template 3
- Business/Strategy → Use business analysis template
- Custom → Adapt from closest template
```

**Step 2: Load Template**
```python
from templates.[domain]_crew import [Domain]Crew

crew = [Domain]Crew()
```

**Step 3: Configure Inputs**
```python
inputs = {
    'var1': 'value1',  # See template README for required vars
    'var2': 'value2'
}
```

**Step 4: Execute**
```python
result = crew.crew().kickoff(inputs=inputs)
```

**Step 5: Save Artifact**
```python
save_to_artifacts_vault(
    result=result,
    domain='[domain]',
    inputs=inputs
)
```

---

## Module 08: Tools Access

### Tool Categories

**Built-in CrewAI Tools**:
- `SerperDevTool()` - Google search via Serper.dev API
- `FileReadTool()` - Read local files
- `WebsiteSearchTool(website='url')` - Search specific websites
- `PDFSearchTool()` - Search PDF documents
- `DirectoryReadTool()` - Read directory contents

**Custom Tools for LiYe OS Integration**:

**1. TES Calculator Tool** (E-commerce):
```python
# Location: scripts/tes_calculator.py
class TESCalculatorTool(BaseTool):
    name = "TES Calculator"
    description = "Calculate Traffic Efficiency Score for Amazon keywords"

    def _run(self, keyword_data: str) -> str:
        # Parse CSV: keyword, search_vol, purchase_rate, title_density
        # Calculate TES = (search_vol * purchase_rate) / (title_density + 1)
        # Return tiered recommendations
```

**2. PARA Indexer Tool** (Knowledge Management):
```python
# Location: scripts/para_indexer.py
class PARAIndexerTool(BaseTool):
    name = "PARA Indexer"
    description = "Save content to appropriate PARA category"

    def _run(self, content: str, category: str) -> str:
        # Categorize: Projects/Areas/Resources/Archives
        # Update indexes
        # Return confirmation with link
```

**3. Artifacts_Vault Logger** (Evolution Tracking):
```python
# Location: scripts/artifacts_logger.py
class ArtifactsLoggerTool(BaseTool):
    name = "Artifacts Vault Logger"
    description = "Log crew execution to Artifacts_Vault with metadata"

    def _run(self, result: str, metadata: dict) -> str:
        # Create artifact file with metadata header
        # Save to by_skill/CrewAI_Multi_Agent_Framework/
        # Update evolution_log.md
```

### Tool Configuration Best Practices

**Minimal Tool Assignment**:
- Only assign tools an agent actually needs
- Fewer tools = faster execution, lower cost
- Example: Writer agents rarely need search tools

**Tool-Agent Matching**:
```yaml
# Good
researcher:
  tools: [SerperDevTool, PDFSearchTool]  # Needs search capabilities

analyst:
  tools: []  # Works with context from researcher, no external tools needed

# Bad
analyst:
  tools: [SerperDevTool]  # Unnecessary, will slow down without benefit
```

### Knowledge Asset References

**Global CrewAI Skill** (`~/.claude/skills/crewai/`):
- `references/overview.md` - Installation, quick start
- `references/agents-and-tasks.md` - Core concepts, examples
- `references/crews-and-flows.md` - Orchestration patterns
- `references/configuration-guide.md` - Complete YAML reference
- `references/api-examples.md` - Production code patterns

**LiYe OS Domain Skills**:
- `Medical_Research_Analyst/` - PICO, GRADE methodologies
- `amazon-keyword-analysis/` - TES model implementation
- `.liye_evolution/` - Knowledge sedimentation patterns

**External Resources**:
- [CrewAI Official Docs](https://docs.crewai.com)
- [DeepLearning.AI CrewAI Course](https://www.deeplearning.ai/short-courses/multi-ai-agent-systems-with-crewai/)
- [CrewAI Community Forum](https://community.crewai.com)

---

## Module 09: Evaluation & Scoring

### Quality Evaluation Framework

**Dimension 1: Output Completeness** (0-10 points)
- All expected sections present: 10
- Missing 1-2 minor sections: 7-9
- Missing major sections: 4-6
- Incomplete/unusable: 0-3

**Dimension 2: Accuracy & Relevance** (0-10 points)
- Fully accurate, highly relevant: 10
- Minor inaccuracies or tangential content: 7-9
- Significant errors or off-topic: 4-6
- Mostly inaccurate: 0-3

**Dimension 3: Format Adherence** (0-10 points)
- Perfect format match to expected_output: 10
- Minor format deviations: 7-9
- Major format issues: 4-6
- Wrong format entirely: 0-3

**Dimension 4: Actionability** (0-10 points)
- Immediately actionable, clear next steps: 10
- Mostly actionable with minor gaps: 7-9
- Requires significant interpretation: 4-6
- Not actionable: 0-3

**Overall Quality Score** = (Dim1 + Dim2 + Dim3 + Dim4) / 4

**Interpretation**:
- **9.0-10.0**: Excellent - Production ready
- **7.0-8.9**: Good - Minor refinement needed
- **5.0-6.9**: Acceptable - Requires editing
- **<5.0**: Poor - Re-run with refined prompts

### Performance Metrics

**Execution Efficiency**:
- Simple crew (2-3 agents, sequential): Target <3 minutes
- Complex crew (4-5 agents): Target <10 minutes
- Multi-crew Flow: Target <20 minutes

**Cost Efficiency**:
- Simple analysis: Target <$0.50
- Comprehensive research: Target <$2.00
- Multi-domain synthesis: Target <$5.00

**Success Rate**: Target >85% of executions produce quality score ≥7.0

### Domain-Specific Evaluation

**Medical Research**:
- [ ] GRADE rating present and justified
- [ ] All citations properly formatted
- [ ] Patient selection criteria clearly defined
- [ ] Safety profile adequately addressed
- [ ] Recommendations evidence-based

**E-commerce**:
- [ ] TES scores calculated correctly
- [ ] Keyword tiers properly classified
- [ ] Listing adheres to platform character limits
- [ ] Competitive gaps identified
- [ ] Backend terms optimized

**Content Creation**:
- [ ] Target keyword integrated naturally
- [ ] Heading structure SEO-optimized (H1→H2→H3)
- [ ] Meta tags within character limits
- [ ] Internal linking opportunities identified
- [ ] E-E-A-T signals present

**Business Analysis**:
- [ ] SWOT analysis comprehensive
- [ ] Porter's Five Forces all addressed
- [ ] Recommendations prioritized and actionable
- [ ] Data sources cited
- [ ] Implementation roadmap realistic

---

## Module 10: Feedback/Evolution Loop

### Evolution Triggers

**When to Update This Skill**:
1. Pattern emerges after 3+ similar use cases
2. Persistent quality issues identified
3. New CrewAI features released
4. Cross-skill integration opportunities discovered
5. Template proves consistently effective/ineffective

### Feedback Collection

**After Each Crew Execution**:
```markdown
## Execution Feedback

**Date**: YYYY-MM-DD
**Domain**: [medical|ecommerce|content|business]
**Crew Config**: [Brief description]

### What Worked Well
- [Observation 1]
- [Observation 2]

### What Could Improve
- [Issue 1]: [Suggested fix]
- [Issue 2]: [Suggested fix]

### Insights for Evolution
- [Pattern or learning]

### Action Items
- [ ] Update [specific section of skill_definition.md]
- [ ] Refine [template name]
- [ ] Add [new tool/pattern]
```

**Save to**: `evolution_log.md` (appended chronologically)

### Evolution Workflow

**Monthly Review** (First Sunday of month):
1. **Aggregate Feedback** (20 min)
   - Review all evolution_log.md entries from past month
   - Identify recurring themes (≥3 mentions = pattern)
   - Categorize: Bug fixes, Enhancements, New capabilities

2. **Prioritize Changes** (10 min)
   - High priority: Affects quality or prevents execution
   - Medium priority: Improves efficiency or convenience
   - Low priority: Nice-to-have enhancements

3. **Implement Updates** (30-60 min)
   - Update skill_definition.md modules
   - Refine templates
   - Add new SOPs if warranted
   - Test changes with sample executions

4. **Document Evolution** (10 min)
   - Update version number in Module 01
   - Record changes in evolution_log.md header
   - Update CLAUDE.md skill invocation rules if protocol changed

### Cross-Skill Knowledge Transfer

**When CrewAI Insights Benefit Other Skills**:

**Example**: TES model (e-commerce) → Content Efficiency Score (SEO)
1. Note insight in both skills' evolution logs
2. Propose cross-reference in CLAUDE.md
3. Consider creating Meta-Skill if pattern is universal

**Protocol**:
```markdown
## Cross-Skill Insight

**Source Skill**: CrewAI_Multi_Agent_Framework
**Target Skill**: [skill name]
**Insight**: [Description of transferable knowledge]
**Proposed Application**: [How to apply in target skill]
**Action**: Update CLAUDE.md §Cross-Skill Knowledge Transfer
```

### Version History

**Version 1.0** (2025-12-19):
- Initial skill definition
- 4 domain templates (medical, ecommerce, content, business)
- Integration with LiYe OS Artifacts_Vault
- 3 custom tools (TES Calculator, PARA Indexer, Artifacts Logger)

**Future Roadmap** (Planned):
- v1.1: Add Healthcare 站群 content template
- v1.2: Integrate with Gemini for large-context analysis
- v1.3: Add automated quality evaluation tool
- v2.0: Multi-crew Flow templates library

---

## Skill Maintenance

**Owner**: LiYe
**Last Audit**: 2025-12-19
**Next Audit**: 2026-01-19 (Monthly)
**Status**: ✅ Active

**Maintenance Checklist**:
- [ ] Review evolution_log.md monthly
- [ ] Test templates quarterly
- [ ] Update for CrewAI version changes
- [ ] Sync with global skill updates
- [ ] Archive successful artifacts as examples

---

**End of Skill Definition**

*For quick reference, see global CrewAI skill at `~/.claude/skills/crewai/SKILL.md`*
*For artifact tracking, see `Artifacts_Vault/by_skill/CrewAI_Multi_Agent_Framework/`*
*For evolution history, see `evolution_log.md` in this directory*
