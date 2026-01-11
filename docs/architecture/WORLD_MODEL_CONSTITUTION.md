# World Model Constitution

> **Version**: v6.2.0
> **Status**: Active
> **Scope**: amazon-growth (MVP), extensible to all domains

---

## What is the World Model Gate?

Every time you ask Amazon Growth Engine to do something—launch a product, optimize an ASIN, adjust PPC—the system **must first think through what could go wrong**.

This is not optional. This is a gate. If the World Model fails, the system stops.

---

## The Three Tiers (T1/T2/T3)

### T1: Failure Modes

**What could go wrong?**

T1 identifies the ways your strategy could fail. Not "might be slightly suboptimal"—actual failure modes that could waste money or damage performance.

Examples:
- Budget reflexivity: spending more → higher CPC → needing to spend even more
- Attribution confusion: ads taking credit for sales that would happen anyway
- Seasonality blindness: mistaking Q4 spike for strategy success

**Why this matters**: If you don't know how you could fail, you can't recognize failure when it's happening.

### T2: State Dimensions

**What's the current situation?**

T2 assesses five dimensions:

| Dimension | What it measures |
|-----------|------------------|
| Liquidity | Can you absorb losses? (inventory, cash, budget flexibility) |
| Correlation | How tangled are your variables? |
| Expectation | How crowded is the auction? |
| Leverage | What's amplifying your bets? |
| Uncertainty | What don't you know? |

Each dimension has:
- **Level**: low / medium / high
- **Evidence**: What data supports this assessment
- **Gaps**: What data is missing

### T3: Dynamics

**What patterns could emerge?**

T3 identifies dynamic patterns that could unfold:

| Type | What it is | Example |
|------|------------|---------|
| Amplification | Small changes become big changes | CPC spiral |
| Acceleration | Change speeds up over time | Viral reviews |
| Phase Transition | Sudden state changes | Stockout cascade |

---

## "Not Telling You" — The Most Important Part

Every World Model output includes: **What This Doesn't Tell You**

This is not humility. This is survival.

The system cannot:
- See competitor budgets
- Predict algorithm changes
- Know if a trend is real or seasonal
- Guarantee any outcome

When you see "not_telling_you", pay attention. These are the blind spots. These are where surprises come from.

---

## Allowed & Not Allowed Actions

The World Model produces explicit guardrails:

### Allowed ✅
- Diagnose current state
- Design small experiments
- Fill data gaps
- Make single-variable changes
- Set hard limits (CPC caps, budget ceilings)

### Not Allowed ❌
- All-in budget increases without diagnosis
- Promise specific ROI
- Change multiple variables at once
- Make big decisions with incomplete data
- Ignore seasonality in trend analysis

---

## How to Use

### Dry-Run Mode

Generate the World Model without executing:

```bash
python src/domain/amazon-growth/main.py --mode launch --product "Test Product" --dry-run
```

This produces:
- Trace file: `data/traces/world_model/wm_YYYYMMDD_HHMMSS_xxx.json`
- Report file: `Artifacts_Vault/reports/WORLD_MODEL_wm_YYYYMMDD_HHMMSS_xxx.md`

**Read the report before proceeding.**

### Full Execution

If the World Model passes, execution proceeds automatically:

```bash
python src/domain/amazon-growth/main.py --mode optimize --asin B0XXXXXXXX
```

If the World Model fails validation, execution is blocked.

---

## Why This Gate Exists

1. **Slow down**: Good decisions require thinking first
2. **Document**: Every execution has a trace of "what we thought would happen"
3. **Bound**: Explicit limits on what actions are allowed
4. **Audit**: When things go wrong, we can see what the model predicted

---

## Non-Negotiable Rules

1. **No bypassing**: There is no `--skip-world-model` flag
2. **No shortcuts**: Every domain must have its own T1/T2/T3 units
3. **No hiding**: The "not_telling_you" section cannot be removed
4. **No promises**: The system cannot guarantee outcomes

---

## Extending to Other Domains

To add a new domain:

1. Create unit files in `src/kernel/world_model/units/<domain>/`
2. Add domain to runner.py mapping
3. Run verify_v6_2.py to confirm integration

The architecture is designed for domain-specific units with shared validation logic.
