"""
RAG Decision Support Tool - CrewAI Tool for Agent Decision Enhancement.

Amazon Growth OS - RAG-Enhanced Agent Decisions
Version: 1.0

This tool provides:
1. Historical insight lookup from knowledge base
2. Similar scenario matching from execution history
3. Confidence-weighted recommendations
4. Experience logging for continuous learning

Usage in CrewAI agents:
    from tools.rag_decision_tool import RAGDecisionTool

    agent = Agent(
        tools=[RAGDecisionTool()],
        ...
    )
"""

import os
import sys
from typing import Optional, Type, Any
from pydantic import BaseModel, Field

# Add src to path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, "src"))

try:
    from crewai.tools import BaseTool
except ImportError:
    # Fallback for standalone testing
    class BaseTool:
        def __init__(self):
            pass


class RAGDecisionInput(BaseModel):
    """Input schema for RAG Decision Tool."""
    decision_type: str = Field(
        description="Type of decision: 'bid_adjustment', 'keyword_launch', 'listing_change', 'budget_allocation'"
    )
    keyword: Optional[str] = Field(
        default=None,
        description="The keyword being evaluated (if applicable)"
    )
    asin: Optional[str] = Field(
        default=None,
        description="The ASIN being evaluated (if applicable)"
    )
    current_acos: Optional[float] = Field(
        default=None,
        description="Current ACOS percentage (e.g., 35.5)"
    )
    current_orders: Optional[int] = Field(
        default=None,
        description="Number of orders in lookback period"
    )
    current_spend: Optional[float] = Field(
        default=None,
        description="Total ad spend in lookback period"
    )
    current_bid: Optional[float] = Field(
        default=None,
        description="Current bid amount in USD"
    )
    question: Optional[str] = Field(
        default=None,
        description="Specific question to ask the knowledge base (e.g., 'How to reduce ACOS for high-traffic keywords?')"
    )


class RAGDecisionTool(BaseTool):
    """
    CrewAI tool for RAG-enhanced decision making.

    This tool queries the Amazon operations knowledge base and execution history
    to provide evidence-based recommendations for various decision types.

    Example usage:
        result = tool._run(
            decision_type="bid_adjustment",
            keyword="yoga mat",
            current_acos=45.5,
            current_orders=3,
            current_bid=1.50
        )
    """

    name: str = "RAG Decision Support"
    description: str = """
    Use this tool to get historical insights and evidence-based recommendations
    for Amazon advertising decisions. Provides:
    - Knowledge base insights from 66+ advertising strategies
    - Similar historical scenarios and their outcomes
    - Confidence-weighted recommendations
    - Risk assessment

    Input types:
    - bid_adjustment: For bid optimization decisions
    - keyword_launch: For new keyword targeting decisions
    - listing_change: For listing optimization decisions
    - budget_allocation: For budget distribution decisions

    Always provide relevant metrics (ACOS, orders, spend, bid) when available.
    """
    args_schema: Type[BaseModel] = RAGDecisionInput

    def _run(
        self,
        decision_type: str,
        keyword: Optional[str] = None,
        asin: Optional[str] = None,
        current_acos: Optional[float] = None,
        current_orders: Optional[int] = None,
        current_spend: Optional[float] = None,
        current_bid: Optional[float] = None,
        question: Optional[str] = None
    ) -> str:
        """Execute RAG decision support query."""

        try:
            from intelligence.rag_decision_support import (
                RAGDecisionSupport, DecisionContext, DecisionType
            )

            # Map string to enum
            type_mapping = {
                'bid_adjustment': DecisionType.BID_ADJUSTMENT,
                'keyword_launch': DecisionType.KEYWORD_LAUNCH,
                'listing_change': DecisionType.LISTING_CHANGE,
                'budget_allocation': DecisionType.BUDGET_ALLOCATION
            }
            decision_type_enum = type_mapping.get(
                decision_type.lower(),
                DecisionType.BID_ADJUSTMENT
            )

            # Build context
            context = DecisionContext(
                decision_type=decision_type_enum,
                keyword=keyword,
                asin=asin,
                current_metrics={
                    'acos': current_acos,
                    'orders': current_orders,
                    'spend': current_spend,
                    'current_bid': current_bid
                }
            )

            # Get insights
            rag = RAGDecisionSupport()
            insights = rag.get_decision_insights(context)
            recommendation = rag.synthesize_recommendation(insights, context)

            # Format response
            response_parts = []

            # Recommendation summary
            response_parts.append(f"## RAG Decision Analysis")
            response_parts.append(f"**Decision Type**: {decision_type}")
            if keyword:
                response_parts.append(f"**Keyword**: {keyword}")
            if asin:
                response_parts.append(f"**ASIN**: {asin}")
            response_parts.append("")

            # Main recommendation
            response_parts.append(f"### Recommended Action")
            response_parts.append(f"**Action**: {recommendation.get('recommended_action', 'No specific recommendation')}")
            response_parts.append(f"**Confidence**: {recommendation.get('confidence', 0):.0%}")
            response_parts.append("")

            # Reasoning
            if recommendation.get('reasoning'):
                response_parts.append(f"### Reasoning")
                response_parts.append(recommendation['reasoning'])
                response_parts.append("")

            # Evidence
            evidence = recommendation.get('evidence', [])
            if evidence:
                response_parts.append(f"### Supporting Evidence ({len(evidence)} sources)")
                for i, ev in enumerate(evidence[:5], 1):
                    response_parts.append(f"{i}. {ev}")
                response_parts.append("")

            # Risks
            risks = recommendation.get('risks', [])
            if risks:
                response_parts.append(f"### Risk Considerations")
                for risk in risks:
                    response_parts.append(f"- {risk}")
                response_parts.append("")

            # Knowledge base insights
            kb_insights = insights.get('knowledge_base', [])
            if kb_insights:
                response_parts.append(f"### Knowledge Base Insights")
                for insight in kb_insights[:3]:
                    response_parts.append(f"**{insight.source}** (Relevance: {insight.relevance:.0%})")
                    response_parts.append(f"> {insight.content[:200]}...")
                    response_parts.append("")

            return "\n".join(response_parts)

        except ImportError as e:
            return f"RAG Decision Support not available: {e}. Please ensure the intelligence module is installed."
        except Exception as e:
            return f"Error during RAG decision lookup: {str(e)}"


