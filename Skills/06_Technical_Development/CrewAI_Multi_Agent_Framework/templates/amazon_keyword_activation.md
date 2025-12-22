# Amazon Keyword Optimization Crew - Activation Template

## Quick Reference

**Use For**: Amazon product listing optimization, keyword research for PPC campaigns

**Workflow**: Keyword Discovery (TES Model) → Listing Optimization → Competitor Analysis

**Agents**:
1. Keyword Analyst (卖家精灵 expert)
2. Listing Optimizer (Amazon copywriter)
3. Competitor Analyst (Market intelligence)

---

## Activation Prompt

```
Role: Amazon SEO Specialist Team
Task: Optimize listing for {product} in {marketplace}
Method: Calculate TES scores → Generate optimized listing → Analyze competitors
Model: TES = (Search Volume × Purchase Rate) / (Title Density + 1)
Output: Timo Master Keyword Sheet + Optimized Listing Package
```

## Required Inputs

```python
inputs = {
    'product': 'Ergonomic Office Chair',  # Product name/category
    'marketplace': 'Amazon US'             # Target marketplace
}
```

## Configuration Location

**Global Skill Template**: `~/.claude/skills/crewai/assets/templates/ecommerce-operations/`

Files needed:
- `agents.yaml` - Agent configurations
- `tasks.yaml` - Task definitions with TES model
- `README.md` - Setup instructions

## TES Model Reference

**Formula**: `TES = (Search Volume × Purchase Rate) / (Title Density + 1)`

**Tiers**:
- **Winner** (TES >100): Exact Match, High Bid ($1.50+)
- **Potential** (TES 10-100): Phrase Match, Medium Bid ($0.50-$1.50)
- **Broad** (TES <10): Broad Match, Low Bid ($0.10-$0.50)

**Interpretation**:
- High TES = High conversion potential with low competition
- Low TES = Either low demand or oversaturated market

## Customization Points

1. **TES Tier Thresholds**:
   - Competitive categories: Raise to >150 for Winner tier
   - Niche categories: Lower to >50 for Winner tier

2. **Listing Style**:
   - Benefit-focused: Emphasize customer outcomes
   - Feature-focused: Technical specifications
   - Hybrid: Mix both approaches

3. **Backend Search Terms Strategy**:
   - Conservative: Only high-relevance keywords
   - Aggressive: Include tangential keywords

## Expected Output Structure

### Part 1: Keyword Analysis Table

```
| Keyword | Search Vol | Purchase Rate % | Title Density | TES | Tier | Recommendation |
|---------|-----------|----------------|---------------|-----|------|----------------|
| ergonomic office chair | 15000 | 12% | 45 | 391 | Winner | Exact, High Bid |
| office chair back support | 8000 | 10% | 30 | 258 | Winner | Exact, High Bid |
| ... | ... | ... | ... | ... | ... | ... |
```

### Part 2: Optimized Listing

```markdown
## Title (200 chars)
[Brand] [Product] - [Key Feature 1] [Key Feature 2] [Key Feature 3] for [Use Case]

## Bullet Points
1. [Benefit 1 with Winner keyword integration]
2. [Benefit 2 with Winner keyword integration]
3. [Benefit 3 with Potential keyword integration]
4. [Benefit 4 with feature details]
5. [Benefit 5 with guarantee/warranty]

## Product Description
[Storytelling narrative with long-tail keywords]

## Backend Search Terms
[keyword1, keyword2, keyword3...] (249 bytes max)
```

### Part 3: Competitive Intel

```markdown
## Top Competitor Matrix
| Rank | ASIN | Price | Main Keywords | Reviews | Rating | BSR |
|------|------|-------|---------------|---------|--------|-----|
| #1 | B08XXX | $299 | ergonomic, mesh | 5234 | 4.6 | 1850 |
...

## Opportunities
1. Price gap at $250-$280 range
2. Underutilized keyword: "lumbar support chair"
3. Competitor weakness: Poor assembly instructions
```

## Integration with LiYe OS

**Save Location**:
```
.liye_evolution/artifacts/
└── YYYYMMDD_Timo_{product}_keyword_analysis.md
```

**Integration with amazon-keyword-analysis Skill**:
- CrewAI provides automation framework
- amazon-keyword-analysis provides TES methodology
- Use together for monthly keyword reviews

## Performance Benchmarks

- **Execution Time**: 2-4 minutes
- **Cost**: ~$0.50-$1.00
- **Quality Target**: ≥8.5/10.0 (listing must be Amazon-compliant)

## Example Use Cases

1. **New Product Launch**:
   ```python
   inputs = {
       'product': 'Standing Desk Converter',
       'marketplace': 'Amazon US'
   }
   # Use for initial listing creation
   ```

2. **Monthly Keyword Review** (Timo Store):
   ```python
   inputs = {
       'product': 'Laptop Stand',
       'marketplace': 'Amazon US'
   }
   # Update existing listing based on performance
   ```

3. **Market Expansion**:
   ```python
   inputs = {
       'product': 'Office Chair',
       'marketplace': 'Amazon UK'  # New market
   }
   # Adapt listing for different marketplace
   ```

## Troubleshooting

**Issue**: TES scores all very low (<10)
**Solution**: Category may be oversaturated. Consider niche down (e.g., "office chair" → "gaming office chair")

**Issue**: Title exceeds 200 characters
**Solution**: Listing Optimizer will prioritize top 3-4 keywords, remove redundant words

**Issue**: Competitor analysis shows price too high/low
**Solution**: Note in evolution_log, consider pricing strategy adjustment outside crew scope

---

**Last Updated**: 2025-12-19
**Version**: 1.0
