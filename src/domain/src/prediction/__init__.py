"""
Prediction Module - Conversion Rate Prediction System.

Amazon Growth OS - CVR Prediction & Bid Optimization
Version: 1.0

Provides:
- Feature engineering for keyword/ASIN data
- Rule-based CVR prediction (baseline)
- ML-ready model structure (Gradient Boosting)
- Bid multiplier recommendations
- Model training and evaluation
"""

from .cvr_predictor import (
    CVRPredictor,
    KeywordFeatures,
    ASINFeatures,
    PredictionResult,
    ModelType
)

__all__ = [
    'CVRPredictor',
    'KeywordFeatures',
    'ASINFeatures',
    'PredictionResult',
    'ModelType'
]
