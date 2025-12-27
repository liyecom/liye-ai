"""
Experiments Module - Listing A/B Testing Framework.

Amazon Growth OS - A/B Testing & Optimization
Version: 1.0

Provides:
- Experiment lifecycle management
- Amazon Experiments API integration (structure-ready)
- NLP-based bullet point optimization
- Statistical significance testing
- Experiment reporting and tracking
"""

from .experiment_manager import (
    ExperimentManager,
    Experiment,
    Variant,
    ExperimentStatus,
    ExperimentElement,
    ExperimentResult
)
from .bullet_optimizer import (
    BulletOptimizer,
    FeatureExtractor,
    OptimizedBullet
)

__all__ = [
    'ExperimentManager',
    'Experiment',
    'Variant',
    'ExperimentStatus',
    'ExperimentElement',
    'ExperimentResult',
    'BulletOptimizer',
    'FeatureExtractor',
    'OptimizedBullet'
]
