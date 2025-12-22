"""
CVR Predictor - Conversion Rate Prediction Model.

Amazon Growth OS - Predictive Analytics
Version: 1.0

This module provides:
1. Feature engineering for keyword and ASIN data
2. Rule-based CVR prediction (baseline model)
3. ML-ready Gradient Boosting model
4. Bid multiplier recommendations
5. Model training, evaluation, and persistence
"""

import os
import math
import yaml
import json
import logging
import pickle
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class ModelType(Enum):
    """Available model types."""
    RULE_BASED = "rule_based"
    GRADIENT_BOOSTING = "gradient_boosting"
    NEURAL_NETWORK = "neural_network"


@dataclass
class KeywordFeatures:
    """Features extracted from keyword data."""
    keyword: str
    search_volume: float = 0.0
    title_density: float = 50.0
    purchase_rate: float = 0.05
    organic_rank: int = 50
    ppc_position: int = 5

    # Computed features
    log_search_volume: float = 0.0
    rank_score: float = 0.0
    competition_score: float = 0.0

    def compute_derived_features(self):
        """Compute derived features."""
        self.log_search_volume = math.log1p(self.search_volume)
        self.rank_score = 1.0 / (1 + math.log1p(self.organic_rank))
        self.competition_score = 1.0 / (1 + math.log1p(self.title_density))


@dataclass
class ASINFeatures:
    """Features extracted from ASIN data."""
    asin: str
    rating: float = 4.0
    review_count: int = 100
    price: float = 15.99
    category_avg_price: float = 20.00
    image_quality_score: float = 7.0
    category: str = "home_kitchen"

    # Computed features
    price_competitiveness: float = 0.5
    log_review_count: float = 0.0
    rating_score: float = 0.0

    def compute_derived_features(self):
        """Compute derived features."""
        if self.category_avg_price > 0:
            self.price_competitiveness = min(1.0, self.category_avg_price / max(self.price, 1.0))
        self.log_review_count = math.log1p(self.review_count)
        self.rating_score = (self.rating - 1) / 4  # Normalize 1-5 to 0-1


@dataclass
class PredictionResult:
    """Result of CVR prediction."""
    keyword: str
    asin: str
    predicted_cvr: float
    confidence: float  # 0-1 confidence in prediction
    model_type: ModelType
    bid_multiplier: float  # Recommended bid multiplier based on CVR

    # Feature contributions
    feature_contributions: Dict[str, float] = field(default_factory=dict)

    # Metadata
    predicted_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'keyword': self.keyword,
            'asin': self.asin,
            'predicted_cvr': round(self.predicted_cvr, 4),
            'predicted_cvr_pct': f"{self.predicted_cvr * 100:.2f}%",
            'confidence': round(self.confidence, 2),
            'model_type': self.model_type.value,
            'bid_multiplier': round(self.bid_multiplier, 2),
            'feature_contributions': self.feature_contributions,
            'predicted_at': self.predicted_at.isoformat()
        }


