# SEO Content Factory Crew - Activation Template

## Quick Reference

**Use For**: High-volume SEO content production, blog post creation, 站群 content

**Workflow**: SERP Research → Content Writing → On-Page Optimization

**Agents**:
1. SEO Researcher (SERP analyst)
2. Content Writer (SEO copywriter)
3. On-Page Optimizer (Technical SEO)

---

## Activation Prompt

```
Role: SEO Content Production Team
Task: Create SEO-optimized content on {topic} with {word_count} words
Method: SERP Research → Content Writing → On-Page Optimization
Standards: E-E-A-T compliance, natural keyword integration (1-2% density)
Output: Publication-ready article + SEO technical package
```

## Required Inputs

```python
inputs = {
    'topic': 'Best Standing Desks 2025',  # Content topic
    'word_count': 2000                     # Target word count
}
```

## Configuration Location

**Global Skill Template**: `~/.claude/skills/crewai/assets/templates/content-creation/`

Files needed:
- `agents.yaml` - Agent configurations
- `tasks.yaml` - Task definitions
- `README.md` - Setup instructions

## Customization Points

1. **Target Audience**:
   - Beginner: Explain all concepts
   - Intermediate: Assume basic knowledge
   - Expert: Focus on advanced insights

2. **Content Angle**:
   - How-to guide
   - Product comparison
   - Listicle (X best/top)
   - Ultimate guide

3. **Internal Linking Strategy**:
   - Pillar content (link to main category page)
   - Supporting content (link to related articles)
   - Hub-and-spoke model

## Expected Output Structure

### Part 1: SEO Research Brief

```markdown
## Target Keyword
- Keyword: "best standing desks 2025"
- Search Volume: 12,000/month
- Keyword Difficulty: 45/100

## Search Intent
Informational + Commercial (users researching before purchase)

## LSI Keywords
- ergonomic standing desk
- adjustable height desk
- standing desk converter
- [10-15 total]

## SERP Features
- Featured Snippet: Product comparison table
- People Also Ask: 4 questions
- Image Pack: Yes

## Competitor Analysis
| Rank | URL | Word Count | Unique Angle |
|------|-----|-----------|--------------|
| #1 | example.com/... | 3500 | Video reviews |
| #2 | example.com/... | 2800 | Price comparison tool |
```

### Part 2: SEO-Optimized Article

```markdown
# [H1: Target Keyword + Hook]

[Introduction with keyword in first 100 words]

## [H2: Main Topic 1]
[Content with LSI keywords naturally integrated]

### [H3: Subtopic if needed]

## [H2: Main Topic 2]

...

## Conclusion
[Summary + CTA]

---

**Internal Linking Opportunities**:
- [LINK: "ergonomic office setup" -> /office-ergonomics]
- [LINK: "productivity tips" -> /productivity-guide]

**Image Suggestions**:
- Hero image: Standing desk in modern office
- Comparison table: Top 5 products
- Infographic: Benefits of standing desks
```

### Part 3: On-Page SEO Package

```markdown
## Meta Title (58 chars)
Best Standing Desks 2025: Top 10 Picks & Buying Guide

## Meta Description (155 chars)
Discover the best standing desks of 2025. Compare features, prices, and ergonomic benefits. Expert reviews + buying guide. Find your perfect desk!

## URL Slug
/best-standing-desks-2025

## Image Alt Texts
1. "Ergonomic electric standing desk with dual monitors in modern home office"
2. "Height-adjustable standing desk comparison chart showing top 5 models"

## Schema Markup
Type: Article
Properties:
- headline: [meta title]
- datePublished: 2025-12-19
- author: [author name]
- image: [hero image URL]

## Internal Linking Strategy
| Anchor Text | Target Page | Placement | SEO Benefit |
|-------------|-------------|-----------|-------------|
| "office ergonomics" | /ergonomics-guide | Section 2 | Topic relevance |
| "productivity workspace" | /productivity-tips | Conclusion | User retention |

## Keyword Density Check
- Target keyword: 1.8% ✓
- LSI keywords: 12 unique terms ✓
```

## Integration with LiYe OS

**Save Location**:
```
Documents/出海跨境/.liye_evolution/artifacts/
└── YYYYMMDD_seo_content_{slug}.md
```

**站群 Integration**:
- Use for bulk content generation across multiple sites
- Maintain E-E-A-T by varying content angle and depth
- Track performance in Artifacts_Vault

## Performance Benchmarks

- **Execution Time**: 4-6 minutes for 2000-word article
- **Cost**: ~$0.80-$1.50
- **Quality Target**: ≥8.0/10.0 (ready for publication with minor edits)

## Example Use Cases

1. **Blog Post Creation**:
   ```python
   inputs = {
       'topic': 'How to Set Up a Home Office',
       'word_count': 1500
   }
   ```

2. **Product Review Page**:
   ```python
   inputs = {
       'topic': 'Autonomous SmartDesk Pro Review 2025',
       'word_count': 2500
   }
   ```

3. **站群 Bulk Content**:
   ```python
   topics = [
       'Best Office Chairs Under $300',
       'Standing Desk vs Sitting Desk',
       'Ergonomic Workspace Setup Guide'
   ]
   for topic in topics:
       inputs = {'topic': topic, 'word_count': 2000}
       result = crew.kickoff(inputs=inputs)
   ```

## E-E-A-T Compliance Checklist

- [ ] Author credentials mentioned (Experience)
- [ ] Sources cited for claims (Expertise)
- [ ] HTTPS site, privacy policy linked (Trustworthiness)
- [ ] Author byline with bio (Authoritativeness)
- [ ] Up-to-date information (2025 data)
- [ ] Disclosures for affiliate links (if applicable)

## Troubleshooting

**Issue**: Keyword density too high (>2.5%)
**Solution**: Content Writer will use more LSI keywords, vary phrasing

**Issue**: Article too generic, matches competitors
**Solution**: SEO Researcher will identify content gaps, Writer adds unique angle

**Issue**: Missing featured snippet opportunity
**Solution**: On-Page Optimizer will add FAQ section or comparison table

---

**Last Updated**: 2025-12-19
**Version**: 1.0
