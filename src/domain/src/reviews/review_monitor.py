"""
Review Monitor - VOC Intelligence System.

Amazon Growth OS - Review Monitoring & Alert Engine
Version: 1.0

This module provides:
1. Review data model and storage (DuckDB)
2. Sentiment analysis (rule-based + keyword matching)
3. Topic extraction (category classification)
4. Alert engine (spike detection, critical keywords, rating drops)
5. Report generation
"""

import os
import re
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


class Sentiment(Enum):
    """Review sentiment classification."""
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class AlertType(Enum):
    """Types of review alerts."""
    NEGATIVE_SPIKE = "negative_spike"
    RATING_DROP = "rating_drop"
    CRITICAL_KEYWORD = "critical_keyword"
    COMPETITOR_MENTION = "competitor_mention"


class AlertPriority(Enum):
    """Alert priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ReviewTopic:
    """Extracted topic from review."""
    category: str  # e.g., "size", "quality", "cleaning"
    keywords_matched: List[str]
    sentiment: Sentiment
    importance: str  # "high", "medium", "low"


@dataclass
class Review:
    """Amazon product review data model."""
    review_id: str
    asin: str
    title: str
    body: str
    rating: int  # 1-5 stars
    author: str
    verified_purchase: bool
    review_date: datetime
    helpful_votes: int = 0

    # Analysis results
    sentiment: Sentiment = Sentiment.NEUTRAL
    sentiment_score: float = 0.0
    topics: List[ReviewTopic] = field(default_factory=list)
    critical_keywords: List[str] = field(default_factory=list)

    # Metadata
    collected_at: datetime = field(default_factory=datetime.now)
    source: str = "manual"  # "amazon_api", "keepa", "helium10", "manual"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            'review_id': self.review_id,
            'asin': self.asin,
            'title': self.title,
            'body': self.body,
            'rating': self.rating,
            'author': self.author,
            'verified_purchase': self.verified_purchase,
            'review_date': self.review_date.isoformat() if self.review_date else None,
            'helpful_votes': self.helpful_votes,
            'sentiment': self.sentiment.value,
            'sentiment_score': self.sentiment_score,
            'topics': [{'category': t.category, 'keywords': t.keywords_matched,
                       'sentiment': t.sentiment.value} for t in self.topics],
            'critical_keywords': self.critical_keywords,
            'collected_at': self.collected_at.isoformat(),
            'source': self.source
        }


@dataclass
class ReviewAlert:
    """Alert generated from review analysis."""
    alert_id: str
    alert_type: AlertType
    priority: AlertPriority
    asin: str
    title: str
    description: str
    reviews_involved: List[str]  # review_ids
    triggered_at: datetime = field(default_factory=datetime.now)
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'alert_id': self.alert_id,
            'alert_type': self.alert_type.value,
            'priority': self.priority.value,
            'asin': self.asin,
            'title': self.title,
            'description': self.description,
            'reviews_involved': self.reviews_involved,
            'triggered_at': self.triggered_at.isoformat(),
            'acknowledged': self.acknowledged,
            'acknowledged_at': self.acknowledged_at.isoformat() if self.acknowledged_at else None
        }


class SentimentAnalyzer:
    """
    Rule-based sentiment analyzer for Amazon reviews.

    Uses keyword matching and rating heuristics.
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config.get('sentiment', {})
        self.thresholds = self.config.get('thresholds', {
            'positive': 0.6,
            'negative': -0.3
        })
        self.positive_keywords = set(
            kw.lower() for kw in self.config.get('positive_keywords', [])
        )
        self.negative_keywords = set(
            kw.lower() for kw in self.config.get('negative_keywords', [])
        )

    def analyze(self, review: Review) -> Tuple[Sentiment, float]:
        """
        Analyze sentiment of a review.

        Returns (Sentiment, score) where score is -1.0 to 1.0
        """
        text = f"{review.title} {review.body}".lower()

        # Base score from rating (1-5 stars mapped to -1.0 to 1.0)
        rating_score = (review.rating - 3) / 2.0  # 1=-1, 3=0, 5=1

        # Keyword score
        positive_count = sum(1 for kw in self.positive_keywords if kw in text)
        negative_count = sum(1 for kw in self.negative_keywords if kw in text)

        keyword_score = 0.0
        total_keywords = positive_count + negative_count
        if total_keywords > 0:
            keyword_score = (positive_count - negative_count) / total_keywords

        # Combined score (rating has more weight)
        final_score = 0.7 * rating_score + 0.3 * keyword_score

        # Classify
        if final_score >= self.thresholds['positive']:
            sentiment = Sentiment.POSITIVE
        elif final_score <= self.thresholds['negative']:
            sentiment = Sentiment.NEGATIVE
        else:
            sentiment = Sentiment.NEUTRAL

        return sentiment, round(final_score, 3)


