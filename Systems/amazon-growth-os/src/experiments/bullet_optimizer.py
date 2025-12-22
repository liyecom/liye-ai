"""
NLP-Based Bullet Point Optimizer.

Extracts high-converting features from positive reviews and competitor
analysis to generate optimized bullet points for A/B testing.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Set
from collections import Counter
import re
import yaml
from pathlib import Path


@dataclass
class ExtractedFeature:
    """A feature extracted from reviews or competitor data."""
    feature: str
    category: str
    frequency: int = 1
    example_quotes: List[str] = field(default_factory=list)
    weight: float = 1.0
    source: str = "reviews"  # reviews, competitors, search_terms

    def __hash__(self):
        return hash(self.feature.lower())

    def __eq__(self, other):
        if isinstance(other, ExtractedFeature):
            return self.feature.lower() == other.feature.lower()
        return False


@dataclass
class OptimizedBullet:
    """A generated optimized bullet point."""
    content: str
    header: str
    benefit: str
    proof: str
    keywords_used: List[str] = field(default_factory=list)
    strategy: str = "benefit_first"
    confidence_score: float = 0.0

    @property
    def full_text(self) -> str:
        """Get the complete bullet point text."""
        return f"【{self.header}】{self.content}"

    def to_dict(self) -> Dict:
        return {
            'content': self.content,
            'header': self.header,
            'benefit': self.benefit,
            'proof': self.proof,
            'keywords_used': self.keywords_used,
            'strategy': self.strategy,
            'confidence_score': self.confidence_score
        }


class FeatureExtractor:
    """
    Extract high-converting features from reviews and competitor data.

    Uses NLP techniques to identify:
    - Frequently mentioned positive features
    - Customer language patterns
    - Emotional triggers
    - Problem-solution pairs
    """

    def __init__(self, config_path: Optional[str] = None):
        """Initialize feature extractor."""
        self.config = self._load_config(config_path)
        self.feature_categories = self.config.get('nlp_optimization', {}).get(
            'feature_categories', self._default_categories()
        )

    def _load_config(self, config_path: Optional[str]) -> Dict:
        """Load configuration."""
        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        return {}

    def _default_categories(self) -> Dict:
        """Default feature categories."""
        return {
            'quality': {
                'keywords': ['durable', 'sturdy', 'quality', 'well-made', 'solid', 'thick', 'premium'],
                'weight': 1.2
            },
            'functionality': {
                'keywords': ['works great', 'easy to use', 'effective', 'convenient', 'practical', 'functional'],
                'weight': 1.1
            },
            'appearance': {
                'keywords': ['looks', 'beautiful', 'stylish', 'nice', 'attractive', 'sleek', 'modern'],
                'weight': 1.0
            },
            'value': {
                'keywords': ['worth', 'value', 'price', 'affordable', 'bargain', 'great deal'],
                'weight': 0.9
            },
            'size_fit': {
                'keywords': ['size', 'fit', 'perfect', 'just right', 'dimensions', 'measures'],
                'weight': 1.0
            },
            'cleaning': {
                'keywords': ['easy to clean', 'washable', 'wipe', 'stain', 'maintenance', 'machine wash'],
                'weight': 0.8
            },
            'comfort': {
                'keywords': ['comfortable', 'soft', 'cushion', 'padded', 'cozy', 'plush'],
                'weight': 1.0
            },
            'durability': {
                'keywords': ['lasts', 'holds up', 'long-lasting', 'durable', 'withstand', 'tough'],
                'weight': 1.1
            }
        }

    def extract_from_reviews(
        self,
        reviews: List[Dict],
        min_rating: int = 4
    ) -> List[ExtractedFeature]:
        """
        Extract features from positive reviews.

        Args:
            reviews: List of review dicts with 'text', 'rating', 'title' keys
            min_rating: Minimum rating to consider

        Returns:
            List of extracted features sorted by relevance
        """
        features: Dict[str, ExtractedFeature] = {}

        for review in reviews:
            rating = review.get('rating', 0)
            if rating < min_rating:
                continue

            text = review.get('text', '') + ' ' + review.get('title', '')
            text = text.lower()

            # Extract features by category
            for category, cat_config in self.feature_categories.items():
                keywords = cat_config.get('keywords', [])
                weight = cat_config.get('weight', 1.0)

                for keyword in keywords:
                    if keyword.lower() in text:
                        # Find context around the keyword
                        pattern = r'.{0,50}' + re.escape(keyword.lower()) + r'.{0,50}'
                        matches = re.findall(pattern, text)

                        feature_key = f"{category}:{keyword}"
                        if feature_key in features:
                            features[feature_key].frequency += 1
                            if matches and len(features[feature_key].example_quotes) < 3:
                                features[feature_key].example_quotes.append(matches[0].strip())
                        else:
                            features[feature_key] = ExtractedFeature(
                                feature=keyword,
                                category=category,
                                frequency=1,
                                example_quotes=[matches[0].strip()] if matches else [],
                                weight=weight,
                                source='reviews'
                            )

        # Sort by weighted frequency
        sorted_features = sorted(
            features.values(),
            key=lambda x: x.frequency * x.weight,
            reverse=True
        )

        return sorted_features

    def extract_from_competitor_bullets(
        self,
        competitor_bullets: List[Dict]
    ) -> List[ExtractedFeature]:
        """
        Extract common patterns from competitor bullet points.

        Args:
            competitor_bullets: List of dicts with 'asin', 'bullets' keys

        Returns:
            List of extracted features from competitors
        """
        all_text = ""
        for comp in competitor_bullets:
            bullets = comp.get('bullets', [])
            all_text += " ".join(bullets).lower() + " "

        features: Dict[str, ExtractedFeature] = {}

        for category, cat_config in self.feature_categories.items():
            keywords = cat_config.get('keywords', [])
            weight = cat_config.get('weight', 1.0)

            for keyword in keywords:
                count = all_text.count(keyword.lower())
                if count > 0:
                    feature_key = f"{category}:{keyword}"
                    features[feature_key] = ExtractedFeature(
                        feature=keyword,
                        category=category,
                        frequency=count,
                        weight=weight,
                        source='competitors'
                    )

        return sorted(
            features.values(),
            key=lambda x: x.frequency * x.weight,
            reverse=True
        )

    def extract_n_grams(
        self,
        text: str,
        n: int = 2,
        min_freq: int = 2
    ) -> List[Tuple[str, int]]:
        """
        Extract frequently occurring n-grams from text.

        Args:
            text: Input text
            n: N-gram size
            min_freq: Minimum frequency threshold

        Returns:
            List of (n-gram, frequency) tuples
        """
        # Tokenize
        words = re.findall(r'\b[a-z]+\b', text.lower())

        # Remove stop words
        stop_words = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'shall',
            'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
            'for', 'on', 'with', 'at', 'by', 'from', 'up', 'about',
            'into', 'over', 'after', 'beneath', 'under', 'above',
            'it', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
            'she', 'we', 'they', 'my', 'your', 'his', 'her', 'its',
            'our', 'their', 'and', 'but', 'or', 'nor', 'so', 'yet'
        }

        words = [w for w in words if w not in stop_words and len(w) > 2]

        # Generate n-grams
        n_grams = [' '.join(words[i:i+n]) for i in range(len(words)-n+1)]

        # Count frequencies
        freq = Counter(n_grams)

        # Filter by minimum frequency
        return [(ng, count) for ng, count in freq.most_common() if count >= min_freq]


class BulletOptimizer:
    """
    Generate optimized bullet points using extracted features.

    Creates data-driven bullet points that:
    - Lead with customer benefits
    - Include proof points from reviews
    - Naturally integrate target keywords
    - Follow conversion optimization patterns
    """

    def __init__(self, config_path: Optional[str] = None):
        """Initialize bullet optimizer."""
        self.config = self._load_config(config_path)
        self.feature_extractor = FeatureExtractor(config_path)

        nlp_config = self.config.get('nlp_optimization', {})
        self.bullet_config = nlp_config.get('bullet_structure', {
            'max_bullets': 5,
            'max_chars_per_bullet': 500,
            'format': 'HEADER + benefit + proof',
            'keyword_density_target': 0.02
        })

        self.strategies = nlp_config.get('strategies', [
            {'name': 'benefit_first', 'priority': 1},
            {'name': 'problem_solution', 'priority': 2},
            {'name': 'social_proof', 'priority': 3},
            {'name': 'sensory_language', 'priority': 4}
        ])

    def _load_config(self, config_path: Optional[str]) -> Dict:
        """Load configuration."""
        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        return {}

    def analyze_reviews(
        self,
        reviews: List[Dict],
        min_rating: int = 4
    ) -> Dict:
        """
        Analyze reviews to extract optimization insights.

        Returns:
            Analysis dict with features, themes, and language patterns
        """
        features = self.feature_extractor.extract_from_reviews(reviews, min_rating)

        # Combine all review text
        all_text = " ".join([
            r.get('text', '') + ' ' + r.get('title', '')
            for r in reviews
            if r.get('rating', 0) >= min_rating
        ])

        # Extract n-grams
        bigrams = self.feature_extractor.extract_n_grams(all_text, n=2, min_freq=2)
        trigrams = self.feature_extractor.extract_n_grams(all_text, n=3, min_freq=2)

        # Group features by category
        category_features: Dict[str, List[ExtractedFeature]] = {}
        for feature in features:
            if feature.category not in category_features:
                category_features[feature.category] = []
            category_features[feature.category].append(feature)

        return {
            'features': features[:20],  # Top 20 features
            'category_breakdown': category_features,
            'common_phrases': bigrams[:10] + trigrams[:10],
            'review_count': len(reviews),
            'positive_review_count': sum(1 for r in reviews if r.get('rating', 0) >= min_rating)
        }

    def generate_bullets(
        self,
        product_name: str,
        features: List[ExtractedFeature],
        target_keywords: List[str] = None,
        num_bullets: int = 5
    ) -> List[OptimizedBullet]:
        """
        Generate optimized bullet points.

        Args:
            product_name: Product name for context
            features: Extracted features to incorporate
            target_keywords: Keywords to naturally include
            num_bullets: Number of bullets to generate

        Returns:
            List of optimized bullet points
        """
        target_keywords = target_keywords or []
        bullets = []

        # Group features by category
        category_features: Dict[str, List[ExtractedFeature]] = {}
        for feature in features:
            if feature.category not in category_features:
                category_features[feature.category] = []
            category_features[feature.category].append(feature)

        # Generate bullets for top categories
        strategies = sorted(self.strategies, key=lambda x: x.get('priority', 99))
        used_categories: Set[str] = set()

        for i, (category, cat_features) in enumerate(
            sorted(category_features.items(), key=lambda x: -sum(f.frequency * f.weight for f in x[1]))
        ):
            if len(bullets) >= num_bullets:
                break

            if category in used_categories:
                continue

            # Get best feature for this category
            best_feature = max(cat_features, key=lambda x: x.frequency * x.weight)

            # Select strategy
            strategy = strategies[i % len(strategies)]
            strategy_name = strategy.get('name', 'benefit_first')

            # Generate bullet based on strategy
            bullet = self._generate_bullet_by_strategy(
                strategy_name,
                category,
                best_feature,
                target_keywords
            )

            if bullet:
                bullets.append(bullet)
                used_categories.add(category)

        # Ensure we have enough bullets
        while len(bullets) < num_bullets and features:
            remaining_features = [
                f for f in features
                if f.category not in used_categories
            ]
            if not remaining_features:
                remaining_features = features

            feature = remaining_features[0]
            bullet = self._generate_bullet_by_strategy(
                'benefit_first',
                feature.category,
                feature,
                target_keywords
            )
            if bullet:
                bullets.append(bullet)

            features = features[1:]

        return bullets[:num_bullets]

    def _generate_bullet_by_strategy(
        self,
        strategy: str,
        category: str,
        feature: ExtractedFeature,
        keywords: List[str]
    ) -> Optional[OptimizedBullet]:
        """Generate a bullet point using a specific strategy."""
        header = self._category_to_header(category)
        keywords_to_use = keywords[:2] if keywords else []

        if strategy == 'benefit_first':
            benefit = self._generate_benefit_statement(feature)
            proof = self._generate_proof_point(feature)
            content = f"{benefit}. {proof}"

        elif strategy == 'problem_solution':
            problem = self._generate_problem_statement(category)
            solution = self._generate_solution_statement(feature)
            content = f"{problem} {solution}"
            benefit = solution
            proof = ""

        elif strategy == 'social_proof':
            benefit = self._generate_benefit_statement(feature)
            if feature.example_quotes:
                proof = f'Customers say: "{feature.example_quotes[0][:100]}..."'
            else:
                proof = "Trusted by thousands of satisfied customers."
            content = f"{benefit}. {proof}"

        elif strategy == 'sensory_language':
            benefit = self._generate_sensory_statement(feature)
            proof = self._generate_proof_point(feature)
            content = f"{benefit}. {proof}"

        else:
            benefit = self._generate_benefit_statement(feature)
            proof = self._generate_proof_point(feature)
            content = f"{benefit}. {proof}"

        # Calculate confidence score based on data support
        confidence = min(1.0, feature.frequency / 10) * feature.weight

        return OptimizedBullet(
            content=content,
            header=header,
            benefit=benefit,
            proof=proof,
            keywords_used=keywords_to_use,
            strategy=strategy,
            confidence_score=confidence
        )

    def _category_to_header(self, category: str) -> str:
        """Convert category to a compelling header."""
        headers = {
            'quality': 'PREMIUM QUALITY',
            'functionality': 'EASY TO USE',
            'appearance': 'STYLISH DESIGN',
            'value': 'GREAT VALUE',
            'size_fit': 'PERFECT FIT',
            'cleaning': 'EASY CARE',
            'comfort': 'ULTIMATE COMFORT',
            'durability': 'BUILT TO LAST'
        }
        return headers.get(category, category.upper().replace('_', ' '))

    def _generate_benefit_statement(self, feature: ExtractedFeature) -> str:
        """Generate a benefit-focused statement."""
        templates = {
            'quality': "Experience the difference of {feature} construction that stands the test of time",
            'functionality': "Enjoy hassle-free use with our {feature} design that makes life easier",
            'appearance': "Transform your space with our {feature} look that impresses guests",
            'value': "Get more for your money with our {feature} product that delivers on quality",
            'size_fit': "Find your perfect match with our {feature} sizing that fits just right",
            'cleaning': "Save time with our {feature} material that stays fresh longer",
            'comfort': "Treat yourself to the {feature} feel that makes every moment enjoyable",
            'durability': "Invest in lasting quality with our {feature} build that endures daily use"
        }

        template = templates.get(feature.category, "Enjoy our {feature} product")
        return template.format(feature=feature.feature)

    def _generate_proof_point(self, feature: ExtractedFeature) -> str:
        """Generate a proof point for credibility."""
        if feature.example_quotes:
            # Use actual customer language
            quote = feature.example_quotes[0][:80]
            return f'As one customer noted: "{quote}..."'

        # Generic proof points by category
        proofs = {
            'quality': "Crafted with premium materials for lasting performance.",
            'functionality': "Designed for effortless operation every single time.",
            'appearance': "A beautiful addition that complements any decor.",
            'value': "Outstanding quality without the premium price tag.",
            'size_fit': "Precisely measured to ensure a perfect match.",
            'cleaning': "Simply wipe clean or machine wash for easy maintenance.",
            'comfort': "Thoughtfully designed for maximum comfort.",
            'durability': "Rigorously tested to withstand everyday wear and tear."
        }

        return proofs.get(feature.category, "Designed with your needs in mind.")

    def _generate_problem_statement(self, category: str) -> str:
        """Generate a problem statement for problem-solution format."""
        problems = {
            'quality': "Tired of products that fall apart after a few uses?",
            'functionality': "Frustrated with complicated products that waste your time?",
            'appearance': "Looking for something that actually looks good in your home?",
            'value': "Want quality without breaking the bank?",
            'size_fit': "Struggling to find the right size?",
            'cleaning': "Hate spending hours on cleaning and maintenance?",
            'comfort': "Suffering from uncomfortable products?",
            'durability': "Tired of replacing products every few months?"
        }
        return problems.get(category, "Looking for a better solution?")

    def _generate_solution_statement(self, feature: ExtractedFeature) -> str:
        """Generate a solution statement."""
        return f"Our {feature.feature} design solves this problem, giving you the results you deserve."

    def _generate_sensory_statement(self, feature: ExtractedFeature) -> str:
        """Generate a sensory-rich statement."""
        templates = {
            'quality': "Feel the solid, substantial weight of {feature} craftsmanship",
            'functionality': "Experience the smooth, effortless operation of our {feature} system",
            'appearance': "Admire the sleek, polished {feature} finish that catches the eye",
            'value': "Discover the satisfying feeling of getting {feature} quality at this price",
            'size_fit': "Enjoy the snug, precise {feature} that feels custom-made",
            'cleaning': "Love the fresh, clean feel of our {feature} surface",
            'comfort': "Sink into the plush, welcoming {feature} embrace",
            'durability': "Trust the rock-solid, dependable {feature} construction"
        }

        template = templates.get(feature.category, "Experience our {feature} product")
        return template.format(feature=feature.feature)

    def compare_bullets(
        self,
        original_bullets: List[str],
        optimized_bullets: List[OptimizedBullet]
    ) -> Dict:
        """
        Compare original vs optimized bullets.

        Returns:
            Comparison analysis dict
        """
        original_word_count = sum(len(b.split()) for b in original_bullets)
        optimized_word_count = sum(len(b.content.split()) for b in optimized_bullets)

        original_text = " ".join(original_bullets).lower()
        optimized_text = " ".join(b.content for b in optimized_bullets).lower()

        # Check for feature categories
        original_categories = set()
        optimized_categories = set()

        for category, config in self.feature_extractor.feature_categories.items():
            for keyword in config.get('keywords', []):
                if keyword.lower() in original_text:
                    original_categories.add(category)
                if keyword.lower() in optimized_text:
                    optimized_categories.add(category)

        return {
            'original_word_count': original_word_count,
            'optimized_word_count': optimized_word_count,
            'original_categories': list(original_categories),
            'optimized_categories': list(optimized_categories),
            'new_categories_added': list(optimized_categories - original_categories),
            'categories_preserved': list(original_categories & optimized_categories),
            'average_confidence': sum(b.confidence_score for b in optimized_bullets) / len(optimized_bullets) if optimized_bullets else 0,
            'strategies_used': [b.strategy for b in optimized_bullets]
        }

    def generate_ab_test_variants(
        self,
        current_bullets: List[str],
        reviews: List[Dict],
        target_keywords: List[str] = None
    ) -> Tuple[List[str], List[OptimizedBullet], Dict]:
        """
        Generate A/B test variants for bullet points.

        Args:
            current_bullets: Current bullet points (Control)
            reviews: Customer reviews for feature extraction
            target_keywords: Keywords to include

        Returns:
            Tuple of (control, treatment, comparison_analysis)
        """
        # Analyze reviews
        analysis = self.analyze_reviews(reviews)

        # Extract features
        features = analysis.get('features', [])

        # Generate optimized bullets
        optimized = self.generate_bullets(
            product_name="",  # Can be enhanced
            features=features,
            target_keywords=target_keywords,
            num_bullets=len(current_bullets)
        )

        # Compare
        comparison = self.compare_bullets(current_bullets, optimized)

        return current_bullets, optimized, comparison
