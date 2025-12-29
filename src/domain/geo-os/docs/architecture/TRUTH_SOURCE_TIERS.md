# Truth Source Tier Model (T0 / T1 / T2)

## 0. Purpose

This document defines the canonical Truth Source Tier Model for GEO OS.

The goal is to prevent knowledge pollution by enforcing **structural governance**
instead of relying on downstream agent reasoning.

---

## 1. Tier Overview

| Tier | Name | Role | Can Define Truth | Can Participate in RAG |
|-----|------|------|------------------|------------------------|
| T0 | Canonical Truth | Cognitive baseline | YES | YES (authoritative) |
| T1 | Curated Knowledge | Assisted reasoning | NO | YES (annotated) |
| T2 | Raw / Exploratory | Signal discovery | NO | NO |

Priority Rule:

T0 > T1 > T2 is a **decision authority hierarchy**, not a data quality label.

---

## 2. T0 — Canonical Truth Source

### Definition

T0 sources define the non-negotiable conceptual foundation of the system.

They are used to:
- Define core concepts
- Resolve conflicts
- Evaluate other sources

### Admission Rules (ALL REQUIRED)

- Authoritative origin (academic / original methodology)
- High structural quality
- Low redundancy
- Long-term conceptual stability
- Explicit human trust endorsement

Admission method: **manual whitelist only**

### Constraints

- No automatic expansion
- No backward influence from T1 / T2
- No mixed chunking or embedding with other tiers

### Current Assignment

- geo_seo → T0

---

## 3. T1 — Curated Knowledge Source

### Definition

T1 sources contain validated experience and applied knowledge.

They may support reasoning but must never redefine truth.

### Admission Rules

- Manually curated or rule-filtered
- Traceable to original sources
- Structured for chunking
- Explicit provenance metadata

### Constraints

- Cannot override T0
- Must carry confidence / provenance signals
- Cannot update T0

---

## 4. T2 — Raw / Exploratory Source

### Definition

T2 sources are unverified, noisy, exploratory materials.

They exist to surface patterns, not conclusions.

### Admission Rules

- Minimal restrictions
- Raw ingestion allowed

### Constraints

- Forbidden from direct RAG
- Forbidden from direct agent conclusions
- Cannot mix embeddings with T0 / T1
- Allowed for clustering, trend discovery, hypothesis generation only

---

## 5. Conflict Resolution Rules

1. T0 conflicts override all other tiers
2. T1 conflicts are surfaced, not resolved
3. T2 never participates in conflict resolution

---

## 6. Governance Principle

Knowledge quality is enforced **before ingestion**, not during inference.