class TopicExtractor:
    """
    Extract topics from review text based on keyword matching.
    """

    def __init__(self, config: Dict[str, Any]):
        self.topics_config = config.get('topics', {}).get('categories', {})

    def extract(self, review: Review) -> List[ReviewTopic]:
        """Extract topics from review text."""
        text = f"{review.title} {review.body}".lower()
        topics = []

        for category, config in self.topics_config.items():
            keywords = config.get('keywords', [])
            matched = [kw for kw in keywords if kw.lower() in text]

            if matched:
                # Determine sentiment for this topic based on context
                topic_sentiment = self._analyze_topic_sentiment(text, matched, review.rating)

                topics.append(ReviewTopic(
                    category=category,
                    keywords_matched=matched,
                    sentiment=topic_sentiment,
                    importance=config.get('importance', 'medium')
                ))

        return topics

    def _analyze_topic_sentiment(self, text: str, keywords: List[str],
                                  rating: int) -> Sentiment:
        """Analyze sentiment for a specific topic in context."""
        # Simple heuristic: use overall rating
        if rating >= 4:
            return Sentiment.POSITIVE
        elif rating <= 2:
            return Sentiment.NEGATIVE
        return Sentiment.NEUTRAL


class AlertEngine:
    """
    Generate alerts based on review patterns.
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config.get('alerts', {})
        self.alert_history: List[ReviewAlert] = []
        self._cooldown_cache: Dict[str, datetime] = {}
        self.cooldown_minutes = config.get('notifications', {}).get('cooldown_minutes', 60)

    def check_alerts(self, reviews: List[Review], asin: str) -> List[ReviewAlert]:
        """
        Check all alert conditions and return triggered alerts.
        """
        alerts = []

        # Check negative spike
        if self.config.get('negative_spike', {}).get('enabled', True):
            alert = self._check_negative_spike(reviews, asin)
            if alert:
                alerts.append(alert)

        # Check critical keywords
        if self.config.get('critical_keywords', {}).get('enabled', True):
            keyword_alerts = self._check_critical_keywords(reviews, asin)
            alerts.extend(keyword_alerts)

        # Check rating drop
        if self.config.get('rating_drop', {}).get('enabled', True):
            alert = self._check_rating_drop(reviews, asin)
            if alert:
                alerts.append(alert)

        # Check competitor mentions
        if self.config.get('competitor_mention', {}).get('enabled', True):
            mention_alerts = self._check_competitor_mentions(reviews, asin)
            alerts.extend(mention_alerts)

        # Filter by cooldown
        alerts = self._apply_cooldown(alerts)

        self.alert_history.extend(alerts)
        return alerts

    def _check_negative_spike(self, reviews: List[Review], asin: str) -> Optional[ReviewAlert]:
        """Check for spike in negative reviews."""
        config = self.config.get('negative_spike', {})
        threshold = config.get('threshold', 2)
        window_hours = config.get('window_hours', 24)
        min_severity = config.get('min_severity', 3)  # 1-2 star reviews

        cutoff = datetime.now() - timedelta(hours=window_hours)

        # Filter recent negative reviews
        recent_negative = [
            r for r in reviews
            if r.asin == asin
            and r.review_date >= cutoff
            and r.rating <= (5 - min_severity + 1)  # Convert severity to rating
        ]

        if len(recent_negative) >= threshold:
            avg_rating = sum(r.rating for r in recent_negative) / len(recent_negative)
            return ReviewAlert(
                alert_id=str(uuid.uuid4())[:8],
                alert_type=AlertType.NEGATIVE_SPIKE,
                priority=AlertPriority.HIGH,
                asin=asin,
                title=f"Negative Review Spike Detected",
                description=(
                    f"{len(recent_negative)} negative reviews in last {window_hours}h. "
                    f"Average rating: {avg_rating:.1f} stars."
                ),
                reviews_involved=[r.review_id for r in recent_negative]
            )

        return None

    def _check_critical_keywords(self, reviews: List[Review],
                                  asin: str) -> List[ReviewAlert]:
        """Check for critical keywords in reviews."""
        config = self.config.get('critical_keywords', {})
        keywords = [kw.lower() for kw in config.get('keywords', [])]

        alerts = []
        for review in reviews:
            if review.asin != asin:
                continue

            text = f"{review.title} {review.body}".lower()
            found_keywords = [kw for kw in keywords if kw in text]

            if found_keywords:
                alerts.append(ReviewAlert(
                    alert_id=str(uuid.uuid4())[:8],
                    alert_type=AlertType.CRITICAL_KEYWORD,
                    priority=AlertPriority.HIGH,
                    asin=asin,
                    title=f"Critical Keywords Found",
                    description=(
                        f"Review contains: {', '.join(found_keywords)}. "
                        f"Rating: {review.rating} stars."
                    ),
                    reviews_involved=[review.review_id]
                ))

        return alerts

    def _check_rating_drop(self, reviews: List[Review], asin: str) -> Optional[ReviewAlert]:
        """Check for significant rating drop."""
        config = self.config.get('rating_drop', {})
        drop_threshold = config.get('drop_threshold', 0.2)
        comparison_days = config.get('comparison_window_days', 7)
        min_reviews = config.get('min_reviews', 10)

        asin_reviews = [r for r in reviews if r.asin == asin]
        if len(asin_reviews) < min_reviews:
            return None

        # Sort by date
        asin_reviews.sort(key=lambda r: r.review_date)

        # Split into recent vs historical
        cutoff = datetime.now() - timedelta(days=comparison_days)
        recent = [r for r in asin_reviews if r.review_date >= cutoff]
        historical = [r for r in asin_reviews if r.review_date < cutoff]

        if not recent or not historical:
            return None

        recent_avg = sum(r.rating for r in recent) / len(recent)
        historical_avg = sum(r.rating for r in historical) / len(historical)

        drop = historical_avg - recent_avg
        if drop >= drop_threshold:
            return ReviewAlert(
                alert_id=str(uuid.uuid4())[:8],
                alert_type=AlertType.RATING_DROP,
                priority=AlertPriority.MEDIUM,
                asin=asin,
                title=f"Rating Drop Detected",
                description=(
                    f"Rating dropped from {historical_avg:.2f} to {recent_avg:.2f} "
                    f"(drop of {drop:.2f} stars) in last {comparison_days} days."
                ),
                reviews_involved=[r.review_id for r in recent]
            )

        return None

    def _check_competitor_mentions(self, reviews: List[Review],
                                    asin: str) -> List[ReviewAlert]:
        """Check for competitor brand mentions."""
        config = self.config.get('competitor_mention', {})
        competitors = [c.lower() for c in config.get('competitor_brands', [])]

        alerts = []
        for review in reviews:
            if review.asin != asin:
                continue

            text = f"{review.title} {review.body}".lower()
            mentioned = [c for c in competitors if c in text]

            if mentioned:
                alerts.append(ReviewAlert(
                    alert_id=str(uuid.uuid4())[:8],
                    alert_type=AlertType.COMPETITOR_MENTION,
                    priority=AlertPriority.LOW,
                    asin=asin,
                    title=f"Competitor Mentioned",
                    description=(
                        f"Competitor brands mentioned: {', '.join(mentioned)}. "
                        f"Rating: {review.rating} stars."
                    ),
                    reviews_involved=[review.review_id]
                ))

        return alerts

    def _apply_cooldown(self, alerts: List[ReviewAlert]) -> List[ReviewAlert]:
        """Filter alerts based on cooldown period."""
        filtered = []
        now = datetime.now()

        for alert in alerts:
            cache_key = f"{alert.asin}:{alert.alert_type.value}"
            last_alert = self._cooldown_cache.get(cache_key)

            if last_alert and (now - last_alert).total_seconds() < self.cooldown_minutes * 60:
                logger.debug(f"Alert {cache_key} skipped due to cooldown")
                continue

            self._cooldown_cache[cache_key] = now
            filtered.append(alert)

        return filtered


class ReviewMonitor:
    """
    Main review monitoring class.

    Coordinates sentiment analysis, topic extraction, and alerts.

    Example usage:
        monitor = ReviewMonitor()

        # Add a review
        review = Review(
            review_id="R123",
            asin="B0C5Q9Y6YF",
            title="Great rug!",
            body="Love the quality...",
            rating=5,
            author="John",
            verified_purchase=True,
            review_date=datetime.now()
        )

        # Analyze and check alerts
        analyzed = monitor.analyze_review(review)
        alerts = monitor.check_alerts("B0C5Q9Y6YF")
    """

    def __init__(self, config_path: Optional[str] = None):
        """Initialize the review monitor."""
        self.config_path = config_path or os.path.join(
            BASE_DIR, "config", "review_alerts.yaml"
        )
        self.config = self._load_config()

        # Initialize components
        self.sentiment_analyzer = SentimentAnalyzer(self.config)
        self.topic_extractor = TopicExtractor(self.config)
        self.alert_engine = AlertEngine(self.config)

        # Storage
        self.reviews: Dict[str, Review] = {}  # review_id -> Review
        self._db_connection = None

        # Ensure tables exist
        self._init_tables()

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML."""
        try:
            with open(self.config_path, 'r') as f:
                config = yaml.safe_load(f)
            logger.info(f"Loaded review monitor config from {self.config_path}")
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

    def _init_tables(self):
        """Initialize database tables for reviews and alerts."""
        con = self._get_db_connection()

        # Reviews table
        con.execute("""
            CREATE TABLE IF NOT EXISTS dim_reviews (
                review_id VARCHAR PRIMARY KEY,
                asin VARCHAR,
                title VARCHAR,
                body TEXT,
                rating INT,
                author VARCHAR,
                verified_purchase BOOLEAN,
                review_date TIMESTAMP,
                helpful_votes INT DEFAULT 0,
                sentiment VARCHAR,
                sentiment_score DECIMAL(4,3),
                topics JSON,
                critical_keywords JSON,
                collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                source VARCHAR DEFAULT 'manual'
            )
        """)

        # Alerts table
        con.execute("""
            CREATE TABLE IF NOT EXISTS fact_review_alerts (
                alert_id VARCHAR PRIMARY KEY,
                alert_type VARCHAR,
                priority VARCHAR,
                asin VARCHAR,
                title VARCHAR,
                description TEXT,
                reviews_involved JSON,
                triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                acknowledged BOOLEAN DEFAULT FALSE,
                acknowledged_at TIMESTAMP
            )
        """)

        logger.info("Review tables initialized")

    def analyze_review(self, review: Review) -> Review:
        """
        Analyze a single review for sentiment and topics.

        Modifies the review in-place and returns it.
        """
        # Sentiment analysis
        sentiment, score = self.sentiment_analyzer.analyze(review)
        review.sentiment = sentiment
        review.sentiment_score = score

        # Topic extraction
        review.topics = self.topic_extractor.extract(review)

        # Check critical keywords
        critical_config = self.config.get('alerts', {}).get('critical_keywords', {})
        critical_keywords = [kw.lower() for kw in critical_config.get('keywords', [])]
        text = f"{review.title} {review.body}".lower()
        review.critical_keywords = [kw for kw in critical_keywords if kw in text]

        return review

    def add_review(self, review: Review, analyze: bool = True) -> Review:
        """
        Add a review to the monitor.

        Args:
            review: Review to add
            analyze: Whether to analyze sentiment and topics

        Returns:
            The analyzed review
        """
        if analyze:
            review = self.analyze_review(review)

        # Store in memory
        self.reviews[review.review_id] = review

        # Store in database
        self._save_review(review)

        logger.info(f"Added review {review.review_id}: {review.sentiment.value} ({review.sentiment_score})")
        return review

    def _save_review(self, review: Review):
        """Save review to database."""
        con = self._get_db_connection()

        import json
        topics_json = json.dumps([
            {'category': t.category, 'keywords': t.keywords_matched}
            for t in review.topics
        ])
        keywords_json = json.dumps(review.critical_keywords)

        con.execute("""
            INSERT OR REPLACE INTO dim_reviews
            (review_id, asin, title, body, rating, author, verified_purchase,
             review_date, helpful_votes, sentiment, sentiment_score,
             topics, critical_keywords, collected_at, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            review.review_id, review.asin, review.title, review.body,
            review.rating, review.author, review.verified_purchase,
            review.review_date, review.helpful_votes,
            review.sentiment.value, review.sentiment_score,
            topics_json, keywords_json, review.collected_at, review.source
        ])

    def check_alerts(self, asin: str) -> List[ReviewAlert]:
        """
        Check all alert conditions for an ASIN.

        Returns list of triggered alerts.
        """
        asin_reviews = [r for r in self.reviews.values() if r.asin == asin]
        alerts = self.alert_engine.check_alerts(asin_reviews, asin)

        # Save alerts to database
        for alert in alerts:
            self._save_alert(alert)

        return alerts

    def _save_alert(self, alert: ReviewAlert):
        """Save alert to database."""
        con = self._get_db_connection()

        import json
        reviews_json = json.dumps(alert.reviews_involved)

        con.execute("""
            INSERT INTO fact_review_alerts
            (alert_id, alert_type, priority, asin, title, description,
             reviews_involved, triggered_at, acknowledged)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            alert.alert_id, alert.alert_type.value, alert.priority.value,
            alert.asin, alert.title, alert.description,
            reviews_json, alert.triggered_at, alert.acknowledged
        ])

        logger.warning(f"ALERT [{alert.priority.value.upper()}]: {alert.title} - {alert.description}")

    def get_asin_summary(self, asin: str) -> Dict[str, Any]:
        """
        Get summary statistics for an ASIN.
        """
        asin_reviews = [r for r in self.reviews.values() if r.asin == asin]

        if not asin_reviews:
            return {'asin': asin, 'total_reviews': 0}

        # Sentiment breakdown
        sentiment_counts = {s.value: 0 for s in Sentiment}
        for r in asin_reviews:
            sentiment_counts[r.sentiment.value] += 1

        # Topic frequency
        topic_counts: Dict[str, int] = {}
        for r in asin_reviews:
            for t in r.topics:
                topic_counts[t.category] = topic_counts.get(t.category, 0) + 1

        # Rating stats
        ratings = [r.rating for r in asin_reviews]
        avg_rating = sum(ratings) / len(ratings)

        return {
            'asin': asin,
            'total_reviews': len(asin_reviews),
            'average_rating': round(avg_rating, 2),
            'sentiment_breakdown': sentiment_counts,
            'topic_frequency': dict(sorted(
                topic_counts.items(), key=lambda x: x[1], reverse=True
            )),
            'critical_keyword_count': sum(
                len(r.critical_keywords) for r in asin_reviews
            )
        }

    def generate_report(self, asin: str) -> str:
        """Generate a markdown report for an ASIN."""
        summary = self.get_asin_summary(asin)

        if summary['total_reviews'] == 0:
            return f"# Review Report: {asin}\n\nNo reviews found."

        report = []
        report.append(f"# Review Monitoring Report")
        report.append(f"\n**ASIN**: {asin}")
        report.append(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"**Total Reviews Analyzed**: {summary['total_reviews']}")
        report.append(f"**Average Rating**: {summary['average_rating']:.1f} stars")
        report.append("")

        # Sentiment breakdown
        report.append("## Sentiment Breakdown")
        total = summary['total_reviews']
        for sentiment, count in summary['sentiment_breakdown'].items():
            pct = count / total * 100
            bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
            report.append(f"- **{sentiment.capitalize()}**: {count} ({pct:.0f}%) {bar}")
        report.append("")

        # Top topics
        report.append("## Topic Frequency")
        for topic, count in list(summary['topic_frequency'].items())[:5]:
            report.append(f"- **{topic.capitalize()}**: {count} mentions")
        report.append("")

        # Critical keywords
        if summary['critical_keyword_count'] > 0:
            report.append("## ⚠️ Critical Keywords")
            report.append(f"Found {summary['critical_keyword_count']} critical keyword occurrences.")
            report.append("")

        # Recent negative reviews
        asin_reviews = [r for r in self.reviews.values() if r.asin == asin]
        negative = [r for r in asin_reviews if r.sentiment == Sentiment.NEGATIVE]
        negative.sort(key=lambda r: r.review_date, reverse=True)

        if negative:
            report.append("## Recent Negative Reviews")
            for r in negative[:5]:
                report.append(f"\n### {r.rating}★ - {r.title[:50]}")
                report.append(f"*{r.review_date.strftime('%Y-%m-%d')}*")
                report.append(f"> {r.body[:200]}...")
                if r.topics:
                    topics = ", ".join(t.category for t in r.topics)
                    report.append(f"Topics: {topics}")

        return "\n".join(report)

    def load_reviews_from_db(self, asin: Optional[str] = None,
                              lookback_days: int = 30) -> List[Review]:
        """Load reviews from database."""
        con = self._get_db_connection()

        query = """
            SELECT * FROM dim_reviews
            WHERE collected_at >= CURRENT_DATE - ?
        """
        params = [lookback_days]

        if asin:
            query += " AND asin = ?"
            params.append(asin)

        try:
            import json
            df = con.execute(query, params).df()

            reviews = []
            for _, row in df.iterrows():
                review = Review(
                    review_id=row['review_id'],
                    asin=row['asin'],
                    title=row['title'],
                    body=row['body'],
                    rating=row['rating'],
                    author=row['author'],
                    verified_purchase=row['verified_purchase'],
                    review_date=row['review_date'],
                    helpful_votes=row.get('helpful_votes', 0),
                    sentiment=Sentiment(row['sentiment']),
                    sentiment_score=row['sentiment_score'],
                    source=row.get('source', 'db')
                )
                # Load topics from JSON
                if row.get('topics'):
                    topics_data = json.loads(row['topics']) if isinstance(row['topics'], str) else row['topics']
                    review.topics = [
                        ReviewTopic(
                            category=t['category'],
                            keywords_matched=t.get('keywords', []),
                            sentiment=Sentiment.NEUTRAL,
                            importance='medium'
                        )
                        for t in topics_data
                    ]

                self.reviews[review.review_id] = review
                reviews.append(review)

            logger.info(f"Loaded {len(reviews)} reviews from database")
            return reviews
        except Exception as e:
            logger.error(f"Failed to load reviews: {e}")
            return []


