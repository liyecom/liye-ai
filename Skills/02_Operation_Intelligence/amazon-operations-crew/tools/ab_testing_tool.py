"""
A/B Testing Tool for CrewAI Agents.

Provides experiment management capabilities to CrewAI agents
for listing optimization and testing.
"""

from typing import Dict, Optional, Any

# CrewAI integration with fallback for standalone testing
try:
    from crewai.tools import BaseTool
except ImportError:
    class BaseTool:
        """Fallback BaseTool for testing without crewai installed."""
        def __init__(self):
            pass


class ABTestingTool(BaseTool):
    """
    Tool for managing A/B experiments on Amazon listings.

    Allows agents to:
    - Create new experiments for listing elements
    - Track experiment status
    - Analyze results with statistical significance
    - Generate optimized bullet points
    """

    name: str = "AB Testing Manager"
    description: str = """
    Manage A/B experiments for Amazon listing optimization.

    Actions:
    - create: Create a new A/B test experiment
    - status: Check experiment status
    - analyze: Analyze experiment results
    - optimize_bullets: Generate optimized bullet points from reviews

    Input format:
    {
        "action": "create|status|analyze|optimize_bullets",
        "asin": "ASIN for the experiment",
        "params": {action-specific parameters}
    }
    """

    def __init__(self, db_path: Optional[str] = None, config_path: Optional[str] = None):
        """Initialize A/B testing tool."""
        super().__init__()
        self.db_path = db_path
        self.config_path = config_path
        self._manager = None
        self._optimizer = None

    def _get_manager(self):
        """Lazy initialization of experiment manager."""
        if self._manager is None:
            from src.experiments.experiment_manager import ExperimentManager
            self._manager = ExperimentManager(
                config_path=self.config_path,
                db_path=self.db_path
            )
        return self._manager

    def _get_optimizer(self):
        """Lazy initialization of bullet optimizer."""
        if self._optimizer is None:
            from src.experiments.bullet_optimizer import BulletOptimizer
            self._optimizer = BulletOptimizer(config_path=self.config_path)
        return self._optimizer

    def _run(self, query: str) -> str:
        """Execute the tool with the given query."""
        import json

        try:
            # Parse input
            if isinstance(query, str):
                try:
                    params = json.loads(query)
                except json.JSONDecodeError:
                    # Try to extract action from plain text
                    params = self._parse_text_query(query)
            else:
                params = query

            action = params.get('action', 'status')
            asin = params.get('asin', '')

            if action == 'create':
                return self._create_experiment(asin, params.get('params', {}))
            elif action == 'status':
                return self._get_status(asin, params.get('experiment_id'))
            elif action == 'analyze':
                return self._analyze_experiment(params.get('experiment_id'))
            elif action == 'optimize_bullets':
                return self._optimize_bullets(asin, params.get('params', {}))
            else:
                return f"Unknown action: {action}. Available: create, status, analyze, optimize_bullets"

        except Exception as e:
            return f"Error executing A/B testing action: {str(e)}"

    def _parse_text_query(self, query: str) -> Dict:
        """Parse a plain text query into structured params."""
        query_lower = query.lower()

        if 'create' in query_lower or 'new experiment' in query_lower:
            return {'action': 'create'}
        elif 'status' in query_lower:
            return {'action': 'status'}
        elif 'analyze' in query_lower or 'results' in query_lower:
            return {'action': 'analyze'}
        elif 'optimize' in query_lower or 'bullets' in query_lower:
            return {'action': 'optimize_bullets'}

        return {'action': 'status'}

    def _create_experiment(self, asin: str, params: Dict) -> str:
        """Create a new A/B experiment."""
        from src.experiments.experiment_manager import ExperimentElement

        manager = self._get_manager()

        element_str = params.get('element', 'title').upper()
        try:
            element = ExperimentElement[element_str]
        except KeyError:
            element = ExperimentElement.TITLE

        experiment = manager.create_experiment(
            asin=asin,
            name=params.get('name', f'{element.value} A/B Test'),
            element=element,
            control_content=params.get('control_content', ''),
            treatment_content=params.get('treatment_content', ''),
            hypothesis=params.get('hypothesis', ''),
            duration_days=params.get('duration_days', 14)
        )

        return f"""
## Experiment Created Successfully

- **Experiment ID**: {experiment.experiment_id}
- **ASIN**: {experiment.asin}
- **Element**: {experiment.element.value}
- **Name**: {experiment.name}
- **Status**: {experiment.status.value}
- **Duration**: {experiment.scheduled_duration_days} days

### Variants
1. **Control (A)**: {experiment.control.content[:100]}...
2. **Treatment (B)**: {experiment.treatment.content[:100]}...

### Next Steps
- Start the experiment: Use action 'start' with experiment_id
- Monitor metrics: Use action 'status'
"""

    def _get_status(self, asin: str, experiment_id: Optional[str] = None) -> str:
        """Get experiment status."""
        manager = self._get_manager()

        if experiment_id:
            experiment = manager.get_experiment(experiment_id)
            if not experiment:
                return f"Experiment {experiment_id} not found."
            experiments = [experiment]
        else:
            experiments = manager.list_experiments(asin=asin if asin else None)

        if not experiments:
            return "No experiments found."

        lines = ["## Experiment Status\n"]

        for exp in experiments:
            control = exp.control
            treatment = exp.treatment

            lines.append(f"### {exp.name} ({exp.experiment_id})")
            lines.append(f"- **ASIN**: {exp.asin}")
            lines.append(f"- **Element**: {exp.element.value}")
            lines.append(f"- **Status**: {exp.status.value}")
            lines.append(f"- **Days Running**: {exp.days_running}")

            if control and treatment:
                lines.append("\n#### Metrics Comparison")
                lines.append(f"| Metric | Control | Treatment |")
                lines.append(f"|--------|---------|-----------|")
                lines.append(f"| Sessions | {control.metrics.sessions} | {treatment.metrics.sessions} |")
                lines.append(f"| CVR | {control.metrics.conversion_rate*100:.2f}% | {treatment.metrics.conversion_rate*100:.2f}% |")
                lines.append(f"| Orders | {control.metrics.orders} | {treatment.metrics.orders} |")

            if exp.result:
                lines.append(f"\n#### Current Analysis")
                lines.append(f"- Confidence: {exp.result.confidence*100:.1f}%")
                lines.append(f"- Lift: {exp.result.lift*100:+.1f}%")
                lines.append(f"- Significant: {exp.result.is_significant}")

            lines.append("")

        return "\n".join(lines)

    def _analyze_experiment(self, experiment_id: str) -> str:
        """Analyze experiment results."""
        if not experiment_id:
            return "Please provide an experiment_id to analyze."

        manager = self._get_manager()
        result = manager.analyze_experiment(experiment_id)

        if not result:
            return f"Could not analyze experiment {experiment_id}."

        return manager.generate_report(experiment_id)

    def _optimize_bullets(self, asin: str, params: Dict) -> str:
        """Generate optimized bullet points."""
        optimizer = self._get_optimizer()

        reviews = params.get('reviews', [])
        current_bullets = params.get('current_bullets', [])
        target_keywords = params.get('target_keywords', [])

        if not reviews:
            return """
## No Reviews Provided

Please provide reviews in the params:
```json
{
    "action": "optimize_bullets",
    "asin": "B0C5Q9Y6YF",
    "params": {
        "reviews": [
            {"rating": 5, "title": "Great!", "text": "..."},
            ...
        ],
        "current_bullets": ["...", "..."],
        "target_keywords": ["keyword1", "keyword2"]
    }
}
```
"""

        # Analyze reviews
        analysis = optimizer.analyze_reviews(reviews)

        # Generate optimized bullets
        features = analysis.get('features', [])
        optimized = optimizer.generate_bullets(
            product_name=params.get('product_name', 'Product'),
            features=features,
            target_keywords=target_keywords,
            num_bullets=len(current_bullets) if current_bullets else 5
        )

        lines = [
            "## NLP-Optimized Bullet Points",
            "",
            f"**ASIN**: {asin}",
            f"**Reviews Analyzed**: {analysis['positive_review_count']}",
            f"**Features Extracted**: {len(features)}",
            "",
            "### Top Features from Reviews",
            ""
        ]

        for f in features[:5]:
            lines.append(f"- **{f.category}**: {f.feature} (mentioned {f.frequency}x)")

        lines.extend([
            "",
            "### Optimized Bullets",
            ""
        ])

        for i, bullet in enumerate(optimized, 1):
            lines.append(f"**{i}. [{bullet.header}]**")
            lines.append(f"   {bullet.content}")
            lines.append(f"   _Strategy: {bullet.strategy}, Confidence: {bullet.confidence_score:.2f}_")
            lines.append("")

        if current_bullets:
            control, treatment, comparison = optimizer.generate_ab_test_variants(
                current_bullets=current_bullets,
                reviews=reviews,
                target_keywords=target_keywords
            )

            lines.extend([
                "### A/B Test Recommendation",
                "",
                f"- New categories added: {', '.join(comparison['new_categories_added']) or 'None'}",
                f"- Average confidence: {comparison['average_confidence']:.2f}",
                f"- Strategies used: {', '.join(set(comparison['strategies_used']))}",
                "",
                "**Recommendation**: Create an A/B experiment to test these optimized bullets against the current version."
            ])

        return "\n".join(lines)


