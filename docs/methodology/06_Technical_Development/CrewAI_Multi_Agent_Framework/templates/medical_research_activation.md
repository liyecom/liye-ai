# Medical Research Crew - Activation Template

## Quick Reference

**Use For**: Evidence-based medical treatment analysis, systematic literature review

**Workflow**: Literature Search → Evidence Synthesis (GRADE) → Clinical Report

**Agents**:
1. Literature Searcher (Medical researcher)
2. Evidence Analyst (Biostatistician)
3. Clinical Report Writer (Medical writer)

---

## Activation Prompt

```
Role: Medical Research Crew Orchestrator
Task: Analyze {treatment} for {condition} using evidence-based methodology
Method: Deploy Literature Searcher → Evidence Analyst → Clinical Writer crew
Standards: GRADE methodology for evidence quality, YMYL compliance
Output: Clinical Decision Support Report with treatment protocol and patient selection criteria
```

## Required Inputs

```python
inputs = {
    'treatment': 'T-DXd',              # Drug/treatment name
    'condition': 'HER2+ breast cancer' # Medical condition
}
```

## Configuration Location

**Global Skill Template**: `~/.claude/skills/crewai/assets/templates/medical-research/`

Files needed:
- `agents.yaml` - Agent configurations
- `tasks.yaml` - Task definitions
- `README.md` - Setup instructions

## Customization Points

1. **Search Criteria** (in tasks.yaml):
   - Publication years: Default 2020-2025
   - Sample size threshold: Default ≥100 patients
   - Journal impact factor: Default >5

2. **GRADE Strictness**:
   - Standard: All 5 criteria (risk of bias, inconsistency, indirectness, imprecision, publication bias)
   - Relaxed: Skip publication bias if <10 studies

3. **Report Depth**:
   - Summary: Executive summary + key findings only
   - Comprehensive: Full analysis with all sections

## Expected Output Structure

```markdown
# {treatment} for {condition}: Evidence-Based Analysis

## Executive Summary
[3-5 sentences]

## Evidence Base
- Quality: [HIGH/MODERATE/LOW/VERY LOW]
- Studies: [N studies, N patients]

## Treatment Protocol
### Recommended Regimen
[Dose, schedule, duration]

### Efficacy Expectations
- ORR: X%
- PFS: X months (95% CI)
- OS: X months (95% CI)

## Patient Selection Criteria
- Indicated for: [populations]
- Contraindications: [conditions]

## Monitoring & Management
- Baseline tests
- Monitoring schedule
- AE management

## References
[Complete citations]
```

## Integration with LiYe OS

**Save Location**:
```
Artifacts_Vault/by_skill/CrewAI_Multi_Agent_Framework/
└── YYYYMMDD_medical_{condition}_{treatment}.md
```

**Cross-Reference**:
- Link to Medical_Research_Analyst skill for PICO framework
- Update `20 Areas/健康医疗.md` index if noteworthy

## Performance Benchmarks

- **Execution Time**: 3-5 minutes (with SerperDevTool)
- **Cost**: ~$1.50-$2.50 (with GPT-4 for analysis)
- **Quality Target**: ≥8.0/10.0

## Example Use Cases

1. **Treatment Comparison**:
   ```python
   inputs = {
       'treatment': 'T-DXd vs T-DM1',
       'condition': 'HER2+ metastatic breast cancer'
   }
   ```

2. **Emerging Therapy Evaluation**:
   ```python
   inputs = {
       'treatment': 'CAR-T therapy',
       'condition': 'Relapsed/refractory DLBCL'
   }
   ```

3. **YMYL Content Creation**:
   ```python
   inputs = {
       'treatment': 'Immunotherapy',
       'condition': 'NSCLC'
   }
   # Use output for patient education materials
   ```

## Troubleshooting

**Issue**: Not enough recent studies found
**Solution**: Expand search years to 2018-2025 or lower impact factor threshold

**Issue**: Evidence quality rated LOW/VERY LOW
**Solution**: Broaden search to include observational studies, note limitations clearly

**Issue**: Conflicting results across studies
**Solution**: Evidence Analyst will note heterogeneity and suggest subgroup analysis

---

**Last Updated**: 2025-12-19
**Version**: 1.0