def main():
    """CLI entry point for review monitor."""
    import argparse

    parser = argparse.ArgumentParser(description='Amazon Review Monitor')
    parser.add_argument('--asin', type=str, help='ASIN to analyze')
    parser.add_argument('--report', action='store_true', help='Generate report')
    parser.add_argument('--add-sample', action='store_true', help='Add sample reviews')

    args = parser.parse_args()

    monitor = ReviewMonitor()

    if args.add_sample:
        # Add sample reviews for testing
        sample_reviews = [
            Review(
                review_id="R001",
                asin="B0C5Q9Y6YF",
                title="Love this rug!",
                body="Perfect size and great quality. The non-slip backing works well. Easy to clean.",
                rating=5,
                author="Happy Customer",
                verified_purchase=True,
                review_date=datetime.now() - timedelta(days=1)
            ),
            Review(
                review_id="R002",
                asin="B0C5Q9Y6YF",
                title="Disappointed with quality",
                body="The rug is falling apart after 2 weeks. Waste of money. Don't buy this.",
                rating=1,
                author="Unhappy Customer",
                verified_purchase=True,
                review_date=datetime.now() - timedelta(hours=12)
            ),
            Review(
                review_id="R003",
                asin="B0C5Q9Y6YF",
                title="It's okay",
                body="Decent rug for the price. Size was a bit smaller than expected.",
                rating=3,
                author="Neutral Customer",
                verified_purchase=True,
                review_date=datetime.now() - timedelta(hours=6)
            )
        ]

        for review in sample_reviews:
            monitor.add_review(review)

        print(f"Added {len(sample_reviews)} sample reviews")

    asin = args.asin or "B0C5Q9Y6YF"

    if args.report:
        report = monitor.generate_report(asin)
        print(report)

        # Save report
        report_path = os.path.join(
            BASE_DIR, "reports", "markdown",
            f"review_report_{asin}_{datetime.now().strftime('%Y%m%d')}.md"
        )
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, 'w') as f:
            f.write(report)
        print(f"\nReport saved to: {report_path}")

    # Check alerts
    alerts = monitor.check_alerts(asin)
    if alerts:
        print(f"\n=== {len(alerts)} Alerts Triggered ===")
        for alert in alerts:
            print(f"[{alert.priority.value.upper()}] {alert.title}")
            print(f"  {alert.description}")


if __name__ == '__main__':
    main()
