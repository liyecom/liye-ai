"""
Experience Logger - Learning from Past Decisions.

Amazon Growth OS - Intelligence Module
Version: 1.0

This module:
1. Logs agent decisions with full context
2. Tracks outcomes after execution (7-day follow-up)
3. Calculates effectiveness scores
4. Enables continuous improvement through experience-based learning
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from enum import Enum
import uuid

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)


class ExperienceType(Enum):
    """Types of experiences that can be logged."""
    BID_DECISION = "bid_decision"
    KEYWORD_LAUNCH = "keyword_launch"
    KEYWORD_KILL = "keyword_kill"
    LISTING_UPDATE = "listing_update"
    INVENTORY_ACTION = "inventory_action"
    CAMPAIGN_CHANGE = "campaign_change"


class OutcomeStatus(Enum):
    """Status of an experience outcome."""
    PENDING = "pending"  # Waiting for follow-up period
    SUCCESS = "success"  # Positive outcome
    NEUTRAL = "neutral"  # No significant change
    FAILURE = "failure"  # Negative outcome
    UNKNOWN = "unknown"  # Unable to measure


@dataclass
class Experience:
    """A logged experience from an agent decision."""
    experience_id: str
    experience_type: ExperienceType
    agent_name: str
    decision_context: Dict[str, Any]
    action_taken: str
    reasoning: str
    confidence: float
    rag_insights_used: List[Dict[str, Any]]
    created_at: datetime = field(default_factory=datetime.now)

    # Metrics at decision time
    metrics_before: Dict[str, Any] = field(default_factory=dict)

    # Outcome tracking (filled in later)
    outcome_status: OutcomeStatus = OutcomeStatus.PENDING
    metrics_after: Dict[str, Any] = field(default_factory=dict)
    outcome_measured_at: Optional[datetime] = None
    effectiveness_score: Optional[float] = None  # -1 to 1
    lessons_learned: str = ""
    user_feedback: Optional[int] = None  # 1-5 rating

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        data = asdict(self)
        data['experience_type'] = self.experience_type.value
        data['outcome_status'] = self.outcome_status.value
        data['created_at'] = self.created_at.isoformat()
        if self.outcome_measured_at:
            data['outcome_measured_at'] = self.outcome_measured_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Experience':
        """Create from dictionary."""
        data['experience_type'] = ExperienceType(data['experience_type'])
        data['outcome_status'] = OutcomeStatus(data['outcome_status'])
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        if data.get('outcome_measured_at'):
            data['outcome_measured_at'] = datetime.fromisoformat(data['outcome_measured_at'])
        return cls(**data)


class ExperienceLogger:
    """
    Logs and tracks agent experiences for continuous learning.

    Example usage:
        logger = ExperienceLogger()

        # Log a new experience
        exp = logger.log_experience(
            experience_type=ExperienceType.BID_DECISION,
            agent_name='ppc_strategist',
            decision_context={'keyword': 'runner rug', 'acos': 45},
            action_taken='reduce_bid',
            reasoning='High ACOS above target',
            confidence=0.8,
            metrics_before={'acos': 45, 'spend': 50, 'sales': 90}
        )

        # After 7 days, record outcome
        logger.record_outcome(
            exp.experience_id,
            metrics_after={'acos': 35, 'spend': 45, 'sales': 120},
            lessons_learned='Bid reduction worked well for this keyword'
        )

        # Query past experiences
        similar = logger.find_similar_experiences(
            experience_type=ExperienceType.BID_DECISION,
            context_filter={'acos_range': (40, 50)}
        )
    """

    def __init__(self, storage_path: Optional[str] = None):
        """Initialize experience logger."""
        self.storage_path = storage_path or os.path.join(
            BASE_DIR, "evolution", "experiences"
        )
        os.makedirs(self.storage_path, exist_ok=True)
        self._db_connection = None
        self._ensure_table()

    def _get_db_connection(self):
        """Get DuckDB connection."""
        if self._db_connection is None:
            from src.data_lake.db_manager import get_db_connection
            self._db_connection = get_db_connection()
        return self._db_connection

    def _ensure_table(self):
        """Ensure experience table exists in DuckDB."""
        con = self._get_db_connection()
        con.execute("""
            CREATE TABLE IF NOT EXISTS fact_agent_experiences (
                experience_id VARCHAR PRIMARY KEY,
                experience_type VARCHAR,
                agent_name VARCHAR,
                decision_context JSON,
                action_taken VARCHAR,
                reasoning TEXT,
                confidence DECIMAL(3,2),
                rag_insights_used JSON,
                metrics_before JSON,
                metrics_after JSON,
                outcome_status VARCHAR DEFAULT 'pending',
                effectiveness_score DECIMAL(3,2),
                lessons_learned TEXT,
                user_feedback INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                outcome_measured_at TIMESTAMP
            )
        """)
        logger.debug("Ensured fact_agent_experiences table exists")

    def log_experience(
        self,
        experience_type: ExperienceType,
        agent_name: str,
        decision_context: Dict[str, Any],
        action_taken: str,
        reasoning: str,
        confidence: float,
        metrics_before: Optional[Dict[str, Any]] = None,
        rag_insights_used: Optional[List[Dict[str, Any]]] = None
    ) -> Experience:
        """
        Log a new experience from an agent decision.

        Args:
            experience_type: Type of experience
            agent_name: Name of the agent making the decision
            decision_context: Full context of the decision
            action_taken: What action was taken
            reasoning: Why this action was chosen
            confidence: Agent's confidence level (0-1)
            metrics_before: Metrics at decision time
            rag_insights_used: RAG insights that informed the decision

        Returns:
            The created Experience object
        """
        experience = Experience(
            experience_id=str(uuid.uuid4())[:12],
            experience_type=experience_type,
            agent_name=agent_name,
            decision_context=decision_context,
            action_taken=action_taken,
            reasoning=reasoning,
            confidence=confidence,
            rag_insights_used=rag_insights_used or [],
            metrics_before=metrics_before or {}
        )

        # Store in DuckDB
        con = self._get_db_connection()
        con.execute("""
            INSERT INTO fact_agent_experiences
            (experience_id, experience_type, agent_name, decision_context,
             action_taken, reasoning, confidence, rag_insights_used,
             metrics_before, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            experience.experience_id,
            experience.experience_type.value,
            experience.agent_name,
            json.dumps(experience.decision_context),
            experience.action_taken,
            experience.reasoning,
            experience.confidence,
            json.dumps(experience.rag_insights_used),
            json.dumps(experience.metrics_before),
            experience.created_at
        ])

        # Also save as JSON file for easy browsing
        self._save_experience_file(experience)

        logger.info(f"Logged experience: {experience.experience_id} - {action_taken}")
        return experience

    def _save_experience_file(self, experience: Experience):
        """Save experience as JSON file."""
        agent_dir = os.path.join(self.storage_path, experience.agent_name)
        os.makedirs(agent_dir, exist_ok=True)

        filename = f"{experience.created_at.strftime('%Y%m%d_%H%M%S')}_{experience.experience_id}.json"
        filepath = os.path.join(agent_dir, filename)

        with open(filepath, 'w') as f:
            json.dump(experience.to_dict(), f, indent=2)

    def record_outcome(
        self,
        experience_id: str,
        metrics_after: Dict[str, Any],
        outcome_status: Optional[OutcomeStatus] = None,
        lessons_learned: str = "",
        user_feedback: Optional[int] = None
    ) -> Optional[Experience]:
        """
        Record the outcome of a past experience.

        This should be called after the follow-up period (typically 7 days).

        Args:
            experience_id: ID of the experience to update
            metrics_after: Metrics after the action was taken
            outcome_status: Manual override of outcome status
            lessons_learned: What was learned from this experience
            user_feedback: User rating (1-5)

        Returns:
            Updated Experience or None if not found
        """
        con = self._get_db_connection()

        # Get existing experience
        result = con.execute("""
            SELECT * FROM fact_agent_experiences
            WHERE experience_id = ?
        """, [experience_id]).fetchone()

        if not result:
            logger.error(f"Experience not found: {experience_id}")
            return None

        # Calculate effectiveness score
        columns = [desc[0] for desc in con.description]
        row_dict = dict(zip(columns, result))
        metrics_before = json.loads(row_dict['metrics_before']) if row_dict['metrics_before'] else {}

        effectiveness = self._calculate_effectiveness(
            row_dict['experience_type'],
            metrics_before,
            metrics_after
        )

        # Determine outcome status if not provided
        if outcome_status is None:
            if effectiveness > 0.2:
                outcome_status = OutcomeStatus.SUCCESS
            elif effectiveness < -0.2:
                outcome_status = OutcomeStatus.FAILURE
            else:
                outcome_status = OutcomeStatus.NEUTRAL

        # Update database
        con.execute("""
            UPDATE fact_agent_experiences
            SET metrics_after = ?,
                outcome_status = ?,
                effectiveness_score = ?,
                lessons_learned = ?,
                user_feedback = ?,
                outcome_measured_at = CURRENT_TIMESTAMP
            WHERE experience_id = ?
        """, [
            json.dumps(metrics_after),
            outcome_status.value,
            effectiveness,
            lessons_learned,
            user_feedback,
            experience_id
        ])

        logger.info(f"Recorded outcome for {experience_id}: {outcome_status.value} "
                   f"(effectiveness: {effectiveness:.2f})")

        return self.get_experience(experience_id)

    def _calculate_effectiveness(
        self,
        experience_type: str,
        metrics_before: Dict[str, Any],
        metrics_after: Dict[str, Any]
    ) -> float:
        """
        Calculate effectiveness score (-1 to 1) based on metrics change.

        Positive score means improvement, negative means degradation.
        """
        if not metrics_before or not metrics_after:
            return 0.0

        score = 0.0
        factors = 0

        if experience_type == 'bid_decision':
            # For bid decisions, lower ACOS is better
            if 'acos' in metrics_before and 'acos' in metrics_after:
                acos_before = metrics_before['acos']
                acos_after = metrics_after['acos']
                if acos_before > 0:
                    # Improvement = reduction in ACOS
                    acos_change = (acos_before - acos_after) / acos_before
                    score += min(1.0, max(-1.0, acos_change))
                    factors += 1

            # More orders is better
            if 'orders' in metrics_before and 'orders' in metrics_after:
                orders_before = metrics_before.get('orders', 0) or 1
                orders_after = metrics_after.get('orders', 0)
                orders_change = (orders_after - orders_before) / max(1, orders_before)
                score += min(1.0, max(-1.0, orders_change * 0.5))
                factors += 1

            # Better rank is better
            if 'rank' in metrics_before and 'rank' in metrics_after:
                rank_before = metrics_before.get('rank', 50)
                rank_after = metrics_after.get('rank', 50)
                if rank_before > 0:
                    # Improvement = lower rank number
                    rank_change = (rank_before - rank_after) / rank_before
                    score += min(1.0, max(-1.0, rank_change * 0.3))
                    factors += 1

        # Average across factors
        if factors > 0:
            score /= factors

        return round(score, 2)

    def get_experience(self, experience_id: str) -> Optional[Experience]:
        """Get an experience by ID."""
        con = self._get_db_connection()

        result = con.execute("""
            SELECT * FROM fact_agent_experiences
            WHERE experience_id = ?
        """, [experience_id]).fetchone()

        if not result:
            return None

        columns = [desc[0] for desc in con.description]
        row_dict = dict(zip(columns, result))

        return Experience(
            experience_id=row_dict['experience_id'],
            experience_type=ExperienceType(row_dict['experience_type']),
            agent_name=row_dict['agent_name'],
            decision_context=json.loads(row_dict['decision_context']) if row_dict['decision_context'] else {},
            action_taken=row_dict['action_taken'],
            reasoning=row_dict['reasoning'],
            confidence=float(row_dict['confidence']) if row_dict['confidence'] else 0.5,
            rag_insights_used=json.loads(row_dict['rag_insights_used']) if row_dict['rag_insights_used'] else [],
            metrics_before=json.loads(row_dict['metrics_before']) if row_dict['metrics_before'] else {},
            metrics_after=json.loads(row_dict['metrics_after']) if row_dict['metrics_after'] else {},
            outcome_status=OutcomeStatus(row_dict['outcome_status']),
            effectiveness_score=float(row_dict['effectiveness_score']) if row_dict['effectiveness_score'] else None,
            lessons_learned=row_dict['lessons_learned'] or '',
            user_feedback=row_dict['user_feedback'],
            created_at=row_dict['created_at'],
            outcome_measured_at=row_dict['outcome_measured_at']
        )

    def find_similar_experiences(
        self,
        experience_type: Optional[ExperienceType] = None,
        agent_name: Optional[str] = None,
        action_taken: Optional[str] = None,
        min_effectiveness: Optional[float] = None,
        limit: int = 10
    ) -> List[Experience]:
        """
        Find similar past experiences.

        Args:
            experience_type: Filter by type
            agent_name: Filter by agent
            action_taken: Filter by action
            min_effectiveness: Only return experiences above this effectiveness
            limit: Maximum number of results

        Returns:
            List of matching experiences
        """
        con = self._get_db_connection()

        query = "SELECT * FROM fact_agent_experiences WHERE 1=1"
        params = []

        if experience_type:
            query += " AND experience_type = ?"
            params.append(experience_type.value)

        if agent_name:
            query += " AND agent_name = ?"
            params.append(agent_name)

        if action_taken:
            query += " AND action_taken = ?"
            params.append(action_taken)

        if min_effectiveness is not None:
            query += " AND effectiveness_score >= ?"
            params.append(min_effectiveness)

        query += f" ORDER BY created_at DESC LIMIT {limit}"

        results = con.execute(query, params).fetchall()
        columns = [desc[0] for desc in con.description]

        experiences = []
        for row in results:
            row_dict = dict(zip(columns, row))
            try:
                exp = Experience(
                    experience_id=row_dict['experience_id'],
                    experience_type=ExperienceType(row_dict['experience_type']),
                    agent_name=row_dict['agent_name'],
                    decision_context=json.loads(row_dict['decision_context']) if row_dict['decision_context'] else {},
                    action_taken=row_dict['action_taken'],
                    reasoning=row_dict['reasoning'] or '',
                    confidence=float(row_dict['confidence']) if row_dict['confidence'] else 0.5,
                    rag_insights_used=[],
                    metrics_before=json.loads(row_dict['metrics_before']) if row_dict['metrics_before'] else {},
                    metrics_after=json.loads(row_dict['metrics_after']) if row_dict['metrics_after'] else {},
                    outcome_status=OutcomeStatus(row_dict['outcome_status']),
                    effectiveness_score=float(row_dict['effectiveness_score']) if row_dict['effectiveness_score'] else None,
                    created_at=row_dict['created_at']
                )
                experiences.append(exp)
            except Exception as e:
                logger.warning(f"Failed to parse experience: {e}")

        return experiences

    def get_pending_outcomes(self, min_age_days: int = 7) -> List[Experience]:
        """Get experiences that need outcome measurement."""
        con = self._get_db_connection()

        results = con.execute(f"""
            SELECT * FROM fact_agent_experiences
            WHERE outcome_status = 'pending'
              AND created_at < CURRENT_TIMESTAMP - INTERVAL {min_age_days} DAY
            ORDER BY created_at ASC
        """).fetchall()

        if not results:
            return []

        columns = [desc[0] for desc in con.description]
        experiences = []

        for row in results:
            row_dict = dict(zip(columns, row))
            try:
                exp = Experience(
                    experience_id=row_dict['experience_id'],
                    experience_type=ExperienceType(row_dict['experience_type']),
                    agent_name=row_dict['agent_name'],
                    decision_context=json.loads(row_dict['decision_context']) if row_dict['decision_context'] else {},
                    action_taken=row_dict['action_taken'],
                    reasoning=row_dict['reasoning'] or '',
                    confidence=float(row_dict['confidence']) if row_dict['confidence'] else 0.5,
                    rag_insights_used=[],
                    metrics_before=json.loads(row_dict['metrics_before']) if row_dict['metrics_before'] else {},
                    outcome_status=OutcomeStatus.PENDING,
                    created_at=row_dict['created_at']
                )
                experiences.append(exp)
            except Exception as e:
                logger.warning(f"Failed to parse experience: {e}")

        return experiences

    def get_effectiveness_summary(self, days: int = 30) -> Dict[str, Any]:
        """Get summary of effectiveness across all experiences."""
        con = self._get_db_connection()

        try:
            result = con.execute(f"""
                SELECT
                    experience_type,
                    action_taken,
                    COUNT(*) as count,
                    AVG(effectiveness_score) as avg_effectiveness,
                    SUM(CASE WHEN outcome_status = 'success' THEN 1 ELSE 0 END) as success_count,
                    SUM(CASE WHEN outcome_status = 'failure' THEN 1 ELSE 0 END) as failure_count
                FROM fact_agent_experiences
                WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL {days} DAY
                  AND outcome_status != 'pending'
                GROUP BY experience_type, action_taken
                ORDER BY count DESC
            """).df()

            return {
                'period_days': days,
                'summary': result.to_dict('records'),
                'total_experiences': int(result['count'].sum()) if len(result) > 0 else 0
            }
        except Exception as e:
            logger.error(f"Failed to get effectiveness summary: {e}")
            return {'period_days': days, 'summary': [], 'total_experiences': 0}


