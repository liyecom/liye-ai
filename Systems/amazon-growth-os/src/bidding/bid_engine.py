"""
Bid Engine - Automated bid adjustment with guardrails and RAG enhancement.

Amazon Growth OS - Auto Bid Adjustment System
Version: 2.0

This engine:
1. Analyzes keyword performance from DuckDB
2. Consults RAG knowledge base for historical insights
3. Applies ACOS-based and performance-based rules
4. Enforces guardrails (max/min bids, cooldown, daily limits)
5. Logs all decisions for audit, rollback, and learning
6. Supports dry_run, manual_approve, and auto_execute modes
"""

import os
import yaml
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import uuid

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class BidAction(Enum):
    """Possible bid adjustment actions."""
    INCREASE = "increase"
    REDUCE = "reduce"
    PAUSE = "pause"
    RESUME = "resume"
    NO_CHANGE = "no_change"


@dataclass
class BidDecision:
    """Represents a bid adjustment decision with RAG enhancement."""
    decision_id: str
    keyword: str
    asin: str
    campaign_id: Optional[str]
    current_bid: float
    suggested_bid: float
    action: BidAction
    adjustment_pct: float
    reason: str
    rule_applied: str
    priority: int
    created_at: datetime = field(default_factory=datetime.now)
    executed: bool = False
    executed_at: Optional[datetime] = None
    rollback_eligible: bool = True
    # RAG enhancement fields
    rag_confidence: float = 0.0  # 0-1 confidence from RAG insights
    rag_evidence_count: int = 0  # Number of historical insights used
    experience_id: Optional[str] = None  # Link to experience log for learning
    # CVR prediction fields
    predicted_cvr: float = 0.0  # Predicted conversion rate
    cvr_bid_multiplier: float = 1.0  # Bid multiplier from CVR prediction

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging."""
        return {
            'decision_id': self.decision_id,
            'keyword': self.keyword,
            'asin': self.asin,
            'campaign_id': self.campaign_id,
            'current_bid': self.current_bid,
            'suggested_bid': self.suggested_bid,
            'action': self.action.value,
            'adjustment_pct': self.adjustment_pct,
            'reason': self.reason,
            'rule_applied': self.rule_applied,
            'priority': self.priority,
            'created_at': self.created_at.isoformat(),
            'executed': self.executed,
            'executed_at': self.executed_at.isoformat() if self.executed_at else None,
            'rollback_eligible': self.rollback_eligible,
            'rag_confidence': self.rag_confidence,
            'rag_evidence_count': self.rag_evidence_count,
            'experience_id': self.experience_id,
            'predicted_cvr': self.predicted_cvr,
            'cvr_bid_multiplier': self.cvr_bid_multiplier
        }


class BidEngine:
    """
    Automated bid adjustment engine with guardrails.

    Example usage:
        engine = BidEngine()
        decisions = engine.analyze_and_recommend()

        # Dry run (default)
        engine.execute(decisions, mode='dry_run')

        # With approval
        engine.execute(decisions, mode='manual_approve')

        # Auto execute (use with caution)
        engine.execute(decisions, mode='auto_execute')
    """

    def __init__(self, config_path: Optional[str] = None, use_inventory: bool = True,
                 use_rag: bool = True, use_cvr_prediction: bool = True):
        """Initialize the bid engine with guardrails, RAG, and CVR prediction support."""
        self.config_path = config_path or os.path.join(
            BASE_DIR, "config", "bidding_guardrails.yaml"
        )
        self.config = self._load_config()
        self.decisions: List[BidDecision] = []
        self._db_connection = None
        self._inventory_manager = None
        self._use_inventory = use_inventory
        self._use_rag = use_rag
        self._rag_support = None
        self._experience_logger = None
        self._use_cvr_prediction = use_cvr_prediction
        self._cvr_predictor = None

    def _get_inventory_manager(self):
        """Get inventory manager instance."""
        if self._inventory_manager is None and self._use_inventory:
            try:
                from inventory.inventory_manager import InventoryManager
                self._inventory_manager = InventoryManager()
            except Exception as e:
                logger.warning(f"Could not load inventory manager: {e}")
                self._use_inventory = False
        return self._inventory_manager

    def _get_rag_support(self):
        """Get RAG decision support instance."""
        if self._rag_support is None and self._use_rag:
            try:
                from intelligence.rag_decision_support import RAGDecisionSupport
                self._rag_support = RAGDecisionSupport()
                logger.info("RAG decision support initialized")
            except Exception as e:
                logger.warning(f"Could not load RAG support: {e}")
                self._use_rag = False
        return self._rag_support

    def _get_experience_logger(self):
        """Get experience logger instance."""
        if self._experience_logger is None:
            try:
                from intelligence.experience_logger import ExperienceLogger
                self._experience_logger = ExperienceLogger()
            except Exception as e:
                logger.warning(f"Could not load experience logger: {e}")
        return self._experience_logger

    def _get_cvr_predictor(self):
        """Get CVR predictor instance."""
        if self._cvr_predictor is None and self._use_cvr_prediction:
            try:
                from prediction.cvr_predictor import CVRPredictor
                self._cvr_predictor = CVRPredictor()
                logger.info("CVR predictor initialized")
            except Exception as e:
                logger.warning(f"Could not load CVR predictor: {e}")
                self._use_cvr_prediction = False
        return self._cvr_predictor

    def _get_cvr_bid_multiplier(self, kw_data: Dict[str, Any]) -> Tuple[float, float, float]:
        """
        Get bid multiplier based on predicted CVR.

        Returns:
            Tuple of (bid_multiplier, predicted_cvr, confidence)
        """
        predictor = self._get_cvr_predictor()
        if not predictor:
            return 1.0, 0.0, 0.0

        try:
            # Build keyword features
            keyword_data = {
                'keyword': kw_data.get('keyword', ''),
                'search_volume': kw_data.get('search_volume', 10000),
                'organic_rank': kw_data.get('organic_rank', 50),
                'title_density': kw_data.get('title_density', 50),
                'purchase_rate': kw_data.get('purchase_rate', 0.05)
            }

            # Build ASIN features
            asin_data = {
                'asin': kw_data.get('asin', ''),
                'rating': kw_data.get('rating', 4.0),
                'review_count': kw_data.get('review_count', 100),
                'category': 'home_kitchen'  # Default category
            }

            result = predictor.predict(keyword_data, asin_data)
            return result.bid_multiplier, result.predicted_cvr, result.confidence
        except Exception as e:
            logger.debug(f"CVR prediction failed: {e}")
            return 1.0, 0.0, 0.0

    def _get_rag_insights(self, kw_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get RAG insights for a keyword decision.

        Returns recommendation with confidence and evidence from historical data.
        """
        rag = self._get_rag_support()
        if not rag:
            return None

        try:
            from intelligence.rag_decision_support import DecisionContext, DecisionType

            context = DecisionContext(
                decision_type=DecisionType.BID_ADJUSTMENT,
                keyword=kw_data.get('keyword'),
                asin=kw_data.get('asin'),
                current_metrics={
                    'acos': kw_data.get('acos'),
                    'clicks': kw_data.get('clicks'),
                    'orders': kw_data.get('orders'),
                    'spend': kw_data.get('spend'),
                    'ctr': kw_data.get('ctr'),
                    'cvr': kw_data.get('cvr'),
                    'current_bid': kw_data.get('current_bid')
                }
            )

            insights = rag.get_decision_insights(context)
            recommendation = rag.synthesize_recommendation(insights, context)

            return recommendation
        except Exception as e:
            logger.debug(f"RAG insight lookup failed: {e}")
            return None

    def _log_decision_experience(self, decision: 'BidDecision', kw_data: Dict[str, Any],
                                  rag_insights: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Log the decision as an experience for future learning."""
        exp_logger = self._get_experience_logger()
        if not exp_logger:
            return None

        try:
            from intelligence.experience_logger import ExperienceType
            from intelligence.rag_decision_support import DecisionContext, DecisionType

            context = DecisionContext(
                decision_type=DecisionType.BID_ADJUSTMENT,
                keyword=decision.keyword,
                asin=decision.asin,
                current_metrics={
                    'acos': kw_data.get('acos'),
                    'clicks': kw_data.get('clicks'),
                    'orders': kw_data.get('orders'),
                    'spend': kw_data.get('spend'),
                    'ctr': kw_data.get('ctr'),
                    'cvr': kw_data.get('cvr'),
                    'current_bid': decision.current_bid
                }
            )

            experience = exp_logger.log_experience(
                experience_type=ExperienceType.BID_DECISION,
                agent_name="bid_engine",
                decision_context=context,
                action_taken=f"{decision.action.value}: ${decision.current_bid:.2f} -> ${decision.suggested_bid:.2f}",
                reasoning=decision.reason,
                confidence=rag_insights.get('confidence', 0.5) if rag_insights else 0.5,
                metrics_before={
                    'acos': kw_data.get('acos'),
                    'orders': kw_data.get('orders'),
                    'spend': kw_data.get('spend'),
                    'bid': decision.current_bid
                },
                rag_insights_used=rag_insights.get('evidence', []) if rag_insights else []
            )

            return experience.experience_id
        except Exception as e:
            logger.debug(f"Experience logging failed: {e}")
            return None

    def _get_inventory_modifier(self, asin: str) -> Tuple[float, Optional[float], str]:
        """
        Get budget modifier based on inventory status.

        Returns:
            Tuple of (budget_modifier, max_daily_spend, reason)
        """
        manager = self._get_inventory_manager()
        if not manager:
            return 1.0, None, "No inventory data"

        try:
            status = manager.get_asin_status(asin)
            if not status:
                return 1.0, None, "ASIN not tracked"

            from inventory.inventory_manager import InventoryStatus

            inv_status = InventoryStatus(status['status'])
            modifiers = manager.config['budget_modifiers']

            if inv_status == InventoryStatus.STOCKOUT:
                return 0.0, 0.0, "STOCKOUT - Ads paused"

            mod_config = modifiers.get(inv_status.value, modifiers['healthy'])
            return (
                mod_config['modifier'],
                mod_config.get('max_daily_spend_usd'),
                f"Inventory {inv_status.value}: {mod_config['description']}"
            )
        except Exception as e:
            logger.warning(f"Error getting inventory modifier for {asin}: {e}")
            return 1.0, None, "Error checking inventory"

    def _load_config(self) -> Dict[str, Any]:
        """Load guardrails configuration from YAML."""
        try:
            with open(self.config_path, 'r') as f:
                config = yaml.safe_load(f)
            logger.info(f"Loaded guardrails config from {self.config_path}")
            return config
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            raise

    def _get_db_connection(self):
        """Get DuckDB connection."""
        if self._db_connection is None:
            import sys
            sys.path.insert(0, os.path.join(BASE_DIR, "src"))
            from data_lake.db_manager import get_db_connection
            self._db_connection = get_db_connection()
        return self._db_connection

    def _check_cooldown(self, keyword: str, con) -> bool:
        """Check if keyword is still in cooldown period."""
        cooldown_hours = self.config['global_limits'].get('cooldown_hours', 24)

        try:
            result = con.execute("""
                SELECT MAX(executed_at) as last_execution
                FROM fact_execution_log
                WHERE keyword = ?
                  AND action_type IN ('bid_increase', 'bid_decrease')
                  AND executed_at > CURRENT_TIMESTAMP - INTERVAL ? HOUR
            """, [keyword, cooldown_hours]).fetchone()

            if result and result[0]:
                logger.debug(f"Keyword '{keyword}' is in cooldown until {result[0] + timedelta(hours=cooldown_hours)}")
                return True
            return False
        except Exception:
            # Table might not exist yet
            return False

    def _get_keyword_performance(self, lookback_days: int = 7) -> List[Dict[str, Any]]:
        """Get keyword performance data from DuckDB, joining with snapshot for bid info."""
        con = self._get_db_connection()

        # Get performance metrics from entry table
        perf_query = f"""
            SELECT
                keyword,
                asin,
                SUM(impressions) as impressions,
                SUM(clicks) as clicks,
                SUM(spend) as spend,
                SUM(sales) as sales,
                SUM(orders) as orders,
                CASE WHEN SUM(sales) > 0
                     THEN (SUM(spend) / SUM(sales)) * 100
                     ELSE 999
                END as acos,
                CASE WHEN SUM(impressions) > 0
                     THEN (SUM(clicks)::FLOAT / SUM(impressions))
                     ELSE 0
                END as ctr,
                CASE WHEN SUM(clicks) > 0
                     THEN (SUM(orders)::FLOAT / SUM(clicks))
                     ELSE 0
                END as cvr
            FROM fact_keyword_entry_daily
            WHERE dt >= CURRENT_DATE - {lookback_days}
            GROUP BY keyword, asin
            HAVING SUM(impressions) > 0 OR SUM(spend) > 0
        """

        # Get latest bid info from snapshot table
        bid_query = """
            SELECT DISTINCT ON (keyword, asin)
                keyword,
                asin,
                ppc_bid as current_bid,
                ppc_bid as suggested_bid  -- Use ppc_bid as suggested for now
            FROM fact_keyword_snapshot
            WHERE ppc_bid IS NOT NULL
            ORDER BY keyword, asin, snapshot_date DESC
        """

        try:
            # Get performance data
            perf_df = con.execute(perf_query).df()

            if len(perf_df) == 0:
                logger.warning("No performance data found in lookback period")
                return []

            # Try to get bid data
            try:
                bid_df = con.execute(bid_query).df()
                # Merge performance with bid info
                if len(bid_df) > 0:
                    result_df = perf_df.merge(
                        bid_df,
                        on=['keyword', 'asin'],
                        how='left'
                    )
                else:
                    result_df = perf_df
                    result_df['current_bid'] = None
                    result_df['suggested_bid'] = None
            except Exception as e:
                logger.warning(f"Could not get bid data: {e}")
                result_df = perf_df
                result_df['current_bid'] = None
                result_df['suggested_bid'] = None

            # Fill missing bids with default
            default_bid = self.config['global_limits'].get('min_bid_usd', 0.50)
            result_df['current_bid'] = result_df['current_bid'].fillna(default_bid)
            result_df['suggested_bid'] = result_df['suggested_bid'].fillna(
                result_df['current_bid']
            )

            return result_df.to_dict('records')
        except Exception as e:
            logger.error(f"Failed to get keyword performance: {e}")
            return []

    def _get_lifecycle_phase(self, keyword: str, con) -> str:
        """Determine keyword lifecycle phase based on organic rank."""
        try:
            result = con.execute("""
                SELECT organic_rank
                FROM fact_keyword_snapshot
                WHERE keyword = ?
                ORDER BY snapshot_date DESC
                LIMIT 1
            """, [keyword]).fetchone()

            if not result or result[0] is None:
                return 'test'  # Unknown = TEST phase

            rank = result[0]
            if rank == 0 or rank > 20:
                return 'test'
            elif 8 <= rank <= 20:
                return 'grow'
            elif 1 <= rank <= 7:
                return 'harvest'
            else:
                return 'test'
        except Exception:
            return 'test'

    def _evaluate_acos_rules(self, kw_data: Dict[str, Any]) -> Optional[Tuple[BidAction, float, str, int]]:
        """Evaluate ACOS-based rules and return action if applicable."""
        acos = kw_data.get('acos', 999)
        orders = kw_data.get('orders', 0)

        # Check reduce rules (highest priority first)
        for rule in self.config['acos_rules'].get('reduce_bid', []):
            if self._evaluate_condition(rule['condition'], kw_data):
                return (
                    BidAction.REDUCE,
                    rule['adjustment_pct'],
                    rule['description'],
                    rule['priority']
                )

        # Check increase rules
        for rule in self.config['acos_rules'].get('increase_bid', []):
            if self._evaluate_condition(rule['condition'], kw_data):
                return (
                    BidAction.INCREASE,
                    rule['adjustment_pct'],
                    rule['description'],
                    rule['priority']
                )

        return None

    def _evaluate_performance_rules(self, kw_data: Dict[str, Any]) -> Optional[Tuple[BidAction, float, str, int]]:
        """Evaluate performance-based rules."""
        # Zero conversion rules
        for rule in self.config['performance_rules'].get('zero_conversion', []):
            if self._evaluate_condition(rule['condition'], kw_data):
                action = BidAction.PAUSE if rule['action'] == 'pause' else BidAction.REDUCE
                adj = rule.get('adjustment_pct', 0)
                return (action, adj, rule['description'], rule['priority'])

        # High CTR low CVR rules
        for rule in self.config['performance_rules'].get('high_ctr_low_cvr', []):
            if self._evaluate_condition(rule['condition'], kw_data):
                return (
                    BidAction.REDUCE,
                    rule['adjustment_pct'],
                    rule['description'],
                    rule['priority']
                )

        # Low impression rules
        for rule in self.config['performance_rules'].get('low_impression', []):
            if self._evaluate_condition(rule['condition'], kw_data):
                return (
                    BidAction.INCREASE,
                    rule['adjustment_pct'],
                    rule['description'],
                    rule['priority']
                )

        return None

    def _evaluate_condition(self, condition: str, kw_data: Dict[str, Any]) -> bool:
        """Safely evaluate a condition string against keyword data."""
        try:
            # Map condition variables to actual data
            context = {
                'acos': kw_data.get('acos', 999),
                'orders': kw_data.get('orders', 0),
                'clicks': kw_data.get('clicks', 0),
                'impressions': kw_data.get('impressions', 0),
                'spend': kw_data.get('spend', 0),
                'sales': kw_data.get('sales', 0),
                'ctr': kw_data.get('ctr', 0),
                'cvr': kw_data.get('cvr', 0),
            }

            # Replace AND/OR with Python operators
            condition = condition.replace(' AND ', ' and ').replace(' OR ', ' or ')

            # Evaluate safely
            return eval(condition, {"__builtins__": {}}, context)
        except Exception as e:
            logger.warning(f"Failed to evaluate condition '{condition}': {e}")
            return False

    def _apply_guardrails(self, current_bid: float, adjustment_pct: float,
                          action: BidAction, lifecycle_phase: str,
                          suggested_bid: Optional[float]) -> float:
        """Apply guardrails to calculate final bid."""
        limits = self.config['global_limits']
        lifecycle_config = self.config['lifecycle_rules'].get(lifecycle_phase, {})

        if action == BidAction.PAUSE:
            return 0.0

        # Calculate raw adjusted bid
        if action == BidAction.INCREASE:
            new_bid = current_bid * (1 + adjustment_pct / 100)
        elif action == BidAction.REDUCE:
            new_bid = current_bid * (1 + adjustment_pct / 100)  # adjustment_pct is negative
        else:
            new_bid = current_bid

        # Apply global limits
        max_bid = limits.get('max_bid_usd', 5.00)
        min_bid = limits.get('min_bid_usd', 0.10)

        # Apply lifecycle-specific limits ONLY if we have real suggested bid data
        # (not when suggested_bid == current_bid, which indicates default fallback)
        has_real_suggested_bid = (
            suggested_bid is not None and
            suggested_bid != current_bid and
            suggested_bid > 0
        )
        if has_real_suggested_bid and lifecycle_config:
            max_pct = lifecycle_config.get('max_bid_pct_of_suggested', 100)
            lifecycle_max = suggested_bid * (max_pct / 100)
            # Only apply if lifecycle_max is reasonable (above min_bid)
            if lifecycle_max >= min_bid:
                max_bid = min(max_bid, lifecycle_max)

        # Apply max change limit
        max_change_pct = limits.get('max_bid_change_pct', 30)
        max_increase = current_bid * (1 + max_change_pct / 100)
        max_decrease = current_bid * (1 - max_change_pct / 100)

        # Clamp to limits
        new_bid = max(min_bid, min(max_bid, new_bid))
        new_bid = max(max_decrease, min(max_increase, new_bid))

        # Round to 2 decimal places
        return round(new_bid, 2)

    def analyze_and_recommend(self, lookback_days: int = 7) -> List[BidDecision]:
        """
        Analyze keyword performance and generate bid recommendations.

        Returns a list of BidDecision objects sorted by priority.
        """
        self.decisions = []
        con = self._get_db_connection()

        keywords = self._get_keyword_performance(lookback_days)
        logger.info(f"Analyzing {len(keywords)} keywords for bid adjustments")

        min_bid = self.config['global_limits'].get('min_bid_usd', 0.10)

        # Track ASINs already processed for inventory checks
        asin_inventory_checked = {}

        for kw_data in keywords:
            keyword = kw_data.get('keyword', '')
            asin = kw_data.get('asin', '')
            current_bid = kw_data.get('current_bid') or 0.50
            suggested_bid = kw_data.get('suggested_bid')

            # Check cooldown
            if self._check_cooldown(keyword, con):
                continue

            # Check inventory status for ASIN (cache result)
            if asin not in asin_inventory_checked:
                inv_modifier, inv_max_spend, inv_reason = self._get_inventory_modifier(asin)
                asin_inventory_checked[asin] = (inv_modifier, inv_max_spend, inv_reason)
            else:
                inv_modifier, inv_max_spend, inv_reason = asin_inventory_checked[asin]

            # If inventory is at stockout or critical, override with pause recommendation
            if inv_modifier == 0.0:
                # Stockout - pause all keywords for this ASIN
                decision = BidDecision(
                    decision_id=str(uuid.uuid4())[:8],
                    keyword=keyword,
                    asin=asin,
                    campaign_id=None,
                    current_bid=current_bid,
                    suggested_bid=0.0,
                    action=BidAction.PAUSE,
                    adjustment_pct=-100.0,
                    reason=f"INVENTORY: {inv_reason}",
                    rule_applied="inventory:0",
                    priority=0  # Highest priority
                )
                self.decisions.append(decision)
                continue

            # Get lifecycle phase
            lifecycle_phase = self._get_lifecycle_phase(keyword, con)

            # Evaluate rules (priority: performance > acos)
            result = self._evaluate_performance_rules(kw_data)
            if not result:
                result = self._evaluate_acos_rules(kw_data)

            if not result:
                continue

            action, adjustment_pct, reason, priority = result

            # Skip if adjustment too small
            min_change = self.config['global_limits'].get('min_bid_change_pct', 5)
            if abs(adjustment_pct) < min_change and action != BidAction.PAUSE:
                continue

            # Apply guardrails
            new_bid = self._apply_guardrails(
                current_bid, adjustment_pct, action,
                lifecycle_phase, suggested_bid
            )

            # Handle "at floor" case: if bid can't be reduced further and performance is poor
            at_floor = (
                action == BidAction.REDUCE and
                abs(new_bid - current_bid) < 0.01 and
                current_bid <= min_bid * 1.1  # Within 10% of min bid
            )

            if at_floor:
                # Check if we should recommend PAUSE instead
                acos = kw_data.get('acos', 0)
                orders = kw_data.get('orders', 0)
                spend = kw_data.get('spend', 0)

                # If ACOS > 50% and (no orders or high spend with low orders), recommend PAUSE
                if acos > 50 and (orders == 0 or (spend > 10 and orders < 2)):
                    action = BidAction.PAUSE
                    new_bid = 0.0
                    reason = f"At floor bid with critical ACOS ({acos:.0f}%) - recommend pause"
                    adjustment_pct = -100
                else:
                    # Skip - already at floor, can't reduce further, not bad enough to pause
                    continue

            # Skip if no effective change (unless PAUSE)
            if action != BidAction.PAUSE and abs(new_bid - current_bid) < 0.01:
                continue

            # Apply inventory modifier to increase recommendations
            # (reduces the increase if inventory is low)
            if action == BidAction.INCREASE and inv_modifier < 1.0:
                # Scale down the increase based on inventory
                increase_amount = new_bid - current_bid
                adjusted_increase = increase_amount * inv_modifier
                new_bid = round(current_bid + adjusted_increase, 2)
                reason = f"{reason} (Inv: {inv_modifier:.0%})"

            # Get RAG insights for this decision
            rag_insights = self._get_rag_insights(kw_data)
            rag_confidence = 0.0
            rag_evidence_count = 0

            if rag_insights:
                rag_confidence = rag_insights.get('confidence', 0.0)
                rag_evidence_count = len(rag_insights.get('evidence', []))

                # Append RAG context to reason if significant evidence exists
                if rag_evidence_count > 0 and rag_confidence > 0.5:
                    reason = f"{reason} [RAG: {rag_confidence:.0%} conf, {rag_evidence_count} cases]"

            # Get CVR prediction for bid optimization
            cvr_multiplier, predicted_cvr, cvr_confidence = self._get_cvr_bid_multiplier(kw_data)

            # Apply CVR multiplier to bid increases (higher CVR = more aggressive bidding)
            if action == BidAction.INCREASE and cvr_multiplier != 1.0:
                increase_amount = new_bid - current_bid
                adjusted_increase = increase_amount * cvr_multiplier
                new_bid = round(current_bid + adjusted_increase, 2)
                # Ensure we don't exceed guardrails
                max_bid = self.config['global_limits'].get('max_bid_usd', 5.00)
                new_bid = min(new_bid, max_bid)
                if cvr_multiplier > 1.0:
                    reason = f"{reason} [CVR: {predicted_cvr:.0%}→{cvr_multiplier:.1f}x]"

            # Create decision
            decision = BidDecision(
                decision_id=str(uuid.uuid4())[:8],
                keyword=keyword,
                asin=asin,
                campaign_id=None,  # TODO: Add campaign tracking
                current_bid=current_bid,
                suggested_bid=new_bid,
                action=action,
                adjustment_pct=round((new_bid - current_bid) / current_bid * 100, 1) if current_bid > 0 else 0,
                reason=reason,
                rule_applied=f"{action.value}:{priority}",
                priority=priority,
                rag_confidence=rag_confidence,
                rag_evidence_count=rag_evidence_count,
                predicted_cvr=predicted_cvr,
                cvr_bid_multiplier=cvr_multiplier
            )

            # Log experience for learning (async-style, non-blocking)
            experience_id = self._log_decision_experience(decision, kw_data, rag_insights)
            decision.experience_id = experience_id

            self.decisions.append(decision)

        # Sort by priority
        self.decisions.sort(key=lambda x: x.priority)

        logger.info(f"Generated {len(self.decisions)} bid adjustment recommendations")
        return self.decisions

    def log_decisions(self, decisions: List[BidDecision]) -> None:
        """Log decisions to execution log table."""
        if not decisions:
            return

        con = self._get_db_connection()

        # Ensure table exists (with RAG columns)
        con.execute("""
            CREATE TABLE IF NOT EXISTS fact_execution_log (
                execution_id VARCHAR PRIMARY KEY,
                keyword VARCHAR,
                asin VARCHAR,
                campaign_id VARCHAR,
                action_type VARCHAR,
                old_value DECIMAL(10,2),
                new_value DECIMAL(10,2),
                adjustment_pct DECIMAL(5,1),
                reason VARCHAR,
                rule_applied VARCHAR,
                priority INT,
                execution_mode VARCHAR,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                rollback_eligible BOOLEAN DEFAULT TRUE,
                rolled_back BOOLEAN DEFAULT FALSE,
                rolled_back_at TIMESTAMP,
                rag_confidence DECIMAL(3,2) DEFAULT 0,
                rag_evidence_count INT DEFAULT 0,
                experience_id VARCHAR
            )
        """)

        for d in decisions:
            con.execute("""
                INSERT INTO fact_execution_log
                (execution_id, keyword, asin, campaign_id, action_type,
                 old_value, new_value, adjustment_pct, reason, rule_applied,
                 priority, execution_mode, executed_at, rollback_eligible,
                 rag_confidence, rag_evidence_count, experience_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                d.decision_id, d.keyword, d.asin, d.campaign_id,
                d.action.value, d.current_bid, d.suggested_bid,
                d.adjustment_pct, d.reason, d.rule_applied,
                d.priority, self.config['execution'].get('mode', 'dry_run'),
                datetime.now(), d.rollback_eligible,
                d.rag_confidence, d.rag_evidence_count, d.experience_id
            ])

        logger.info(f"Logged {len(decisions)} decisions to execution log")

    def execute(self, decisions: List[BidDecision],
                mode: Optional[str] = None) -> Dict[str, Any]:
        """
        Execute bid adjustments based on mode.

        Modes:
        - dry_run: Only log decisions, don't execute
        - manual_approve: Log and return for approval
        - auto_execute: Execute changes (requires Amazon Ads API)

        Returns execution summary.
        """
        mode = mode or self.config['execution'].get('mode', 'dry_run')
        require_approval_above = self.config['execution'].get('require_approval_above_usd', 2.00)

        results = {
            'mode': mode,
            'total': len(decisions),
            'executed': 0,
            'pending_approval': 0,
            'skipped': 0,
            'errors': 0,
            'decisions': []
        }

        for decision in decisions:
            decision_summary = decision.to_dict()

            if mode == 'dry_run':
                decision_summary['status'] = 'dry_run'
                results['skipped'] += 1

            elif mode == 'manual_approve':
                if decision.suggested_bid > require_approval_above:
                    decision_summary['status'] = 'pending_approval'
                    results['pending_approval'] += 1
                else:
                    # Auto-approve low-value changes
                    decision_summary['status'] = 'auto_approved'
                    decision.executed = True
                    decision.executed_at = datetime.now()
                    results['executed'] += 1

            elif mode == 'auto_execute':
                # TODO: Integrate with Amazon Ads API
                # For now, mark as executed in log
                decision.executed = True
                decision.executed_at = datetime.now()
                decision_summary['status'] = 'executed'
                results['executed'] += 1
                logger.warning(f"Auto-execute not yet connected to Amazon Ads API. "
                             f"Decision {decision.decision_id} marked as executed in log only.")

            results['decisions'].append(decision_summary)

        # Log all decisions
        if self.config['execution'].get('log_all_decisions', True):
            self.log_decisions(decisions)

        return results

    def rollback(self, execution_id: str) -> bool:
        """
        Rollback a previously executed bid adjustment.

        Returns True if rollback was successful.
        """
        con = self._get_db_connection()
        rollback_window = self.config['execution'].get('rollback_window_hours', 48)

        try:
            result = con.execute("""
                SELECT keyword, asin, old_value, new_value, executed_at, rolled_back
                FROM fact_execution_log
                WHERE execution_id = ?
                  AND rollback_eligible = TRUE
            """, [execution_id]).fetchone()

            if not result:
                logger.error(f"Execution {execution_id} not found or not eligible for rollback")
                return False

            keyword, asin, old_value, new_value, executed_at, already_rolled_back = result

            if already_rolled_back:
                logger.warning(f"Execution {execution_id} already rolled back")
                return False

            # Check rollback window
            if datetime.now() - executed_at > timedelta(hours=rollback_window):
                logger.error(f"Execution {execution_id} outside rollback window ({rollback_window}h)")
                return False

            # TODO: Execute rollback via Amazon Ads API
            # For now, log the rollback intent

            con.execute("""
                UPDATE fact_execution_log
                SET rolled_back = TRUE, rolled_back_at = CURRENT_TIMESTAMP
                WHERE execution_id = ?
            """, [execution_id])

            logger.info(f"Rolled back execution {execution_id}: {keyword} bid {new_value} -> {old_value}")
            return True

        except Exception as e:
            logger.error(f"Rollback failed for {execution_id}: {e}")
            return False

    def get_pending_approvals(self) -> List[Dict[str, Any]]:
        """Get decisions pending manual approval."""
        con = self._get_db_connection()

        try:
            df = con.execute("""
                SELECT *
                FROM fact_execution_log
                WHERE execution_mode = 'manual_approve'
                  AND rolled_back = FALSE
                ORDER BY executed_at DESC
                LIMIT 100
            """).df()
            return df.to_dict('records')
        except Exception:
            return []

    def generate_report(self, decisions: List[BidDecision]) -> str:
        """Generate a markdown report of bid recommendations with RAG insights."""
        report = []
        report.append("# Bid Adjustment Report")
        report.append(f"\n**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"**Mode**: {self.config['execution'].get('mode', 'dry_run')}")
        report.append(f"**Total Recommendations**: {len(decisions)}")
        report.append("")

        # Summary by action
        actions_summary = {}
        for d in decisions:
            actions_summary[d.action.value] = actions_summary.get(d.action.value, 0) + 1

        report.append("## Summary by Action")
        for action, count in actions_summary.items():
            report.append(f"- **{action}**: {count}")
        report.append("")

        # RAG Intelligence Summary
        rag_enhanced = [d for d in decisions if d.rag_evidence_count > 0]
        if rag_enhanced:
            avg_confidence = sum(d.rag_confidence for d in rag_enhanced) / len(rag_enhanced)
            total_evidence = sum(d.rag_evidence_count for d in rag_enhanced)
            report.append("## RAG Intelligence Summary")
            report.append(f"- **Decisions Enhanced by RAG**: {len(rag_enhanced)}/{len(decisions)} ({len(rag_enhanced)/len(decisions)*100:.0f}%)")
            report.append(f"- **Average Confidence**: {avg_confidence:.0%}")
            report.append(f"- **Total Historical Cases Referenced**: {total_evidence}")
            report.append("")

        # CVR Prediction Summary
        cvr_enhanced = [d for d in decisions if d.predicted_cvr > 0]
        if cvr_enhanced:
            avg_cvr = sum(d.predicted_cvr for d in cvr_enhanced) / len(cvr_enhanced)
            high_cvr = [d for d in cvr_enhanced if d.predicted_cvr >= 0.15]
            report.append("## CVR Prediction Summary")
            report.append(f"- **Decisions with CVR Prediction**: {len(cvr_enhanced)}/{len(decisions)}")
            report.append(f"- **Average Predicted CVR**: {avg_cvr:.1%}")
            report.append(f"- **High-CVR Keywords (≥15%)**: {len(high_cvr)}")
            if high_cvr:
                report.append(f"- **Bid Boost Applied**: {sum(1 for d in high_cvr if d.cvr_bid_multiplier > 1.0)} keywords")
            report.append("")

        # Detailed recommendations
        report.append("## Recommendations")
        report.append("")
        report.append("| Priority | Keyword | Current | New | Change | Action | CVR | RAG | Reason |")
        report.append("|----------|---------|---------|-----|--------|--------|-----|-----|--------|")

        for d in decisions[:50]:  # Limit to top 50
            change = f"{d.adjustment_pct:+.1f}%"
            cvr_info = f"{d.predicted_cvr:.0%}" if d.predicted_cvr > 0 else "-"
            rag_info = f"{d.rag_confidence:.0%}" if d.rag_evidence_count > 0 else "-"
            report.append(
                f"| {d.priority} | {d.keyword[:20]} | ${d.current_bid:.2f} | "
                f"${d.suggested_bid:.2f} | {change} | {d.action.value} | {cvr_info} | {rag_info} | {d.reason[:35]} |"
            )

        if len(decisions) > 50:
            report.append(f"\n*...and {len(decisions) - 50} more recommendations*")

        # Experience tracking note
        exp_logged = [d for d in decisions if d.experience_id]
        if exp_logged:
            report.append("")
            report.append("---")
            report.append(f"*{len(exp_logged)} decisions logged to experience database for learning.*")

        return "\n".join(report)


def main():
    """CLI entry point for bid engine."""
    import argparse

    parser = argparse.ArgumentParser(description='Amazon Bid Adjustment Engine')
    parser.add_argument('--mode', choices=['dry_run', 'manual_approve', 'auto_execute'],
                       default='dry_run', help='Execution mode')
    parser.add_argument('--lookback', type=int, default=7,
                       help='Days to look back for performance data')
    parser.add_argument('--report', action='store_true',
                       help='Generate markdown report')
    parser.add_argument('--rollback', type=str,
                       help='Rollback a specific execution ID')

    args = parser.parse_args()

    engine = BidEngine()

    if args.rollback:
        success = engine.rollback(args.rollback)
        print(f"Rollback {'succeeded' if success else 'failed'}")
        return

    # Analyze and recommend
    decisions = engine.analyze_and_recommend(lookback_days=args.lookback)

    if args.report:
        report = engine.generate_report(decisions)
        print(report)

        # Save report
        report_path = os.path.join(BASE_DIR, "reports", "markdown",
                                   f"bid_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md")
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, 'w') as f:
            f.write(report)
        print(f"\nReport saved to: {report_path}")

    # Execute
    results = engine.execute(decisions, mode=args.mode)

    print(f"\n=== Execution Summary ===")
    print(f"Mode: {results['mode']}")
    print(f"Total: {results['total']}")
    print(f"Executed: {results['executed']}")
    print(f"Pending Approval: {results['pending_approval']}")
    print(f"Skipped: {results['skipped']}")


if __name__ == '__main__':
    main()
