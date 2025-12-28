# SellerSprite Data Contract

**Version**: 1.0
**Status**: Active
**Consumer**: SellerSprite MCP Server

---

## Required Table

| Table | Purpose |
|-------|---------|
| `fact_keyword_snapshot` | SellerSprite keyword analytics data |

## Ownership

| Role | Owner |
|------|-------|
| Data Producer | SellerSprite Import Pipeline |
| Data Consumer | `src/runtime/mcp/servers/amazon/sellersprite_server.py` |

## Minimal Columns

| Column | Type | Description |
|--------|------|-------------|
| `asin` | VARCHAR | Amazon product ASIN |
| `keyword` | VARCHAR | Search keyword |
| `search_volume` | INTEGER | Monthly search volume |
| `competition` | FLOAT | Competition index (0-1) |
| `conversion_rate` | FLOAT | Purchase rate percentage |
| `snapshot_date` | DATE | Data snapshot date |

## Optional Columns

| Column | Type | Description |
|--------|------|-------------|
| `monopoly_pct` | FLOAT | Top 3 ASIN market share |
| `ppc_bid` | FLOAT | Suggested PPC bid |
| `spr` | INTEGER | Sales per review |
| `ranking` | INTEGER | Keyword ranking for ASIN |

## Availability Rule

```
Table absence = DATA_NOT_READY (not an error)
```

**Behavior when table not present**:
- MCP Server returns `status: DATA_NOT_READY`
- No exception thrown
- Clear message: "SellerSprite data not imported yet"
- Suggested action: Run data import pipeline

## Data Import Pipeline

Data should be imported from SellerSprite exports via:
```
src/domain/amazon-growth/runtime/data_lake/etl_loader.py
```

## Contract Validation

MCP Server must check table existence before any query:
```python
# Pseudocode
if not table_exists("fact_keyword_snapshot"):
    return {"status": "DATA_NOT_READY", "message": "..."}
```

---

**Last Updated**: 2025-12-28
