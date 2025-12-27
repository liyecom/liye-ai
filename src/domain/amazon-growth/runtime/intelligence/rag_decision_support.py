"""
RAG Decision Support - Enhanced Agent Decision Making with Historical Context.

Amazon Growth OS - Intelligence Module
Version: 1.0

This module provides:
1. Context-aware decision support using RAG
2. Historical scenario matching
3. Outcome-based recommendations
4. Integration with knowledge base and experience logs
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)


class DecisionType(Enum):
    """Types of decisions that can be enhanced with RAG."""
    BID_ADJUSTMENT = "bid_adjustment"
    KEYWORD_SELECTION = "keyword_selection"
    LISTING_OPTIMIZATION = "listing_optimization"
    INVENTORY_ACTION = "inventory_action"
    CAMPAIGN_STRATEGY = "campaign_strategy"


@dataclass
class DecisionContext:
    """Context for a decision that needs RAG support."""
    decision_type: DecisionType
    keyword: Optional[str] = None
    asin: Optional[str] = None
    current_metrics: Dict[str, Any] = field(default_factory=dict)
    target_outcome: Optional[str] = None
    constraints: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)

    def to_query(self) -> str:
        """Convert context to a search query."""
        parts = []

        if self.keyword:
            parts.append(f"keyword '{self.keyword}'")

        if self.asin:
            parts.append(f"ASIN {self.asin}")

        if self.current_metrics:
            if 'acos' in self.current_metrics:
                parts.append(f"ACOS {self.current_metrics['acos']:.1f}%")
            if 'rank' in self.current_metrics:
                parts.append(f"rank {self.current_metrics['rank']}")
            if 'orders' in self.current_metrics:
                parts.append(f"{self.current_metrics['orders']} orders")

        if self.target_outcome:
            parts.append(f"goal: {self.target_outcome}")

        return f"{self.decision_type.value} for " + ", ".join(parts)


@dataclass
class HistoricalInsight:
    """An insight from historical data or knowledge base."""
    source: str  # 'knowledge_base', 'experience', 'execution_log'
    relevance_score: float  # 0-1
    content: str
    outcome: Optional[str] = None  # What happened when this was applied
    success_rate: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'source': self.source,
            'relevance_score': self.relevance_score,
            'content': self.content,
            'outcome': self.outcome,
            'success_rate': self.success_rate,
            'metadata': self.metadata
        }


class RAGDecisionSupport:
    """
    RAG-enhanced decision support system.

    Before any major decision, this system:
    1. Queries the knowledge base for relevant strategies
    2. Searches past experiences for similar scenarios
    3. Analyzes execution logs for outcome data
    4. Synthesizes insights into actionable recommendations

    Example usage:
        rag = RAGDecisionSupport()

        # Get insights before making a bid decision
        context = DecisionContext(
            decision_type=DecisionType.BID_ADJUSTMENT,
            keyword='washable runner rug',
            current_metrics={'acos': 45, 'rank': 15, 'orders': 3}
        )

        insights = rag.get_decision_insights(context)
        recommendation = rag.synthesize_recommendation(insights, context)
    """

    def __init__(self, qdrant_url: str = "http://localhost:6333"):
        """Initialize RAG decision support."""
        self.qdrant_url = qdrant_url
        self._qdrant = None
        self._embedder = None
        self._db_connection = None

        # Set NO_PROXY for localhost
        os.environ['NO_PROXY'] = 'localhost,127.0.0.1'
        os.environ['no_proxy'] = 'localhost,127.0.0.1'

    def _get_qdrant(self):
        """Lazy load Qdrant client."""
        if self._qdrant is None:
            try:
                from qdrant_client import QdrantClient
                self._qdrant = QdrantClient(url=self.qdrant_url)
                logger.info(f"Connected to Qdrant: {self.qdrant_url}")
            except Exception as e:
                logger.warning(f"Qdrant connection failed: {e}")
        return self._qdrant

    def _get_embedder(self):
        """Lazy load embedder."""
        if self._embedder is None:
            try:
                sys.path.insert(0, os.path.join(BASE_DIR, "tools"))
                from simple_embedder import SimpleEmbedder
                self._embedder = SimpleEmbedder(model_name="all-MiniLM-L6-v2")
                logger.info("Embedder initialized")
            except Exception as e:
                logger.warning(f"Embedder initialization failed: {e}")
        return self._embedder

    def _get_db_connection(self):
        """Get DuckDB connection."""
        if self._db_connection is None:
            from src.data_lake.db_manager import get_db_connection
            self._db_connection = get_db_connection()
        return self._db_connection

    def search_knowledge_base(self, query: str, top_k: int = 3) -> List[HistoricalInsight]:
        """Search knowledge base for relevant strategies."""
        insights = []
        qdrant = self._get_qdrant()
        embedder = self._get_embedder()

        if not qdrant or not embedder:
            return insights

        try:
            query_vector = embedder.embed_text(query)
            response = qdrant.query_points(
                collection_name="amazon_knowledge_base",
                query=query_vector,
                limit=top_k,
                with_payload=True
            )

            for point in response.points:
                payload = point.payload if hasattr(point, 'payload') else {}
                insights.append(HistoricalInsight(
                    source='knowledge_base',
                    relevance_score=point.score if hasattr(point, 'score') else 0.5,
                    content=payload.get('text_preview', ''),
                    metadata={
                        'source_file': payload.get('source_file', 'unknown'),
                        'section_title': payload.get('section_title', '')
                    }
                ))

        except Exception as e:
            logger.warning(f"Knowledge base search failed: {e}")

        return insights

    def search_execution_history(self, context: DecisionContext,
                                 lookback_days: int = 30) -> List[HistoricalInsight]:
        """Search execution logs for similar past decisions."""
        insights = []
        con = self._get_db_connection()

        try:
            # Build query based on decision type
            if context.decision_type == DecisionType.BID_ADJUSTMENT:
                df = con.execute(f"""
                    SELECT
                        keyword,
                        asin,
                        action_type,
                        old_value,
                        new_value,
                        adjustment_pct,
                        reason,
                        execution_mode,
                        executed_at,
                        rolled_back
                    FROM fact_execution_log
                    WHERE executed_at >= CURRENT_DATE - {lookback_days}
                    ORDER BY executed_at DESC
                    LIMIT 20
                """).df()

                if len(df) > 0:
                    # Group by action type and analyze outcomes
                    for action_type in df['action_type'].unique():
                        action_df = df[df['action_type'] == action_type]
                        rollback_rate = action_df['rolled_back'].mean() if 'rolled_back' in action_df else 0

                        insights.append(HistoricalInsight(
                            source='execution_log',
                            relevance_score=0.8,
                            content=f"Past {len(action_df)} '{action_type}' actions in last {lookback_days} days",
                            outcome=f"Rollback rate: {rollback_rate:.1%}",
                            success_rate=1 - rollback_rate,
                            metadata={
                                'action_type': action_type,
                                'count': len(action_df),
                                'sample_keywords': action_df['keyword'].head(3).tolist()
                            }
                        ))

        except Exception as e:
            logger.warning(f"Execution history search failed: {e}")

        return insights

    def search_similar_keywords(self, context: DecisionContext,
                               top_k: int = 5) -> List[HistoricalInsight]:
        """Find similar keywords and their performance patterns."""
        insights = []
        con = self._get_db_connection()

        if not context.keyword:
            return insights

        try:
            # Find keywords with similar metrics
            current_acos = context.current_metrics.get('acos', 0)
            current_rank = context.current_metrics.get('rank', 0)

            df = con.execute(f"""
                WITH keyword_metrics AS (
                    SELECT
                        keyword,
                        asin,
                        AVG(CASE WHEN sales > 0 THEN (spend/sales)*100 ELSE 999 END) as avg_acos,
                        SUM(orders) as total_orders,
                        MAX(organic_rank) as latest_rank
                    FROM fact_keyword_entry_daily
                    WHERE dt >= CURRENT_DATE - 14
                    GROUP BY keyword, asin
                    HAVING SUM(impressions) > 100
                )
                SELECT *,
                    ABS(avg_acos - {current_acos}) as acos_diff,
                    ABS(COALESCE(latest_rank, 50) - {current_rank if current_rank else 50}) as rank_diff
                FROM keyword_metrics
                WHERE keyword != '{context.keyword}'
                ORDER BY acos_diff + rank_diff
                LIMIT {top_k}
            """).df()

            for _, row in df.iterrows():
                insights.append(HistoricalInsight(
                    source='similar_keywords',
                    relevance_score=0.7,
                    content=f"Similar keyword '{row['keyword']}' (ACOS: {row['avg_acos']:.1f}%, Orders: {row['total_orders']:.0f})",
                    metadata={
                        'keyword': row['keyword'],
                        'asin': row['asin'],
                        'avg_acos': row['avg_acos'],
                        'total_orders': row['total_orders']
                    }
                ))

        except Exception as e:
            logger.warning(f"Similar keywords search failed: {e}")

        return insights

    def get_decision_insights(self, context: DecisionContext) -> Dict[str, List[HistoricalInsight]]:
        """
        Get all relevant insights for a decision.

        Returns insights organized by source:
        - knowledge_base: Strategies from indexed documents
        - execution_history: Past similar actions and outcomes
        - similar_scenarios: Similar keywords/ASINs and their performance
        """
        query = context.to_query()
        logger.info(f"Getting insights for: {query}")

        insights = {
            'knowledge_base': self.search_knowledge_base(query),
            'execution_history': self.search_execution_history(context),
            'similar_scenarios': self.search_similar_keywords(context)
        }

        total = sum(len(v) for v in insights.values())
        logger.info(f"Found {total} insights across {len(insights)} sources")

        return insights

    def synthesize_recommendation(self, insights: Dict[str, List[HistoricalInsight]],
                                  context: DecisionContext) -> Dict[str, Any]:
        """
        Synthesize insights into an actionable recommendation.

        Returns:
            Dictionary with:
            - recommended_action: Suggested action
            - confidence: Confidence level (0-1)
            - reasoning: Explanation of the recommendation
            - evidence: Supporting evidence from insights
            - risks: Potential risks to consider
        """
        recommendation = {
            'recommended_action': None,
            'confidence': 0.5,
            'reasoning': [],
            'evidence': [],
            'risks': [],
            'context': context.to_query()
        }

        # Analyze knowledge base insights
        kb_insights = insights.get('knowledge_base', [])
        if kb_insights:
            best_kb = max(kb_insights, key=lambda x: x.relevance_score)
            if best_kb.relevance_score > 0.6:
                recommendation['evidence'].append({
                    'source': 'Knowledge Base',
                    'content': best_kb.content[:200],
                    'relevance': f"{best_kb.relevance_score:.1%}"
                })
                recommendation['confidence'] += 0.1

        # Analyze execution history
        exec_insights = insights.get('execution_history', [])
        for insight in exec_insights:
            if insight.success_rate and insight.success_rate > 0.8:
                recommendation['reasoning'].append(
                    f"Historical '{insight.metadata.get('action_type', 'action')}' "
                    f"has {insight.success_rate:.0%} success rate"
                )
                recommendation['confidence'] += 0.15
            elif insight.success_rate and insight.success_rate < 0.5:
                recommendation['risks'].append(
                    f"Caution: '{insight.metadata.get('action_type', 'action')}' "
                    f"has only {insight.success_rate:.0%} success rate"
                )
                recommendation['confidence'] -= 0.1

        # Analyze similar scenarios
        similar = insights.get('similar_scenarios', [])
        if similar:
            avg_acos = sum(s.metadata.get('avg_acos', 0) for s in similar) / len(similar)
            recommendation['evidence'].append({
                'source': 'Similar Keywords',
                'content': f"Average ACOS of {len(similar)} similar keywords: {avg_acos:.1f}%",
                'count': len(similar)
            })

        # Generate recommendation based on decision type
        if context.decision_type == DecisionType.BID_ADJUSTMENT:
            recommendation = self._recommend_bid_action(recommendation, context, insights)

        # Clamp confidence
        recommendation['confidence'] = max(0.1, min(0.95, recommendation['confidence']))

        return recommendation

    def _recommend_bid_action(self, recommendation: Dict[str, Any],
                             context: DecisionContext,
                             insights: Dict[str, List[HistoricalInsight]]) -> Dict[str, Any]:
        """Generate bid adjustment recommendation."""
        acos = context.current_metrics.get('acos', 0)
        orders = context.current_metrics.get('orders', 0)
        rank = context.current_metrics.get('rank', 50)

        # Decision logic based on metrics and insights
        if acos > 50 or (acos > 30 and orders == 0):
            recommendation['recommended_action'] = 'REDUCE_BID'
            recommendation['reasoning'].append(f"High ACOS ({acos:.1f}%) indicates overbidding")
            if orders == 0:
                recommendation['reasoning'].append("Zero orders suggests poor keyword-product fit")
        elif acos < 20 and orders >= 2:
            recommendation['recommended_action'] = 'INCREASE_BID'
            recommendation['reasoning'].append(f"Good ACOS ({acos:.1f}%) with conversions - room to scale")
            if rank > 10:
                recommendation['reasoning'].append(f"Current rank {rank} - higher bid may improve position")
        elif 8 <= rank <= 20:
            # Strike zone
            recommendation['recommended_action'] = 'INCREASE_BID'
            recommendation['reasoning'].append(f"Rank {rank} is in Strike Zone (8-20) - push for top 10")
            recommendation['confidence'] += 0.1
        else:
            recommendation['recommended_action'] = 'HOLD'
            recommendation['reasoning'].append("Metrics don't clearly indicate bid change needed")

        return recommendation

    def format_insights_for_agent(self, insights: Dict[str, List[HistoricalInsight]]) -> str:
        """Format insights as a string for agent consumption."""
        output = []
        output.append("=" * 60)
        output.append("📚 RAG Decision Support - Historical Insights")
        output.append("=" * 60)

        for source, source_insights in insights.items():
            if source_insights:
                output.append(f"\n## {source.replace('_', ' ').title()}")
                output.append("-" * 40)

                for i, insight in enumerate(source_insights[:3], 1):
                    output.append(f"\n{i}. [{insight.relevance_score:.0%} relevance]")
                    output.append(f"   {insight.content[:150]}...")
                    if insight.outcome:
                        output.append(f"   → Outcome: {insight.outcome}")
                    if insight.success_rate:
                        output.append(f"   → Success rate: {insight.success_rate:.0%}")

        output.append("\n" + "=" * 60)
        return "\n".join(output)


def main():
    """CLI entry point for RAG decision support."""
    import argparse

    parser = argparse.ArgumentParser(description='RAG Decision Support')
    parser.add_argument('--keyword', type=str, help='Keyword to analyze')
    parser.add_argument('--asin', type=str, help='ASIN to analyze')
    parser.add_argument('--acos', type=float, help='Current ACOS')
    parser.add_argument('--rank', type=int, help='Current organic rank')
    parser.add_argument('--orders', type=int, default=0, help='Recent orders')

    args = parser.parse_args()

    rag = RAGDecisionSupport()

    context = DecisionContext(
        decision_type=DecisionType.BID_ADJUSTMENT,
        keyword=args.keyword,
        asin=args.asin,
        current_metrics={
            'acos': args.acos or 30,
            'rank': args.rank or 20,
            'orders': args.orders
        }
    )

    print(f"\n🔍 Analyzing: {context.to_query()}\n")

    # Get insights
    insights = rag.get_decision_insights(context)
    print(rag.format_insights_for_agent(insights))

    # Get recommendation
    recommendation = rag.synthesize_recommendation(insights, context)

    print("\n📊 Recommendation")
    print("=" * 60)
    print(f"Action: {recommendation['recommended_action']}")
    print(f"Confidence: {recommendation['confidence']:.0%}")

    if recommendation['reasoning']:
        print("\nReasoning:")
        for r in recommendation['reasoning']:
            print(f"  • {r}")

    if recommendation['risks']:
        print("\nRisks:")
        for r in recommendation['risks']:
            print(f"  ⚠️ {r}")


if __name__ == '__main__':
    main()