class FeatureEngineer:
    """
    Feature engineering for CVR prediction.

    Extracts and normalizes features from keyword and ASIN data.
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config.get('features', {})

    def extract_keyword_features(self, data: Dict[str, Any]) -> KeywordFeatures:
        """Extract keyword features from raw data."""
        kw_config = self.config.get('keyword', {})

        features = KeywordFeatures(
            keyword=data.get('keyword', ''),
            search_volume=data.get('search_volume', kw_config.get('search_volume', {}).get('missing_value', 1000)),
            title_density=data.get('title_density', kw_config.get('title_density', {}).get('missing_value', 50)),
            purchase_rate=data.get('purchase_rate', kw_config.get('purchase_rate', {}).get('missing_value', 0.05)),
            organic_rank=data.get('organic_rank', kw_config.get('organic_rank', {}).get('missing_value', 50)),
            ppc_position=data.get('ppc_position', kw_config.get('ppc_position', {}).get('missing_value', 5))
        )

        features.compute_derived_features()
        return features

    def extract_asin_features(self, data: Dict[str, Any]) -> ASINFeatures:
        """Extract ASIN features from raw data."""
        asin_config = self.config.get('asin', {})

        features = ASINFeatures(
            asin=data.get('asin', ''),
            rating=data.get('rating', asin_config.get('rating', {}).get('missing_value', 4.0)),
            review_count=data.get('review_count', asin_config.get('review_count', {}).get('missing_value', 100)),
            price=data.get('price', 15.99),
            category_avg_price=data.get('category_avg_price', 20.00),
            image_quality_score=data.get('image_quality_score',
                                         asin_config.get('image_quality_score', {}).get('missing_value', 7.0)),
            category=data.get('category', 'home_kitchen')
        )

        features.compute_derived_features()
        return features

    def to_feature_vector(self, kw_features: KeywordFeatures,
                          asin_features: ASINFeatures) -> List[float]:
        """Convert features to a numerical vector for ML model."""
        return [
            kw_features.log_search_volume,
            kw_features.rank_score,
            kw_features.competition_score,
            kw_features.purchase_rate,
            1.0 / (1 + kw_features.ppc_position),
            asin_features.rating_score,
            asin_features.log_review_count,
            asin_features.price_competitiveness,
            asin_features.image_quality_score / 10.0
        ]


class RuleBasedModel:
    """
    Rule-based CVR prediction model.

    Uses industry benchmarks and heuristics for prediction.
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config.get('rule_based', {})
        self.output_config = config.get('output', {})

    def predict(self, kw_features: KeywordFeatures,
                asin_features: ASINFeatures) -> Tuple[float, float, Dict[str, float]]:
        """
        Predict CVR using rule-based logic.

        Returns:
            Tuple of (predicted_cvr, confidence, feature_contributions)
        """
        contributions = {}

        # Base CVR by category
        base_cvr = self.config.get('base_cvr_by_category', {}).get(
            asin_features.category,
            self.config.get('base_cvr_by_category', {}).get('default', 0.10)
        )
        contributions['base_cvr'] = base_cvr

        # Rank multiplier
        rank_mult = self._get_rank_multiplier(kw_features.organic_rank)
        contributions['rank_impact'] = rank_mult - 1.0

        # Rating adjustment
        rating_adj = self._get_rating_adjustment(asin_features.rating)
        contributions['rating_impact'] = rating_adj - 1.0

        # Review count adjustment
        review_adj = self._get_review_adjustment(asin_features.review_count)
        contributions['review_impact'] = review_adj - 1.0

        # Title density adjustment (competition)
        density_adj = self._get_density_adjustment(kw_features.title_density)
        contributions['competition_impact'] = density_adj - 1.0

        # Purchase rate boost
        purchase_boost = 1.0 + (kw_features.purchase_rate - 0.05) * 2
        purchase_boost = max(0.8, min(1.5, purchase_boost))
        contributions['purchase_rate_impact'] = purchase_boost - 1.0

        # Calculate final CVR
        predicted_cvr = base_cvr * rank_mult * rating_adj * review_adj * density_adj * purchase_boost

        # Clamp to valid range
        min_cvr = self.output_config.get('min_cvr', 0.01)
        max_cvr = self.output_config.get('max_cvr', 0.35)
        predicted_cvr = max(min_cvr, min(max_cvr, predicted_cvr))

        # Calculate confidence (higher when more data available)
        confidence = self._calculate_confidence(kw_features, asin_features)

        return predicted_cvr, confidence, contributions

    def _get_rank_multiplier(self, rank: int) -> float:
        """Get multiplier based on organic rank."""
        for rule in self.config.get('rank_multipliers', []):
            if rank <= rule['rank_max']:
                return rule['multiplier']
        return 0.3

    def _get_rating_adjustment(self, rating: float) -> float:
        """Get adjustment based on rating."""
        for rule in self.config.get('rating_adjustments', []):
            if rating >= rule['rating_min']:
                return rule['adjustment']
        return 0.4

    def _get_review_adjustment(self, count: int) -> float:
        """Get adjustment based on review count."""
        for rule in self.config.get('review_adjustments', []):
            if count >= rule['count_min']:
                return rule['adjustment']
        return 0.5

    def _get_density_adjustment(self, density: float) -> float:
        """Get adjustment based on title density."""
        for rule in self.config.get('density_adjustments', []):
            if density <= rule['density_max']:
                return rule['adjustment']
        return 0.7

    def _calculate_confidence(self, kw_features: KeywordFeatures,
                               asin_features: ASINFeatures) -> float:
        """Calculate confidence in prediction."""
        confidence = 0.5  # Base confidence

        # Higher confidence with more search volume data
        if kw_features.search_volume >= 5000:
            confidence += 0.1
        elif kw_features.search_volume >= 1000:
            confidence += 0.05

        # Higher confidence with more reviews
        if asin_features.review_count >= 500:
            confidence += 0.1
        elif asin_features.review_count >= 100:
            confidence += 0.05

        # Higher confidence with known rank
        if kw_features.organic_rank < 50:
            confidence += 0.1

        # Higher confidence with good rating sample
        if asin_features.rating >= 3.5:
            confidence += 0.05

        return min(0.95, confidence)


