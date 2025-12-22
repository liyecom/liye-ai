"""
Price Tracker - Competitor Price Monitoring.

Tracks competitor prices, maintains price history,
and provides trend analysis.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import yaml
import statistics


class StockStatus(Enum):
    """Stock availability status."""
    IN_STOCK = "in_stock"
    LOW_STOCK = "low_stock"
    OUT_OF_STOCK = "out_of_stock"
    UNKNOWN = "unknown"


@dataclass
class PricePoint:
    """A single price observation."""
    timestamp: datetime
    current_price: float
    list_price: Optional[float] = None
    sale_price: Optional[float] = None
    coupon_discount: float = 0.0
    subscribe_save_discount: float = 0.0
    stock_status: StockStatus = StockStatus.UNKNOWN
    buy_box_owner: Optional[str] = None  # ASIN of buy box winner
    is_deal: bool = False
    deal_type: Optional[str] = None  # Lightning, DOTD, etc.

    @property
    def effective_price(self) -> float:
        """Calculate effective price after discounts."""
        base = self.sale_price if self.sale_price else self.current_price
        return base - self.coupon_discount

    @property
    def discount_percent(self) -> float:
        """Calculate discount percentage from list price."""
        if self.list_price and self.list_price > 0:
            return (1 - self.effective_price / self.list_price) * 100
        return 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'timestamp': self.timestamp.isoformat(),
            'current_price': self.current_price,
            'list_price': self.list_price,
            'sale_price': self.sale_price,
            'coupon_discount': self.coupon_discount,
            'effective_price': self.effective_price,
            'discount_percent': self.discount_percent,
            'stock_status': self.stock_status.value,
            'is_deal': self.is_deal,
            'deal_type': self.deal_type
        }


@dataclass
class PriceHistory:
    """Price history for a product."""
    asin: str
    prices: List[PricePoint] = field(default_factory=list)

    @property
    def current_price(self) -> Optional[float]:
        """Get most recent price."""
        if self.prices:
            return self.prices[-1].effective_price
        return None

    @property
    def min_price(self) -> Optional[float]:
        """Get minimum historical price."""
        if self.prices:
            return min(p.effective_price for p in self.prices)
        return None

    @property
    def max_price(self) -> Optional[float]:
        """Get maximum historical price."""
        if self.prices:
            return max(p.effective_price for p in self.prices)
        return None

    @property
    def avg_price(self) -> Optional[float]:
        """Get average historical price."""
        if self.prices:
            return statistics.mean(p.effective_price for p in self.prices)
        return None

    @property
    def price_volatility(self) -> Optional[float]:
        """Calculate price volatility (std dev / mean)."""
        if len(self.prices) >= 2:
            prices = [p.effective_price for p in self.prices]
            mean = statistics.mean(prices)
            if mean > 0:
                return statistics.stdev(prices) / mean
        return None

    def get_price_change(self, days: int = 1) -> Optional[Tuple[float, float]]:
        """
        Get price change over specified days.

        Returns:
            Tuple of (absolute_change, percent_change) or None
        """
        if len(self.prices) < 2:
            return None

        cutoff = datetime.now() - timedelta(days=days)
        old_prices = [p for p in self.prices if p.timestamp <= cutoff]

        if not old_prices:
            return None

        old_price = old_prices[-1].effective_price
        new_price = self.prices[-1].effective_price

        absolute = new_price - old_price
        percent = (absolute / old_price) * 100 if old_price > 0 else 0

        return (absolute, percent)

    def get_trend(self, days: int = 30) -> str:
        """
        Determine price trend over period.

        Returns:
            'increasing', 'decreasing', 'stable', or 'volatile'
        """
        cutoff = datetime.now() - timedelta(days=days)
        recent_prices = [p for p in self.prices if p.timestamp >= cutoff]

        if len(recent_prices) < 3:
            return "insufficient_data"

        prices = [p.effective_price for p in recent_prices]

        # Calculate trend using linear regression approximation
        n = len(prices)
        x_mean = (n - 1) / 2
        y_mean = statistics.mean(prices)

        numerator = sum((i - x_mean) * (prices[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))

        if denominator == 0:
            return "stable"

        slope = numerator / denominator
        slope_percent = (slope / y_mean) * 100 if y_mean > 0 else 0

        # Check volatility
        volatility = self.price_volatility or 0

        if volatility > 0.15:  # >15% volatility
            return "volatile"
        elif slope_percent > 2:
            return "increasing"
        elif slope_percent < -2:
            return "decreasing"
        else:
            return "stable"


@dataclass
class Competitor:
    """A competitor product."""
    asin: str
    title: str
    brand: Optional[str] = None
    category: Optional[str] = None
    bsr: Optional[int] = None  # Best Seller Rank
    rating: float = 0.0
    review_count: int = 0
    price_history: PriceHistory = None
    is_fba: bool = True
    seller_count: int = 1
    priority_score: float = 0.0  # Calculated importance
    tracked_since: datetime = field(default_factory=datetime.now)
    last_updated: datetime = field(default_factory=datetime.now)
    notes: str = ""

    def __post_init__(self):
        if self.price_history is None:
            self.price_history = PriceHistory(asin=self.asin)

    @property
    def current_price(self) -> Optional[float]:
        """Get current price."""
        return self.price_history.current_price

    @property
    def stock_status(self) -> StockStatus:
        """Get current stock status."""
        if self.price_history.prices:
            return self.price_history.prices[-1].stock_status
        return StockStatus.UNKNOWN

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'asin': self.asin,
            'title': self.title,
            'brand': self.brand,
            'category': self.category,
            'bsr': self.bsr,
            'rating': self.rating,
            'review_count': self.review_count,
            'current_price': self.current_price,
            'stock_status': self.stock_status.value,
            'is_fba': self.is_fba,
            'priority_score': self.priority_score,
            'price_trend': self.price_history.get_trend() if self.price_history else None,
            'min_price': self.price_history.min_price if self.price_history else None,
            'max_price': self.price_history.max_price if self.price_history else None,
            'avg_price': self.price_history.avg_price if self.price_history else None,
            'last_updated': self.last_updated.isoformat()
        }


class PriceTracker:
    """
    Track competitor prices and maintain price history.

    Features:
    - Add and manage competitor products
    - Record price observations
    - Calculate price trends and statistics
    - Identify significant price changes
    - Export price history data
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        db_path: Optional[str] = None
    ):
        """Initialize price tracker."""
        self.config = self._load_config(config_path)
        self.db_path = db_path
        self._db_conn = None

        # In-memory storage
        self.competitors: Dict[str, Competitor] = {}
        self.our_products: Dict[str, PriceHistory] = {}  # Our own products

        if self.db_path:
            self._init_database()

    def _load_config(self, config_path: Optional[str]) -> Dict:
        """Load configuration."""
        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        return {}

    def _get_db_connection(self):
        """Get DuckDB connection."""
        if self._db_conn is None and self.db_path:
            try:
                import duckdb
                self._db_conn = duckdb.connect(self.db_path)
            except ImportError:
                pass
        return self._db_conn

    def _init_database(self):
        """Initialize database tables."""
        conn = self._get_db_connection()
        if conn is None:
            return

        conn.execute("""
            CREATE TABLE IF NOT EXISTS dim_competitors (
                asin VARCHAR PRIMARY KEY,
                title VARCHAR,
                brand VARCHAR,
                category VARCHAR,
                is_fba BOOLEAN,
                tracked_since TIMESTAMP,
                notes TEXT
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS fact_competitor_prices (
                id INTEGER PRIMARY KEY,
                asin VARCHAR NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                current_price DECIMAL(10,2),
                list_price DECIMAL(10,2),
                sale_price DECIMAL(10,2),
                coupon_discount DECIMAL(10,2),
                effective_price DECIMAL(10,2),
                stock_status VARCHAR,
                bsr INTEGER,
                rating DECIMAL(3,2),
                review_count INTEGER,
                is_deal BOOLEAN,
                deal_type VARCHAR,
                UNIQUE(asin, timestamp)
            )
        """)

    def _save_competitor(self, competitor: Competitor):
        """Save competitor to database."""
        conn = self._get_db_connection()
        if conn is None:
            return

        conn.execute("""
            INSERT OR REPLACE INTO dim_competitors
            (asin, title, brand, category, is_fba, tracked_since, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            competitor.asin,
            competitor.title,
            competitor.brand,
            competitor.category,
            competitor.is_fba,
            competitor.tracked_since,
            competitor.notes
        ])

    def _save_price_point(self, asin: str, price: PricePoint, competitor: Competitor):
        """Save price point to database."""
        conn = self._get_db_connection()
        if conn is None:
            return

        conn.execute("""
            INSERT OR REPLACE INTO fact_competitor_prices
            (asin, timestamp, current_price, list_price, sale_price,
             coupon_discount, effective_price, stock_status, bsr,
             rating, review_count, is_deal, deal_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            asin,
            price.timestamp,
            price.current_price,
            price.list_price,
            price.sale_price,
            price.coupon_discount,
            price.effective_price,
            price.stock_status.value,
            competitor.bsr,
            competitor.rating,
            competitor.review_count,
            price.is_deal,
            price.deal_type
        ])

    def add_competitor(
        self,
        asin: str,
        title: str,
        brand: Optional[str] = None,
        category: Optional[str] = None,
        initial_price: Optional[float] = None,
        bsr: Optional[int] = None,
        rating: float = 0.0,
        review_count: int = 0,
        is_fba: bool = True,
        notes: str = ""
    ) -> Competitor:
        """Add a new competitor to track."""
        competitor = Competitor(
            asin=asin,
            title=title,
            brand=brand,
            category=category,
            bsr=bsr,
            rating=rating,
            review_count=review_count,
            is_fba=is_fba,
            notes=notes
        )

        # Calculate priority score
        competitor.priority_score = self._calculate_priority(competitor)

        # Add initial price if provided
        if initial_price:
            self.record_price(asin, initial_price)

        self.competitors[asin] = competitor
        self._save_competitor(competitor)

        return competitor

    def _calculate_priority(self, competitor: Competitor) -> float:
        """Calculate competitor priority score (0-100)."""
        weights = self.config.get('competitor_detection', {}).get('priority_weights', {
            'bsr_proximity': 0.30,
            'price_proximity': 0.25,
            'review_count': 0.20,
            'rating': 0.15,
            'search_overlap': 0.10
        })

        score = 0.0

        # BSR score (lower BSR = higher score)
        if competitor.bsr:
            bsr_score = max(0, 100 - (competitor.bsr / 1000))  # Top 1000 gets full points
            score += weights.get('bsr_proximity', 0.3) * bsr_score

        # Review count score
        review_score = min(100, competitor.review_count / 100)  # 10k reviews = max
        score += weights.get('review_count', 0.2) * review_score

        # Rating score
        rating_score = (competitor.rating / 5.0) * 100
        score += weights.get('rating', 0.15) * rating_score

        return min(100, score)

    def record_price(
        self,
        asin: str,
        current_price: float,
        list_price: Optional[float] = None,
        sale_price: Optional[float] = None,
        coupon_discount: float = 0.0,
        stock_status: StockStatus = StockStatus.IN_STOCK,
        is_deal: bool = False,
        deal_type: Optional[str] = None,
        bsr: Optional[int] = None,
        rating: Optional[float] = None,
        review_count: Optional[int] = None
    ) -> Optional[PricePoint]:
        """Record a price observation for a competitor."""
        if asin not in self.competitors:
            return None

        competitor = self.competitors[asin]

        # Update competitor metadata if provided
        if bsr is not None:
            competitor.bsr = bsr
        if rating is not None:
            competitor.rating = rating
        if review_count is not None:
            competitor.review_count = review_count

        # Create price point
        price_point = PricePoint(
            timestamp=datetime.now(),
            current_price=current_price,
            list_price=list_price,
            sale_price=sale_price,
            coupon_discount=coupon_discount,
            stock_status=stock_status,
            is_deal=is_deal,
            deal_type=deal_type
        )

        # Add to history
        competitor.price_history.prices.append(price_point)
        competitor.last_updated = datetime.now()

        # Save to database
        self._save_price_point(asin, price_point, competitor)

        return price_point

    def record_our_price(
        self,
        asin: str,
        current_price: float,
        **kwargs
    ):
        """Record price for our own product."""
        if asin not in self.our_products:
            self.our_products[asin] = PriceHistory(asin=asin)

        price_point = PricePoint(
            timestamp=datetime.now(),
            current_price=current_price,
            **kwargs
        )

        self.our_products[asin].prices.append(price_point)

    def get_competitor(self, asin: str) -> Optional[Competitor]:
        """Get competitor by ASIN."""
        return self.competitors.get(asin)

    def list_competitors(
        self,
        sort_by: str = "priority_score",
        limit: Optional[int] = None
    ) -> List[Competitor]:
        """List all competitors, sorted by specified field."""
        competitors = list(self.competitors.values())

        # Sort
        if sort_by == "priority_score":
            competitors.sort(key=lambda x: x.priority_score, reverse=True)
        elif sort_by == "price":
            competitors.sort(key=lambda x: x.current_price or float('inf'))
        elif sort_by == "bsr":
            competitors.sort(key=lambda x: x.bsr or float('inf'))
        elif sort_by == "rating":
            competitors.sort(key=lambda x: x.rating, reverse=True)
        elif sort_by == "review_count":
            competitors.sort(key=lambda x: x.review_count, reverse=True)

        if limit:
            competitors = competitors[:limit]

        return competitors

    def get_price_changes(
        self,
        days: int = 1,
        min_change_percent: float = 5.0
    ) -> List[Tuple[Competitor, float, float]]:
        """
        Get significant price changes in the period.

        Returns:
            List of (competitor, absolute_change, percent_change)
        """
        changes = []

        for competitor in self.competitors.values():
            change = competitor.price_history.get_price_change(days)
            if change:
                absolute, percent = change
                if abs(percent) >= min_change_percent:
                    changes.append((competitor, absolute, percent))

        # Sort by absolute percent change
        changes.sort(key=lambda x: abs(x[2]), reverse=True)

        return changes

    def get_market_summary(self, our_asin: Optional[str] = None) -> Dict[str, Any]:
        """Get market summary statistics."""
        competitors = list(self.competitors.values())

        if not competitors:
            return {"error": "No competitors tracked"}

        prices = [c.current_price for c in competitors if c.current_price]
        bsrs = [c.bsr for c in competitors if c.bsr]
        ratings = [c.rating for c in competitors if c.rating > 0]

        summary = {
            'competitor_count': len(competitors),
            'in_stock_count': sum(1 for c in competitors if c.stock_status == StockStatus.IN_STOCK),
            'out_of_stock_count': sum(1 for c in competitors if c.stock_status == StockStatus.OUT_OF_STOCK),
            'price_stats': {
                'min': min(prices) if prices else None,
                'max': max(prices) if prices else None,
                'avg': statistics.mean(prices) if prices else None,
                'median': statistics.median(prices) if prices else None
            },
            'bsr_stats': {
                'best': min(bsrs) if bsrs else None,
                'worst': max(bsrs) if bsrs else None,
                'avg': statistics.mean(bsrs) if bsrs else None
            },
            'rating_stats': {
                'min': min(ratings) if ratings else None,
                'max': max(ratings) if ratings else None,
                'avg': statistics.mean(ratings) if ratings else None
            },
            'timestamp': datetime.now().isoformat()
        }

        # Add our position if tracking
        if our_asin and our_asin in self.our_products:
            our_price = self.our_products[our_asin].current_price
            if our_price and prices:
                cheaper_count = sum(1 for p in prices if p < our_price)
                summary['our_position'] = {
                    'price': our_price,
                    'cheaper_competitors': cheaper_count,
                    'price_rank': cheaper_count + 1,
                    'vs_avg': ((our_price - summary['price_stats']['avg']) /
                              summary['price_stats']['avg'] * 100) if summary['price_stats']['avg'] else 0
                }

        return summary

    def find_opportunities(self) -> List[Dict[str, Any]]:
        """Find competitive opportunities (OOS competitors, price increases)."""
        opportunities = []

        for competitor in self.competitors.values():
            # Out of stock opportunity
            if competitor.stock_status == StockStatus.OUT_OF_STOCK:
                opportunities.append({
                    'type': 'competitor_oos',
                    'asin': competitor.asin,
                    'title': competitor.title,
                    'priority': 'high',
                    'description': f"{competitor.brand or 'Competitor'} is out of stock - opportunity to capture their customers"
                })

            # Price increase opportunity
            change = competitor.price_history.get_price_change(days=7)
            if change and change[1] > 10:  # >10% increase
                opportunities.append({
                    'type': 'competitor_price_increase',
                    'asin': competitor.asin,
                    'title': competitor.title,
                    'priority': 'medium',
                    'change_percent': change[1],
                    'description': f"{competitor.brand or 'Competitor'} raised price by {change[1]:.1f}%"
                })

        return opportunities

    def generate_report(self, our_asin: Optional[str] = None) -> str:
        """Generate competitor monitoring report."""
        lines = [
            "=" * 60,
            "COMPETITOR PRICE MONITORING REPORT",
            "=" * 60,
            "",
            f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            f"Competitors Tracked: {len(self.competitors)}",
            ""
        ]

        # Market summary
        summary = self.get_market_summary(our_asin)
        lines.extend([
            "## Market Summary",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| In Stock | {summary.get('in_stock_count', 0)} |",
            f"| Out of Stock | {summary.get('out_of_stock_count', 0)} |",
        ])

        if summary.get('price_stats'):
            ps = summary['price_stats']
            lines.extend([
                f"| Min Price | ${ps['min']:.2f} |" if ps['min'] else "| Min Price | N/A |",
                f"| Max Price | ${ps['max']:.2f} |" if ps['max'] else "| Max Price | N/A |",
                f"| Avg Price | ${ps['avg']:.2f} |" if ps['avg'] else "| Avg Price | N/A |",
            ])

        lines.append("")

        # Our position
        if 'our_position' in summary:
            pos = summary['our_position']
            lines.extend([
                "## Our Competitive Position",
                "",
                f"- Our Price: ${pos['price']:.2f}",
                f"- Price Rank: #{pos['price_rank']} of {summary['competitor_count'] + 1}",
                f"- vs Market Avg: {pos['vs_avg']:+.1f}%",
                ""
            ])

        # Price changes
        changes = self.get_price_changes(days=1, min_change_percent=5)
        if changes:
            lines.extend([
                "## Recent Price Changes (24h)",
                "",
                "| Competitor | Old → New | Change |",
                "|------------|-----------|--------|"
            ])
            for comp, absolute, percent in changes[:10]:
                old = comp.current_price - absolute if comp.current_price else 0
                icon = "📉" if percent < 0 else "📈"
                lines.append(
                    f"| {comp.title[:30]}... | ${old:.2f} → ${comp.current_price:.2f} | {icon} {percent:+.1f}% |"
                )
            lines.append("")

        # Opportunities
        opportunities = self.find_opportunities()
        if opportunities:
            lines.extend([
                "## Opportunities Detected",
                ""
            ])
            for opp in opportunities[:5]:
                icon = "🎯" if opp['priority'] == 'high' else "💡"
                lines.append(f"- {icon} **{opp['type']}**: {opp['description']}")
            lines.append("")

        # Competitor table
        lines.extend([
            "## Competitor Details",
            "",
            "| ASIN | Brand | Price | BSR | Rating | Reviews | Trend |",
            "|------|-------|-------|-----|--------|---------|-------|"
        ])

        for comp in self.list_competitors(limit=15):
            trend = comp.price_history.get_trend() if comp.price_history else "N/A"
            trend_icon = {"increasing": "📈", "decreasing": "📉", "stable": "➡️", "volatile": "〰️"}.get(trend, "❓")
            lines.append(
                f"| {comp.asin} | {comp.brand or 'N/A'} | ${comp.current_price:.2f} if comp.current_price else 'N/A' | "
                f"{comp.bsr or 'N/A'} | {comp.rating:.1f}⭐ | {comp.review_count:,} | {trend_icon} |"
            )

        lines.extend(["", "=" * 60])

        return "\n".join(lines)