class ExperienceLoggerTool(BaseTool):
    """
    CrewAI tool for logging agent decisions as experiences.

    This tool records decisions and their context for future learning,
    enabling the system to improve over time based on outcomes.
    """

    name: str = "Experience Logger"
    description: str = """
    Use this tool to log important decisions for future learning.
    Records the decision context, action taken, and reasoning.
    Outcomes can be recorded later to measure effectiveness.

    Use after making significant decisions (bid changes, keyword launches, etc.)
    to build a learning database.
    """

    def _run(
        self,
        decision_type: str,
        action_taken: str,
        reasoning: str,
        keyword: Optional[str] = None,
        asin: Optional[str] = None,
        metrics: Optional[dict] = None,
        confidence: float = 0.5
    ) -> str:
        """Log an experience for learning."""

        try:
            from intelligence.experience_logger import ExperienceLogger, ExperienceType
            from intelligence.rag_decision_support import DecisionContext, DecisionType

            # Map decision type
            type_mapping = {
                'bid_adjustment': ExperienceType.BID_DECISION,
                'keyword_launch': ExperienceType.KEYWORD_LAUNCH,
                'listing_change': ExperienceType.LISTING_CHANGE,
                'budget_allocation': ExperienceType.BUDGET_ALLOCATION
            }
            exp_type = type_mapping.get(decision_type.lower(), ExperienceType.BID_DECISION)

            # Map to decision type for context
            decision_type_mapping = {
                'bid_adjustment': DecisionType.BID_ADJUSTMENT,
                'keyword_launch': DecisionType.KEYWORD_LAUNCH,
                'listing_change': DecisionType.LISTING_CHANGE,
                'budget_allocation': DecisionType.BUDGET_ALLOCATION
            }

            context = DecisionContext(
                decision_type=decision_type_mapping.get(
                    decision_type.lower(),
                    DecisionType.BID_ADJUSTMENT
                ),
                keyword=keyword,
                asin=asin,
                current_metrics=metrics or {}
            )

            logger = ExperienceLogger()
            experience = logger.log_experience(
                experience_type=exp_type,
                agent_name="crewai_agent",
                decision_context=context,
                action_taken=action_taken,
                reasoning=reasoning,
                confidence=confidence,
                metrics_before=metrics or {}
            )

            return f"""
## Experience Logged

**Experience ID**: {experience.experience_id}
**Type**: {decision_type}
**Action**: {action_taken}
**Confidence**: {confidence:.0%}

The decision has been recorded. Outcome can be measured in 7 days
using experience ID: {experience.experience_id}
"""

        except Exception as e:
            return f"Failed to log experience: {str(e)}"


# Convenience function to get all RAG tools
def get_rag_tools():
    """Return list of all RAG-related tools for CrewAI agents."""
    return [RAGDecisionTool(), ExperienceLoggerTool()]


# Testing
if __name__ == "__main__":
    tool = RAGDecisionTool()

    # Test bid adjustment query
    result = tool._run(
        decision_type="bid_adjustment",
        keyword="washable runner rug",
        current_acos=45.5,
        current_orders=2,
        current_spend=25.0,
        current_bid=1.20
    )
    print(result)