def main():
    """CLI entry point for experience logger."""
    import argparse

    parser = argparse.ArgumentParser(description='Experience Logger')
    parser.add_argument('--pending', action='store_true', help='Show pending outcomes')
    parser.add_argument('--summary', action='store_true', help='Show effectiveness summary')
    parser.add_argument('--days', type=int, default=30, help='Days to look back')

    args = parser.parse_args()

    exp_logger = ExperienceLogger()

    if args.pending:
        pending = exp_logger.get_pending_outcomes(min_age_days=7)
        print(f"\n📋 Pending Outcomes ({len(pending)} experiences)")
        print("=" * 60)
        for exp in pending:
            print(f"\n{exp.experience_id}: {exp.action_taken}")
            print(f"  Agent: {exp.agent_name}")
            print(f"  Created: {exp.created_at}")
            print(f"  Context: {exp.decision_context}")

    elif args.summary:
        summary = exp_logger.get_effectiveness_summary(days=args.days)
        print(f"\n📊 Effectiveness Summary ({args.days} days)")
        print("=" * 60)
        print(f"Total experiences: {summary['total_experiences']}")

        if summary['summary']:
            print("\n| Type | Action | Count | Avg Effectiveness | Success | Failure |")
            print("|------|--------|-------|-------------------|---------|---------|")
            for row in summary['summary']:
                avg_eff = f"{row['avg_effectiveness']:.2f}" if row['avg_effectiveness'] else 'N/A'
                print(f"| {row['experience_type']} | {row['action_taken']} | "
                      f"{row['count']} | {avg_eff} | {row['success_count']} | {row['failure_count']} |")

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