class ExperimentStartTool(BaseTool):
    """Tool to start an experiment."""

    name: str = "Start Experiment"
    description: str = "Start a draft experiment. Input: experiment_id"

    def __init__(self, ab_tool: ABTestingTool):
        super().__init__()
        self.ab_tool = ab_tool

    def _run(self, experiment_id: str) -> str:
        """Start the experiment."""
        manager = self.ab_tool._get_manager()
        success = manager.start_experiment(experiment_id.strip())

        if success:
            return f"Experiment {experiment_id} started successfully!"
        else:
            return f"Failed to start experiment {experiment_id}. It may not be in draft status."


class ExperimentStopTool(BaseTool):
    """Tool to stop an experiment."""

    name: str = "Stop Experiment"
    description: str = "Stop a running experiment. Input: experiment_id"

    def __init__(self, ab_tool: ABTestingTool):
        super().__init__()
        self.ab_tool = ab_tool

    def _run(self, experiment_id: str) -> str:
        """Stop the experiment."""
        manager = self.ab_tool._get_manager()
        success = manager.stop_experiment(experiment_id.strip())

        if success:
            experiment = manager.get_experiment(experiment_id.strip())
            result = experiment.result if experiment else None

            if result and result.is_significant:
                return f"""
Experiment {experiment_id} stopped.

## Results
- Winner: {result.winner_variant_id}
- Confidence: {result.confidence*100:.1f}%
- Lift: {result.lift*100:+.1f}%

{'; '.join(result.recommendations)}
"""
            else:
                return f"Experiment {experiment_id} stopped. No significant winner detected yet."
        else:
            return f"Failed to stop experiment {experiment_id}. It may not be running."
