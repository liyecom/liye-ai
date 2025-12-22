"""
Experiment Manager - A/B Testing Lifecycle Management.

Provides complete experiment management for Amazon listing optimization
with statistical significance testing and result tracking.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import json
import math
import uuid
import yaml


class ExperimentStatus(Enum):
    """Experiment lifecycle states."""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    STOPPED = "stopped"  # Manually stopped
    FAILED = "failed"


class ExperimentElement(Enum):
    """Testable listing elements."""
    TITLE = "title"
    BULLET_POINTS = "bullet_points"
    MAIN_IMAGE = "main_image"
    A_PLUS_CONTENT = "a_plus_content"
    PRICE = "price"


@dataclass
class VariantMetrics:
    """Metrics for a single variant."""
    sessions: int = 0
    clicks: int = 0
    impressions: int = 0
    add_to_carts: int = 0
    orders: int = 0
    units: int = 0
    revenue: float = 0.0

    @property
    def conversion_rate(self) -> float:
        """Calculate conversion rate."""
        return self.orders / self.sessions if self.sessions > 0 else 0.0

    @property
    def click_through_rate(self) -> float:
        """Calculate CTR."""
        return self.clicks / self.impressions if self.impressions > 0 else 0.0

    @property
    def add_to_cart_rate(self) -> float:
        """Calculate add-to-cart rate."""
        return self.add_to_carts / self.sessions if self.sessions > 0 else 0.0

    @property
    def revenue_per_session(self) -> float:
        """Calculate revenue per session."""
        return self.revenue / self.sessions if self.sessions > 0 else 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'sessions': self.sessions,
            'clicks': self.clicks,
            'impressions': self.impressions,
            'add_to_carts': self.add_to_carts,
            'orders': self.orders,
            'units': self.units,
            'revenue': self.revenue,
            'conversion_rate': self.conversion_rate,
            'click_through_rate': self.click_through_rate,
            'add_to_cart_rate': self.add_to_cart_rate,
            'revenue_per_session': self.revenue_per_session
        }


@dataclass
class Variant:
    """A single variant in an experiment."""
    variant_id: str
    name: str
    content: str  # The actual content being tested
    is_control: bool = False
    metrics: VariantMetrics = field(default_factory=VariantMetrics)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'variant_id': self.variant_id,
            'name': self.name,
            'content': self.content,
            'is_control': self.is_control,
            'metrics': self.metrics.to_dict()
        }


@dataclass
class ExperimentResult:
    """Results of an experiment."""
    experiment_id: str
    winner_variant_id: Optional[str] = None
    confidence: float = 0.0
    lift: float = 0.0  # Percentage improvement over control
    is_significant: bool = False
    p_value: float = 1.0
    analysis_timestamp: datetime = field(default_factory=datetime.now)
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'experiment_id': self.experiment_id,
            'winner_variant_id': self.winner_variant_id,
            'confidence': self.confidence,
            'lift': self.lift,
            'is_significant': self.is_significant,
            'p_value': self.p_value,
            'analysis_timestamp': self.analysis_timestamp.isoformat(),
            'recommendations': self.recommendations
        }


@dataclass
class Experiment:
    """A complete A/B experiment."""
    experiment_id: str
    asin: str
    name: str
    element: ExperimentElement
    variants: List[Variant]
    status: ExperimentStatus = ExperimentStatus.DRAFT
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    scheduled_duration_days: int = 14
    hypothesis: str = ""
    result: Optional[ExperimentResult] = None
    amazon_experiment_id: Optional[str] = None  # For API integration

    @property
    def control(self) -> Optional[Variant]:
        """Get the control variant."""
        for v in self.variants:
            if v.is_control:
                return v
        return None

    @property
    def treatment(self) -> Optional[Variant]:
        """Get the treatment variant (first non-control)."""
        for v in self.variants:
            if not v.is_control:
                return v
        return None

    @property
    def days_running(self) -> int:
        """Days since experiment started."""
        if self.started_at:
            return (datetime.now() - self.started_at).days
        return 0

    @property
    def is_active(self) -> bool:
        """Check if experiment is currently active."""
        return self.status == ExperimentStatus.RUNNING

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'experiment_id': self.experiment_id,
            'asin': self.asin,
            'name': self.name,
            'element': self.element.value,
            'variants': [v.to_dict() for v in self.variants],
            'status': self.status.value,
            'created_at': self.created_at.isoformat(),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'scheduled_duration_days': self.scheduled_duration_days,
            'hypothesis': self.hypothesis,
            'result': self.result.to_dict() if self.result else None,
            'amazon_experiment_id': self.amazon_experiment_id,
            'days_running': self.days_running
        }


class StatisticalCalculator:
    """Statistical significance calculations for A/B tests."""

    @staticmethod
    def z_score(p1: float, p2: float, n1: int, n2: int) -> float:
        """Calculate Z-score for two proportions."""
        if n1 == 0 or n2 == 0:
            return 0.0

        # Pooled proportion
        p_pool = (p1 * n1 + p2 * n2) / (n1 + n2)

        if p_pool == 0 or p_pool == 1:
            return 0.0

        # Standard error
        se = math.sqrt(p_pool * (1 - p_pool) * (1/n1 + 1/n2))

        if se == 0:
            return 0.0

        return (p1 - p2) / se

    @staticmethod
    def p_value_from_z(z: float) -> float:
        """Convert Z-score to P-value (two-tailed)."""
        # Approximation of cumulative normal distribution
        # Using error function approximation
        def erf(x):
            """Approximate error function."""
            a1, a2, a3, a4, a5 = (
                0.254829592, -0.284496736, 1.421413741,
                -1.453152027, 1.061405429
            )
            p = 0.3275911
            sign = 1 if x >= 0 else -1
            x = abs(x)
            t = 1.0 / (1.0 + p * x)
            y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * math.exp(-x*x)
            return sign * y

        # CDF of standard normal
        cdf = 0.5 * (1 + erf(abs(z) / math.sqrt(2)))
        # Two-tailed p-value
        return 2 * (1 - cdf)

    @staticmethod
    def confidence_level(p_value: float) -> float:
        """Convert P-value to confidence level."""
        return 1 - p_value

    @staticmethod
    def calculate_lift(control_rate: float, treatment_rate: float) -> float:
        """Calculate percentage lift from control to treatment."""
        if control_rate == 0:
            return 0.0
        return (treatment_rate - control_rate) / control_rate

    @staticmethod
    def minimum_sample_size(
        baseline_cvr: float,
        minimum_detectable_effect: float,
        power: float = 0.8,
        significance: float = 0.05
    ) -> int:
        """Calculate minimum sample size per variant."""
        # Z-scores for power and significance
        z_alpha = 1.96 if significance == 0.05 else 2.576 if significance == 0.01 else 1.645
        z_beta = 0.84 if power == 0.8 else 1.28 if power == 0.9 else 0.524

        # Expected treatment rate
        treatment_cvr = baseline_cvr * (1 + minimum_detectable_effect)

        # Pooled standard deviation
        p_bar = (baseline_cvr + treatment_cvr) / 2
        sd = math.sqrt(2 * p_bar * (1 - p_bar))

        if sd == 0:
            return 100  # Default minimum

        # Sample size formula
        effect_size = abs(treatment_cvr - baseline_cvr)
        n = ((z_alpha + z_beta) ** 2 * sd ** 2) / (effect_size ** 2)

        return max(100, int(math.ceil(n)))


class ExperimentManager:
    """
    Manages A/B experiments for Amazon listing optimization.

    Features:
    - Experiment lifecycle management (create, start, stop, analyze)
    - Statistical significance testing
    - Result tracking and reporting
    - DuckDB persistence (when available)
    - Amazon Experiments API structure (ready for integration)
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        db_path: Optional[str] = None
    ):
        """Initialize experiment manager."""
        self.config = self._load_config(config_path)
        self.db_path = db_path
        self._db_conn = None
        self.experiments: Dict[str, Experiment] = {}
        self.calculator = StatisticalCalculator()

        # Initialize database tables
        if self.db_path:
            self._init_database()

    def _load_config(self, config_path: Optional[str]) -> Dict:
        """Load configuration from YAML."""
        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)

        # Default configuration
        return {
            'experiment': {
                'min_duration_days': 14,
                'max_duration_days': 90,
                'confidence_level': 0.95,
                'min_sample_size': 100,
                'auto_stop': {
                    'enabled': True,
                    'confidence_threshold': 0.99,
                    'min_lift': 0.05
                }
            }
        }

    def _get_db_connection(self):
        """Get DuckDB connection (lazy initialization)."""
        if self._db_conn is None and self.db_path:
            try:
                import duckdb
                self._db_conn = duckdb.connect(self.db_path)
            except ImportError:
                pass
        return self._db_conn

    def _init_database(self):
        """Initialize experiment tracking tables in DuckDB."""
        conn = self._get_db_connection()
        if conn is None:
            return

        conn.execute("""
            CREATE TABLE IF NOT EXISTS fact_experiments (
                experiment_id VARCHAR PRIMARY KEY,
                asin VARCHAR NOT NULL,
                name VARCHAR NOT NULL,
                element VARCHAR NOT NULL,
                status VARCHAR NOT NULL,
                created_at TIMESTAMP,
                started_at TIMESTAMP,
                ended_at TIMESTAMP,
                scheduled_duration_days INTEGER,
                hypothesis TEXT,
                amazon_experiment_id VARCHAR,
                config_json TEXT
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS fact_experiment_variants (
                variant_id VARCHAR PRIMARY KEY,
                experiment_id VARCHAR NOT NULL,
                name VARCHAR NOT NULL,
                content TEXT,
                is_control BOOLEAN,
                FOREIGN KEY (experiment_id) REFERENCES fact_experiments(experiment_id)
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS fact_experiment_metrics (
                id INTEGER PRIMARY KEY,
                variant_id VARCHAR NOT NULL,
                snapshot_date DATE NOT NULL,
                sessions INTEGER DEFAULT 0,
                clicks INTEGER DEFAULT 0,
                impressions INTEGER DEFAULT 0,
                add_to_carts INTEGER DEFAULT 0,
                orders INTEGER DEFAULT 0,
                units INTEGER DEFAULT 0,
                revenue DECIMAL(10,2) DEFAULT 0,
                FOREIGN KEY (variant_id) REFERENCES fact_experiment_variants(variant_id)
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS fact_experiment_results (
                result_id VARCHAR PRIMARY KEY,
                experiment_id VARCHAR NOT NULL,
                winner_variant_id VARCHAR,
                confidence DECIMAL(5,4),
                lift DECIMAL(5,4),
                is_significant BOOLEAN,
                p_value DECIMAL(10,8),
                analysis_timestamp TIMESTAMP,
                recommendations_json TEXT,
                FOREIGN KEY (experiment_id) REFERENCES fact_experiments(experiment_id)
            )
        """)

    def create_experiment(
        self,
        asin: str,
        name: str,
        element: ExperimentElement,
        control_content: str,
        treatment_content: str,
        hypothesis: str = "",
        duration_days: int = 14
    ) -> Experiment:
        """Create a new A/B experiment."""
        experiment_id = str(uuid.uuid4())[:8]

        # Create variants
        control = Variant(
            variant_id=f"{experiment_id}_A",
            name="Control (A)",
            content=control_content,
            is_control=True
        )

        treatment = Variant(
            variant_id=f"{experiment_id}_B",
            name="Treatment (B)",
            content=treatment_content,
            is_control=False
        )

        # Create experiment
        experiment = Experiment(
            experiment_id=experiment_id,
            asin=asin,
            name=name,
            element=element,
            variants=[control, treatment],
            hypothesis=hypothesis,
            scheduled_duration_days=duration_days
        )

        # Store in memory
        self.experiments[experiment_id] = experiment

        # Persist to database
        self._save_experiment(experiment)

        return experiment

    def _save_experiment(self, experiment: Experiment):
        """Save experiment to database."""
        conn = self._get_db_connection()
        if conn is None:
            return

        # Save experiment
        conn.execute("""
            INSERT OR REPLACE INTO fact_experiments
            (experiment_id, asin, name, element, status, created_at,
             started_at, ended_at, scheduled_duration_days, hypothesis, amazon_experiment_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            experiment.experiment_id,
            experiment.asin,
            experiment.name,
            experiment.element.value,
            experiment.status.value,
            experiment.created_at,
            experiment.started_at,
            experiment.ended_at,
            experiment.scheduled_duration_days,
            experiment.hypothesis,
            experiment.amazon_experiment_id
        ])

        # Save variants
        for variant in experiment.variants:
            conn.execute("""
                INSERT OR REPLACE INTO fact_experiment_variants
                (variant_id, experiment_id, name, content, is_control)
                VALUES (?, ?, ?, ?, ?)
            """, [
                variant.variant_id,
                experiment.experiment_id,
                variant.name,
                variant.content,
                variant.is_control
            ])

    def start_experiment(self, experiment_id: str) -> bool:
        """Start an experiment."""
        if experiment_id not in self.experiments:
            return False

        experiment = self.experiments[experiment_id]

        if experiment.status != ExperimentStatus.DRAFT:
            return False

        experiment.status = ExperimentStatus.RUNNING
        experiment.started_at = datetime.now()

        self._save_experiment(experiment)
        return True

    def stop_experiment(self, experiment_id: str, reason: str = "") -> bool:
        """Stop an experiment early."""
        if experiment_id not in self.experiments:
            return False

        experiment = self.experiments[experiment_id]

        if not experiment.is_active:
            return False

        experiment.status = ExperimentStatus.STOPPED
        experiment.ended_at = datetime.now()

        # Analyze results before stopping
        self.analyze_experiment(experiment_id)

        self._save_experiment(experiment)
        return True

    def update_metrics(
        self,
        experiment_id: str,
        variant_id: str,
        metrics_update: Dict[str, int]
    ):
        """Update metrics for a variant."""
        if experiment_id not in self.experiments:
            return

        experiment = self.experiments[experiment_id]

        for variant in experiment.variants:
            if variant.variant_id == variant_id:
                # Update metrics
                variant.metrics.sessions += metrics_update.get('sessions', 0)
                variant.metrics.clicks += metrics_update.get('clicks', 0)
                variant.metrics.impressions += metrics_update.get('impressions', 0)
                variant.metrics.add_to_carts += metrics_update.get('add_to_carts', 0)
                variant.metrics.orders += metrics_update.get('orders', 0)
                variant.metrics.units += metrics_update.get('units', 0)
                variant.metrics.revenue += metrics_update.get('revenue', 0.0)

                # Save to database
                self._save_variant_metrics(variant)
                break

    def _save_variant_metrics(self, variant: Variant):
        """Save variant metrics snapshot to database."""
        conn = self._get_db_connection()
        if conn is None:
            return

        conn.execute("""
            INSERT INTO fact_experiment_metrics
            (variant_id, snapshot_date, sessions, clicks, impressions,
             add_to_carts, orders, units, revenue)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            variant.variant_id,
            datetime.now().date(),
            variant.metrics.sessions,
            variant.metrics.clicks,
            variant.metrics.impressions,
            variant.metrics.add_to_carts,
            variant.metrics.orders,
            variant.metrics.units,
            variant.metrics.revenue
        ])

    def analyze_experiment(self, experiment_id: str) -> Optional[ExperimentResult]:
        """Analyze experiment and determine winner."""
        if experiment_id not in self.experiments:
            return None

        experiment = self.experiments[experiment_id]
        control = experiment.control
        treatment = experiment.treatment

        if not control or not treatment:
            return None

        # Get conversion rates
        control_cvr = control.metrics.conversion_rate
        treatment_cvr = treatment.metrics.conversion_rate

        # Calculate statistical significance
        z_score = self.calculator.z_score(
            treatment_cvr, control_cvr,
            treatment.metrics.sessions, control.metrics.sessions
        )
        p_value = self.calculator.p_value_from_z(z_score)
        confidence = self.calculator.confidence_level(p_value)
        lift = self.calculator.calculate_lift(control_cvr, treatment_cvr)

        # Determine significance
        config = self.config.get('experiment', {})
        confidence_threshold = config.get('confidence_level', 0.95)
        is_significant = confidence >= confidence_threshold

        # Determine winner
        winner_id = None
        recommendations = []

        if is_significant:
            if treatment_cvr > control_cvr:
                winner_id = treatment.variant_id
                recommendations.append(
                    f"Treatment B wins with {lift*100:.1f}% higher conversion rate"
                )
                recommendations.append(
                    "Recommend: Apply Treatment B content to listing"
                )
            else:
                winner_id = control.variant_id
                recommendations.append(
                    f"Control A wins (Treatment was {abs(lift)*100:.1f}% worse)"
                )
                recommendations.append(
                    "Recommend: Keep current listing content"
                )
        else:
            recommendations.append(
                f"No significant difference detected (confidence: {confidence*100:.1f}%)"
            )
            min_sample = self.calculator.minimum_sample_size(
                control_cvr if control_cvr > 0 else 0.1,
                0.10  # 10% minimum detectable effect
            )
            recommendations.append(
                f"Recommend: Continue test (need ~{min_sample} sessions per variant)"
            )

        # Create result
        result = ExperimentResult(
            experiment_id=experiment_id,
            winner_variant_id=winner_id,
            confidence=confidence,
            lift=lift,
            is_significant=is_significant,
            p_value=p_value,
            recommendations=recommendations
        )

        experiment.result = result

        # Save result to database
        self._save_result(result)

        # Check auto-stop conditions
        auto_stop = config.get('auto_stop', {})
        if auto_stop.get('enabled', False):
            if (confidence >= auto_stop.get('confidence_threshold', 0.99) and
                abs(lift) >= auto_stop.get('min_lift', 0.05)):
                experiment.status = ExperimentStatus.COMPLETED
                experiment.ended_at = datetime.now()
                self._save_experiment(experiment)

        return result

    def _save_result(self, result: ExperimentResult):
        """Save experiment result to database."""
        conn = self._get_db_connection()
        if conn is None:
            return

        result_id = str(uuid.uuid4())[:8]
        conn.execute("""
            INSERT INTO fact_experiment_results
            (result_id, experiment_id, winner_variant_id, confidence, lift,
             is_significant, p_value, analysis_timestamp, recommendations_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            result_id,
            result.experiment_id,
            result.winner_variant_id,
            result.confidence,
            result.lift,
            result.is_significant,
            result.p_value,
            result.analysis_timestamp,
            json.dumps(result.recommendations)
        ])

    def get_experiment(self, experiment_id: str) -> Optional[Experiment]:
        """Get experiment by ID."""
        return self.experiments.get(experiment_id)

    def list_experiments(
        self,
        asin: Optional[str] = None,
        status: Optional[ExperimentStatus] = None
    ) -> List[Experiment]:
        """List experiments with optional filters."""
        experiments = list(self.experiments.values())

        if asin:
            experiments = [e for e in experiments if e.asin == asin]

        if status:
            experiments = [e for e in experiments if e.status == status]

        return sorted(experiments, key=lambda x: x.created_at, reverse=True)

    def generate_report(self, experiment_id: str) -> str:
        """Generate a detailed report for an experiment."""
        experiment = self.get_experiment(experiment_id)
        if not experiment:
            return "Experiment not found."

        control = experiment.control
        treatment = experiment.treatment

        lines = [
            "=" * 60,
            f"A/B EXPERIMENT REPORT: {experiment.name}",
            "=" * 60,
            "",
            "## Experiment Overview",
            f"- **Experiment ID**: {experiment.experiment_id}",
            f"- **ASIN**: {experiment.asin}",
            f"- **Element Tested**: {experiment.element.value}",
            f"- **Status**: {experiment.status.value}",
            f"- **Created**: {experiment.created_at.strftime('%Y-%m-%d %H:%M')}",
        ]

        if experiment.started_at:
            lines.append(f"- **Started**: {experiment.started_at.strftime('%Y-%m-%d %H:%M')}")
            lines.append(f"- **Days Running**: {experiment.days_running}")

        if experiment.hypothesis:
            lines.extend(["", f"**Hypothesis**: {experiment.hypothesis}"])

        lines.extend(["", "## Variant Comparison", ""])

        # Variant comparison table
        if control and treatment:
            lines.extend([
                "| Metric | Control (A) | Treatment (B) | Difference |",
                "|--------|-------------|---------------|------------|",
            ])

            metrics = [
                ("Sessions", control.metrics.sessions, treatment.metrics.sessions),
                ("Impressions", control.metrics.impressions, treatment.metrics.impressions),
                ("Clicks", control.metrics.clicks, treatment.metrics.clicks),
                ("Orders", control.metrics.orders, treatment.metrics.orders),
                ("Revenue", f"${control.metrics.revenue:.2f}", f"${treatment.metrics.revenue:.2f}"),
            ]

            for name, ctrl_val, treat_val in metrics:
                if isinstance(ctrl_val, str):
                    lines.append(f"| {name} | {ctrl_val} | {treat_val} | - |")
                else:
                    diff = treat_val - ctrl_val
                    diff_str = f"+{diff}" if diff > 0 else str(diff)
                    lines.append(f"| {name} | {ctrl_val:,} | {treat_val:,} | {diff_str} |")

            # Rate metrics
            lines.extend([
                "",
                "| Rate Metric | Control (A) | Treatment (B) | Lift |",
                "|-------------|-------------|---------------|------|",
            ])

            rate_metrics = [
                ("CVR", control.metrics.conversion_rate, treatment.metrics.conversion_rate),
                ("CTR", control.metrics.click_through_rate, treatment.metrics.click_through_rate),
                ("ATC Rate", control.metrics.add_to_cart_rate, treatment.metrics.add_to_cart_rate),
            ]

            for name, ctrl_rate, treat_rate in rate_metrics:
                lift = ((treat_rate - ctrl_rate) / ctrl_rate * 100) if ctrl_rate > 0 else 0
                lift_str = f"+{lift:.1f}%" if lift > 0 else f"{lift:.1f}%"
                lines.append(f"| {name} | {ctrl_rate*100:.2f}% | {treat_rate*100:.2f}% | {lift_str} |")

        # Statistical analysis
        if experiment.result:
            result = experiment.result
            lines.extend([
                "",
                "## Statistical Analysis",
                "",
                f"- **Confidence Level**: {result.confidence*100:.1f}%",
                f"- **P-Value**: {result.p_value:.6f}",
                f"- **Lift**: {result.lift*100:+.1f}%",
                f"- **Statistically Significant**: {'Yes' if result.is_significant else 'No'}",
            ])

            if result.winner_variant_id:
                winner_name = "Control (A)" if result.winner_variant_id == control.variant_id else "Treatment (B)"
                lines.append(f"- **Winner**: {winner_name}")

            if result.recommendations:
                lines.extend(["", "## Recommendations", ""])
                for rec in result.recommendations:
                    lines.append(f"- {rec}")

        # Variant content preview
        lines.extend([
            "",
            "## Variant Content",
            "",
            "### Control (A) - Current",
            "```",
            control.content[:500] + ("..." if len(control.content) > 500 else ""),
            "```",
            "",
            "### Treatment (B) - New",
            "```",
            treatment.content[:500] + ("..." if len(treatment.content) > 500 else ""),
            "```"
        ])

        lines.extend(["", "=" * 60])

        return "\n".join(lines)