class MLModel:
    """
    Machine Learning model for CVR prediction.

    Uses Gradient Boosting when trained, falls back to rule-based otherwise.
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config.get('ml_model', {})
        self.model = None
        self.is_trained = False
        self.feature_names = [
            'log_search_volume', 'rank_score', 'competition_score',
            'purchase_rate', 'ppc_position_score', 'rating_score',
            'log_review_count', 'price_competitiveness', 'image_quality_score'
        ]

    def train(self, X: List[List[float]], y: List[float]) -> Dict[str, float]:
        """
        Train the ML model.

        Args:
            X: Feature vectors
            y: Target CVR values

        Returns:
            Training metrics
        """
        try:
            from sklearn.ensemble import GradientBoostingRegressor
            from sklearn.model_selection import cross_val_score
            import numpy as np

            gb_config = self.config.get('gradient_boosting', {})

            self.model = GradientBoostingRegressor(
                n_estimators=gb_config.get('n_estimators', 100),
                max_depth=gb_config.get('max_depth', 5),
                learning_rate=gb_config.get('learning_rate', 0.1),
                min_samples_split=gb_config.get('min_samples_split', 10),
                random_state=42
            )

            X_array = np.array(X)
            y_array = np.array(y)

            # Cross-validation
            cv_folds = self.config.get('cv_folds', 5)
            cv_scores = cross_val_score(self.model, X_array, y_array,
                                        cv=cv_folds, scoring='neg_mean_squared_error')

            # Train on full data
            self.model.fit(X_array, y_array)
            self.is_trained = True

            # Calculate metrics
            predictions = self.model.predict(X_array)
            mae = np.mean(np.abs(predictions - y_array))
            rmse = np.sqrt(np.mean((predictions - y_array) ** 2))
            r2 = 1 - np.sum((predictions - y_array) ** 2) / np.sum((y_array - np.mean(y_array)) ** 2)

            metrics = {
                'mae': float(mae),
                'rmse': float(rmse),
                'r2': float(r2),
                'cv_rmse': float(np.sqrt(-cv_scores.mean())),
                'samples': len(y)
            }

            logger.info(f"ML model trained: MAE={mae:.4f}, RMSE={rmse:.4f}, R2={r2:.4f}")
            return metrics

        except ImportError:
            logger.warning("scikit-learn not installed. ML model unavailable.")
            return {}
        except Exception as e:
            logger.error(f"Training failed: {e}")
            return {}

    def predict(self, features: List[float]) -> Tuple[float, float]:
        """
        Predict CVR using ML model.

        Returns:
            Tuple of (predicted_cvr, confidence)
        """
        if not self.is_trained or self.model is None:
            return 0.0, 0.0

        try:
            import numpy as np
            prediction = self.model.predict([features])[0]
            prediction = max(0.01, min(0.35, prediction))

            # Confidence based on model's training performance
            confidence = 0.7  # Base ML confidence
            return prediction, confidence
        except Exception as e:
            logger.error(f"ML prediction failed: {e}")
            return 0.0, 0.0

    def save(self, path: str):
        """Save model to file."""
        if self.model is not None:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'wb') as f:
                pickle.dump({
                    'model': self.model,
                    'feature_names': self.feature_names,
                    'is_trained': self.is_trained
                }, f)
            logger.info(f"Model saved to {path}")

    def load(self, path: str) -> bool:
        """Load model from file."""
        try:
            with open(path, 'rb') as f:
                data = pickle.load(f)
            self.model = data['model']
            self.feature_names = data.get('feature_names', self.feature_names)
            self.is_trained = data.get('is_trained', True)
            logger.info(f"Model loaded from {path}")
            return True
        except Exception as e:
            logger.warning(f"Failed to load model: {e}")
            return False


class CVRPredictor:
    """
    Main CVR Prediction class.

    Coordinates feature engineering, model selection, and bid integration.

    Example usage:
        predictor = CVRPredictor()

        result = predictor.predict(
            keyword_data={'keyword': 'yoga mat', 'search_volume': 50000, 'organic_rank': 15},
            asin_data={'asin': 'B0123', 'rating': 4.5, 'review_count': 500}
        )

        print(f"Predicted CVR: {result.predicted_cvr:.2%}")
        print(f"Bid multiplier: {result.bid_multiplier}")
    """

    def __init__(self, config_path: Optional[str] = None):
        """Initialize the CVR predictor."""
        self.config_path = config_path or os.path.join(
            BASE_DIR, "config", "cvr_prediction.yaml"
        )
        self.config = self._load_config()

        # Initialize components
        self.feature_engineer = FeatureEngineer(self.config)
        self.rule_model = RuleBasedModel(self.config)
        self.ml_model = MLModel(self.config)

        # Load ML model if available
        model_path = self.config.get('training', {}).get('model_path', 'models/cvr_predictor.pkl')
        full_model_path = os.path.join(BASE_DIR, model_path)
        if os.path.exists(full_model_path):
            self.ml_model.load(full_model_path)

        # Active model type
        self.active_model = ModelType(
            self.config.get('model', {}).get('active_model', 'rule_based')
        )

        self._db_connection = None

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML."""
        try:
            with open(self.config_path, 'r') as f:
                config = yaml.safe_load(f)
            logger.info(f"Loaded CVR prediction config from {self.config_path}")
            return config
        except Exception as e:
            logger.warning(f"Failed to load config: {e}, using defaults")
            return {}

    def _get_db_connection(self):
        """Get DuckDB connection."""
        if self._db_connection is None:
            import sys
            sys.path.insert(0, os.path.join(BASE_DIR, "src"))
            from data_lake.db_manager import get_db_connection
            self._db_connection = get_db_connection()
        return self._db_connection

    def predict(self, keyword_data: Dict[str, Any],
                asin_data: Dict[str, Any]) -> PredictionResult:
        """
        Predict CVR for a keyword-ASIN combination.

        Args:
            keyword_data: Dictionary with keyword features
            asin_data: Dictionary with ASIN features

        Returns:
            PredictionResult with predicted CVR and bid multiplier
        """
        # Extract features
        kw_features = self.feature_engineer.extract_keyword_features(keyword_data)
        asin_features = self.feature_engineer.extract_asin_features(asin_data)

        # Use appropriate model
        if self.active_model == ModelType.GRADIENT_BOOSTING and self.ml_model.is_trained:
            feature_vector = self.feature_engineer.to_feature_vector(kw_features, asin_features)
            predicted_cvr, confidence = self.ml_model.predict(feature_vector)
            contributions = {}  # ML model doesn't provide contributions
            model_type = ModelType.GRADIENT_BOOSTING
        else:
            predicted_cvr, confidence, contributions = self.rule_model.predict(
                kw_features, asin_features
            )
            model_type = ModelType.RULE_BASED

        # Calculate bid multiplier
        bid_multiplier = self._get_bid_multiplier(predicted_cvr)

        return PredictionResult(
            keyword=kw_features.keyword,
            asin=asin_features.asin,
            predicted_cvr=predicted_cvr,
            confidence=confidence,
            model_type=model_type,
            bid_multiplier=bid_multiplier,
            feature_contributions=contributions
        )

    def _get_bid_multiplier(self, cvr: float) -> float:
        """Get bid multiplier based on predicted CVR."""
        bid_config = self.config.get('bid_integration', {})
        if not bid_config.get('enabled', True):
            return 1.0

        for rule in bid_config.get('cvr_multipliers', []):
            if cvr >= rule['cvr_min']:
                return rule['bid_multiplier']
        return 0.6

    def batch_predict(self, data: List[Dict[str, Any]]) -> List[PredictionResult]:
        """
        Predict CVR for multiple keyword-ASIN combinations.

        Args:
            data: List of dictionaries with 'keyword' and 'asin' data

        Returns:
            List of PredictionResult objects
        """
        results = []
        for item in data:
            keyword_data = item.get('keyword', {})
            asin_data = item.get('asin', {})
            result = self.predict(keyword_data, asin_data)
            results.append(result)
        return results

    def train_model(self, lookback_days: int = 90) -> Dict[str, float]:
        """
        Train ML model using historical data from DuckDB.

        Returns:
            Training metrics
        """
        con = self._get_db_connection()
        training_config = self.config.get('training', {})
        min_conversions = training_config.get('min_conversions', 10)

        try:
            # Query historical conversion data
            df = con.execute(f"""
                SELECT
                    keyword,
                    asin,
                    SUM(impressions) as impressions,
                    SUM(clicks) as clicks,
                    SUM(orders) as orders,
                    CASE WHEN SUM(clicks) > 0
                         THEN SUM(orders)::FLOAT / SUM(clicks)
                         ELSE 0
                    END as actual_cvr
                FROM fact_keyword_entry_daily
                WHERE dt >= CURRENT_DATE - {lookback_days}
                GROUP BY keyword, asin
                HAVING SUM(orders) >= {min_conversions}
            """).df()

            if len(df) < self.config.get('model', {}).get('min_training_samples', 500):
                logger.warning(f"Not enough samples for training: {len(df)}")
                return {'error': 'insufficient_samples', 'samples': len(df)}

            # Get features for each keyword-asin pair
            X = []
            y = []

            for _, row in df.iterrows():
                # Get additional features from snapshot
                try:
                    snapshot = con.execute("""
                        SELECT search_volume, organic_rank, ppc_bid
                        FROM fact_keyword_snapshot
                        WHERE keyword = ? AND asin = ?
                        ORDER BY snapshot_date DESC
                        LIMIT 1
                    """, [row['keyword'], row['asin']]).fetchone()

                    keyword_data = {
                        'keyword': row['keyword'],
                        'search_volume': snapshot[0] if snapshot else 1000,
                        'organic_rank': snapshot[1] if snapshot else 50,
                        'title_density': 50  # Default
                    }
                    asin_data = {
                        'asin': row['asin'],
                        'rating': 4.0,  # Default
                        'review_count': 100
                    }

                    kw_features = self.feature_engineer.extract_keyword_features(keyword_data)
                    asin_features = self.feature_engineer.extract_asin_features(asin_data)
                    feature_vector = self.feature_engineer.to_feature_vector(kw_features, asin_features)

                    X.append(feature_vector)
                    y.append(row['actual_cvr'])
                except Exception:
                    continue

            if len(X) < 100:
                logger.warning(f"Not enough valid samples: {len(X)}")
                return {'error': 'insufficient_valid_samples', 'samples': len(X)}

            # Train model
            metrics = self.ml_model.train(X, y)

            # Save model
            model_path = os.path.join(BASE_DIR, training_config.get('model_path', 'models/cvr_predictor.pkl'))
            self.ml_model.save(model_path)

            # Update config
            self.active_model = ModelType.GRADIENT_BOOSTING

            return metrics

        except Exception as e:
            logger.error(f"Training failed: {e}")
            return {'error': str(e)}

    def generate_report(self, predictions: List[PredictionResult]) -> str:
        """Generate a markdown report of predictions."""
        report = []
        report.append("# CVR Prediction Report")
        report.append(f"\n**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"**Model**: {self.active_model.value}")
        report.append(f"**Predictions**: {len(predictions)}")
        report.append("")

        # Summary statistics
        if predictions:
            cvrs = [p.predicted_cvr for p in predictions]
            avg_cvr = sum(cvrs) / len(cvrs)
            max_cvr = max(cvrs)
            min_cvr = min(cvrs)

            report.append("## Summary")
            report.append(f"- Average Predicted CVR: {avg_cvr:.2%}")
            report.append(f"- Range: {min_cvr:.2%} - {max_cvr:.2%}")
            report.append("")

        # Detailed predictions
        report.append("## Predictions")
        report.append("")
        report.append("| Keyword | ASIN | Predicted CVR | Confidence | Bid Mult |")
        report.append("|---------|------|---------------|------------|----------|")

        for p in sorted(predictions, key=lambda x: x.predicted_cvr, reverse=True)[:20]:
            report.append(
                f"| {p.keyword[:25]} | {p.asin} | {p.predicted_cvr:.2%} | "
                f"{p.confidence:.0%} | {p.bid_multiplier:.2f}x |"
            )

        if len(predictions) > 20:
            report.append(f"\n*...and {len(predictions) - 20} more predictions*")

        return "\n".join(report)


def main():
    """CLI entry point for CVR predictor."""
    import argparse

    parser = argparse.ArgumentParser(description='CVR Prediction Model')
    parser.add_argument('--keyword', type=str, help='Keyword to predict')
    parser.add_argument('--asin', type=str, default='B0C5Q9Y6YF', help='ASIN')
    parser.add_argument('--train', action='store_true', help='Train ML model')
    parser.add_argument('--test', action='store_true', help='Run test predictions')

    args = parser.parse_args()

    predictor = CVRPredictor()

    if args.train:
        print("Training ML model...")
        metrics = predictor.train_model()
        print(f"Training complete: {metrics}")
        return

    if args.test:
        # Test predictions
        test_cases = [
            {
                'keyword': {'keyword': 'washable runner rug', 'search_volume': 30000, 'organic_rank': 5, 'title_density': 45, 'purchase_rate': 0.08},
                'asin': {'asin': 'B0C5Q9Y6YF', 'rating': 4.4, 'review_count': 500, 'category': 'home_kitchen'}
            },
            {
                'keyword': {'keyword': 'kitchen floor mat', 'search_volume': 50000, 'organic_rank': 25, 'title_density': 80, 'purchase_rate': 0.05},
                'asin': {'asin': 'B0C5Q9Y6YF', 'rating': 4.4, 'review_count': 500, 'category': 'home_kitchen'}
            },
            {
                'keyword': {'keyword': 'non slip rug pad', 'search_volume': 15000, 'organic_rank': 50, 'title_density': 30, 'purchase_rate': 0.12},
                'asin': {'asin': 'B0C5Q9Y6YF', 'rating': 4.4, 'review_count': 500, 'category': 'home_kitchen'}
            }
        ]

        print("=== CVR Predictions ===\n")
        results = []
        for case in test_cases:
            result = predictor.predict(case['keyword'], case['asin'])
            results.append(result)
            print(f"Keyword: {result.keyword}")
            print(f"  Predicted CVR: {result.predicted_cvr:.2%}")
            print(f"  Confidence: {result.confidence:.0%}")
            print(f"  Bid Multiplier: {result.bid_multiplier:.2f}x")
            print(f"  Contributions: {result.feature_contributions}")
            print()

        # Generate report
        report = predictor.generate_report(results)
        print("\n" + report)
        return

    if args.keyword:
        result = predictor.predict(
            {'keyword': args.keyword, 'search_volume': 10000, 'organic_rank': 20},
            {'asin': args.asin, 'rating': 4.0, 'review_count': 100}
        )
        print(f"Keyword: {result.keyword}")
        print(f"Predicted CVR: {result.predicted_cvr:.2%}")
        print(f"Bid Multiplier: {result.bid_multiplier:.2f}x")


if __name__ == '__main__':
    main()
