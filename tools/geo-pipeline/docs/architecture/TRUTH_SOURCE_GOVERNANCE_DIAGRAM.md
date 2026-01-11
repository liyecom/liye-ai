# Truth Source Governance Architecture

This diagram illustrates how GEO OS enforces knowledge quality **before ingestion**,
using tiered truth sources, guards, refinement pipelines, and review loops.

---

## Mermaid Diagram

```mermaid
flowchart TB
    %% ========================
    %% Raw Sources
    %% ========================
    subgraph T2["T2 · Raw / Exploratory Sources"]
        S2A["shengcai<br/>89,677 units"]
        S2B["industry_reports"]
        S2C["career_reports"]
    end

    %% ========================
    %% Refinement Pipeline
    %% ========================
    subgraph PIPE["T2 → T1 Refinement Pipeline"]
        P1["Stage 1<br/>Structural Eligibility"]
        P2["Stage 2<br/>Quality Filtering"]
        P3["Stage 3<br/>Redundancy Control"]
        P4["Stage 4<br/>T0 Alignment"]
        P5["Stage 5<br/>Human Approval"]
    end

    %% ========================
    %% Curated Knowledge
    %% ========================
    subgraph T1["T1 · Curated Knowledge"]
        K1["T1 Knowledge Units<br/>(with confidence · decay · review)"]
    end

    %% ========================
    %% Canonical Truth
    %% ========================
    subgraph T0["T0 · Canonical Truth"]
        S0["geo_seo<br/>445 units"]
    end

    %% ========================
    %% Guards
    %% ========================
    G1["Tier Guard<br/>(Execution-time Enforcement)"]
    G2["T1 Review Loop<br/>(Keep · Deprecate · Demote)"]

    %% ========================
    %% Flows
    %% ========================
    S2A --> P1
    S2B --> P1
    S2C --> P1

    P1 --> P2 --> P3 --> P4 --> P5 --> K1

    S0 -.defines truth.-> P4
    S0 -.conflict authority.-> K1

    G1 -.blocks misuse.-> S2A
    G1 -.blocks misuse.-> K1

    K1 --> G2
    G2 -->|keep| K1
    G2 -->|demote| S2A

    %% ========================
    %% Styling
    %% ========================
    classDef t0 fill:#1f2937,color:#ffffff,stroke:#111827,stroke-width:2px
    classDef t1 fill:#1d4ed8,color:#ffffff,stroke:#1e3a8a,stroke-width:2px
    classDef t2 fill:#6b7280,color:#ffffff,stroke:#374151,stroke-width:2px
    classDef guard fill:#7c2d12,color:#ffffff,stroke:#431407,stroke-width:2px

    class S0 t0
    class K1 t1
    class S2A,S2B,S2C t2
    class G1,G2 guard
```

---

## Legend

| Color | Tier | Description |
|-------|------|-------------|
| ⬛ Dark | T0 | Canonical Truth (frozen, authoritative) |
| 🔵 Blue | T1 | Curated Knowledge (with decay & review) |
| ⬜ Gray | T2 | Raw/Exploratory (needs refinement) |
| 🟤 Brown | Guard | Enforcement gates |

---

## Key Flows

1. **T2 → Pipeline → T1**: Raw sources must pass 5-stage refinement
2. **T0 → T1 Alignment**: T1 must not contradict T0 definitions
3. **T1 Review Loop**: Curated knowledge decays and requires periodic review
4. **Tier Guard**: Blocks unauthorized access at execution time
