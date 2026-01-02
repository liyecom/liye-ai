"""
T1-Powered Analyst Agent v0.1
==============================

Internal prototype for T1 reasoning substrate integration.

SCOPE CONSTRAINTS:
- Domains: PPC, BSR Diagnosis ONLY
- Agent Type: Analyst (NOT Strategy, NOT Product)
- T1 Usage: Hidden reasoning context only
- Max T1 Units: 10

EXTERNAL EXPOSURE: PROHIBITED

All outputs MUST include:
"This analysis is powered by internal reasoning substrate."

Reference:
- docs/CONSTITUTION.md § 9 - Pre-Productization Gate
- experiments/reasoning_comparison/evaluation_summary.md - Lift verification
"""

import json
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass
from enum import Enum


class AnalystDomain(Enum):
    """Verified domains for T1-powered analysis"""
    PPC = "ppc"
    BSR_DIAGNOSIS = "bsr_diagnosis"
    LISTING = "listing"  # Added 2025-12-31 after Case 04 validation


@dataclass
class T1Unit:
    """Minimal T1 unit representation for reasoning context"""
    id: str
    content: str
    truth_delta: str
    source: str


class T1AnalystAgent:
    """
    T1-Powered Analyst Agent v0.1

    Internal use only. Not for external exposure.

    Constitutional Constraints:
    - T1 is reasoning substrate, not answer source
    - T1 content MUST NOT appear in output
    - T1 unit IDs MUST NOT appear in output
    - Output MUST be synthesized reasoning
    """

    VERSION = "0.1.0"
    MAX_T1_UNITS = 10

    # Domain-keyword mapping for T1 retrieval
    DOMAIN_KEYWORDS = {
        AnalystDomain.PPC: [
            "ACoS", "PPC", "广告", "campaign", "关键词", "竞价",
            "预算", "budget", "bid", "keyword", "targeting"
        ],
        AnalystDomain.BSR_DIAGNOSIS: [
            "BSR", "排名", "ranking", "Buy Box", "价格", "price",
            "抑制", "suppression", "销量", "velocity"
        ],
        AnalystDomain.LISTING: [
            "listing", "title", "bullet", "标题", "卖点", "semantic",
            "语义", "转化", "conversion", "image", "图片", "A+"
        ]
    }

    # T1 data paths per domain
    T1_PATHS = {
        "default": "~/data/exports/T1_refined/t1_units_latest.json",
        AnalystDomain.LISTING: "~/data/exports/T1_refined/t1_units_listing.json"
    }

    # Output footer (required on all outputs)
    OUTPUT_FOOTER = "\n\n---\n*This analysis is powered by internal reasoning substrate.*"

    def __init__(self, t1_path: str = "~/data/exports/T1_refined/t1_units_latest.json"):
        """Initialize agent with T1 data path"""
        self.t1_path = Path(t1_path).expanduser()
        self.t1_units: List[T1Unit] = []
        self.loaded_domain: Optional[AnalystDomain] = None
        self._load_t1_data()

    def _load_t1_data(self):
        """Load T1 units from JSON file"""
        if not self.t1_path.exists():
            print(f"[WARN] T1 data file not found: {self.t1_path}")
            return

        with open(self.t1_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for unit in data.get('units', []):
            self.t1_units.append(T1Unit(
                id=unit['id'],
                content=unit['content'],
                truth_delta=unit.get('truth_delta', ''),
                source=unit.get('source', '')
            ))

        print(f"[T1 Analyst] Loaded {len(self.t1_units)} T1 units")

    def _retrieve_relevant_units(
        self,
        domain: AnalystDomain,
        query: str,
        max_units: int = None
    ) -> List[T1Unit]:
        """
        Retrieve relevant T1 units for reasoning context.

        Uses keyword matching to find domain-relevant units.
        Returns max MAX_T1_UNITS to prevent context overflow.
        """
        if max_units is None:
            max_units = self.MAX_T1_UNITS

        keywords = self.DOMAIN_KEYWORDS.get(domain, [])
        query_lower = query.lower()

        # Score units by keyword relevance
        scored_units = []
        for unit in self.t1_units:
            score = 0
            content_lower = (unit.content + unit.truth_delta).lower()

            # Check domain keywords
            for kw in keywords:
                if kw.lower() in content_lower:
                    score += 2

            # Check query terms
            for term in query_lower.split():
                if len(term) > 2 and term in content_lower:
                    score += 1

            if score > 0:
                scored_units.append((score, unit))

        # Sort by score and return top units
        scored_units.sort(key=lambda x: x[0], reverse=True)
        return [u for _, u in scored_units[:max_units]]

    def _format_reasoning_context(self, units: List[T1Unit]) -> str:
        """
        Format T1 units as hidden reasoning context.

        This context is for internal reasoning only.
        It MUST NOT be exposed in agent output.
        """
        if not units:
            return ""

        context_parts = [
            "# Reasoning Context (Internal Only)",
            "",
            "The following mechanisms inform this analysis:",
            ""
        ]

        for i, unit in enumerate(units, 1):
            context_parts.append(f"## Mechanism {i}")
            context_parts.append(f"Delta: {unit.truth_delta}")
            context_parts.append("")

        return "\n".join(context_parts)

    def analyze(
        self,
        domain: AnalystDomain,
        query: str,
        verbose: bool = False
    ) -> str:
        """
        Perform T1-powered analysis.

        Args:
            domain: Analysis domain (must be verified)
            query: User query
            verbose: If True, include reasoning metadata

        Returns:
            Analysis output with required footer

        Constitutional Constraints:
        - T1 content MUST NOT appear in output
        - T1 unit IDs MUST NOT appear in output
        - Output MUST include required footer
        """
        # Validate domain
        verified_domains = [AnalystDomain.PPC, AnalystDomain.BSR_DIAGNOSIS, AnalystDomain.LISTING]
        if domain not in verified_domains:
            return (
                f"[ERROR] Domain '{domain.value}' is not yet verified for T1-powered analysis.\n"
                f"Verified domains: PPC, BSR_DIAGNOSIS, LISTING\n"
                f"Reference: experiments/reasoning_comparison/evaluation_summary.md"
                + self.OUTPUT_FOOTER
            )

        # Retrieve relevant T1 units
        relevant_units = self._retrieve_relevant_units(domain, query)

        if not relevant_units:
            return (
                f"[INFO] No relevant T1 units found for this query.\n"
                f"Analysis will proceed without T1 reasoning substrate."
                + self.OUTPUT_FOOTER
            )

        # Format reasoning context (internal only)
        reasoning_context = self._format_reasoning_context(relevant_units)

        # Build analysis prompt
        # Note: In production, this would be sent to LLM with reasoning_context
        # For now, we return a stub indicating the agent is ready

        analysis = self._generate_analysis_stub(domain, query, len(relevant_units))

        if verbose:
            analysis += f"\n\n[Metadata: {len(relevant_units)} T1 units loaded]"

        return analysis + self.OUTPUT_FOOTER

    def _generate_analysis_stub(
        self,
        domain: AnalystDomain,
        query: str,
        unit_count: int
    ) -> str:
        """
        Generate analysis stub.

        In production, this would be replaced by actual LLM call
        with T1 reasoning context.
        """
        return f"""## T1-Powered Analysis

**Domain**: {domain.value}
**Query**: {query}
**T1 Units Loaded**: {unit_count}

[Analysis would be generated here by LLM with T1 reasoning context]

### Expected Output Characteristics (based on Lift verification):

1. **Causal Explicitness**: Explicit cause-effect chains using → notation
2. **Assumption Clarity**: Explicit assumptions and boundary conditions section
3. **Actionability**: Specific thresholds, calculations, and decision criteria

### Constraints Applied:

- T1 content not quoted directly
- T1 unit IDs not exposed
- Output is synthesized reasoning, not retrieval"""

    def get_coverage_status(self) -> Dict:
        """Return current T1 coverage status for this agent"""
        return {
            'version': self.VERSION,
            'total_t1_units': len(self.t1_units),
            'verified_domains': ['ppc', 'bsr_diagnosis', 'listing'],
            'unverified_domains': ['keyword_research', 'a_plus_content'],
            'max_units_per_query': self.MAX_T1_UNITS,
            'external_exposure': 'PROHIBITED',
            'listing_t1_path': self.T1_PATHS.get(AnalystDomain.LISTING, '')
        }


def create_analyst_agent() -> T1AnalystAgent:
    """Factory function to create T1 Analyst Agent"""
    return T1AnalystAgent()


# Example usage (internal only)
if __name__ == '__main__':
    agent = create_analyst_agent()

    print("=" * 60)
    print("T1-Powered Analyst Agent v0.1")
    print("=" * 60)
    print(f"\nCoverage Status: {json.dumps(agent.get_coverage_status(), indent=2)}")

    print("\n" + "=" * 60)
    print("Example: PPC Analysis")
    print("=" * 60)

    result = agent.analyze(
        domain=AnalystDomain.PPC,
        query="ACoS 从 45% 降到 25% 的策略",
        verbose=True
    )
    print(result)
