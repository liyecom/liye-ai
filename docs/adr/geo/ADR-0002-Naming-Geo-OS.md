# ADR-0002: Naming — Geo OS (geo)

- decision_id: ADR-0002
- domain: geo
- status: accepted
- tags: [naming, governance, ssot]

## Context
We have both "Geo OS" and "Geo-SEO" wording in conversations. Renaming the domain introduces high churn across MaaP, CI gates, ADR paths, and historical references.

## Decision
1) Canonical domain name (external + internal): **Geo OS**
2) Canonical domain id: **geo**
3) "geo-seo / local seo / local pack / GBP / NAP" are treated as **routing aliases** that map into geo.
4) Concept IDs under this domain MUST use **GEO_** prefix.

## Consequences
- No dual naming surface (no display_name).
- Routing remains robust for geo-seo vocabulary without creating a separate domain.
