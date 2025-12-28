"""
SellerSprite MCP Server
=======================

MCP Server for Amazon Growth OS analytics powered by SellerSprite data.

This server provides high-level business intelligence tools for:
- Listing diagnostics
- Keyword opportunity discovery
- Market analysis
- Competitive intelligence

The server uses DuckDB as its data source, querying pre-imported
SellerSprite data (Reverse ASIN, keyword metrics, etc.).

Tools Exposed:
- diagnose_listing: Diagnose a listing's market position
- find_opportunities: Find keyword opportunities by strategy
- get_keyword_metrics: Get detailed metrics for a keyword
- analyze_market: Analyze market size and competition

Data Contract:
- Required Table: fact_keyword_snapshot
- See: docs/domain/amazon/SellerSprite_DATA_CONTRACT.md

See: docs/architecture/MCP_SPEC.md §6
"""

import logging
from typing import Any, Dict, List, Optional

from ...base_server import BaseMCPServer, ToolNotFoundError, ToolExecutionError
from ...types import MCPTool, MCPResource, MCPServerConfig, ToolRisk

logger = logging.getLogger(__name__)


# ============================================
# Data Readiness States
# ============================================

class DataStatus:
    """Data readiness status constants."""
    READY = "READY"
    NOT_READY = "DATA_NOT_READY"
    ERROR = "ERROR"


class SellersSpriteMCPServer(BaseMCPServer):
    """
    MCP Server for SellerSprite Amazon analytics.

    Provides business intelligence tools for Amazon sellers using
    SellerSprite data stored in DuckDB.

    Configuration:
        database: Path to DuckDB database
        keyword_table: Table name for keyword data (default: fact_keyword_snapshot)
        asin_table: Table name for ASIN data (default: dim_asin)

    Usage:
        server = SellersSpriteMCPServer(config)
        await server.initialize()
        result = await server.handle_tool("diagnose_listing", {"asin": "B08..."})
    """

    def __init__(self, config: MCPServerConfig):
        super().__init__(config)

        # Configuration
        self._database = config.config.get("database", "data/warehouse.duckdb")
        self._keyword_table = config.config.get("keyword_table", "fact_keyword_snapshot")
        self._asin_table = config.config.get("asin_table", "dim_asin")

        # DuckDB connection
        self._conn = None

        # Data readiness state
        self._data_status = DataStatus.NOT_READY
        self._data_message = "Not initialized"

    @property
    def server_name(self) -> str:
        return "sellersprite"

    @property
    def data_status(self) -> str:
        """Current data readiness status."""
        return self._data_status

    @property
    def is_data_ready(self) -> bool:
        """Check if data is ready for queries."""
        return self._data_status == DataStatus.READY

    def _check_data_readiness(self) -> None:
        """
        Check if required tables exist and update status.

        Per SellerSprite_DATA_CONTRACT.md:
        - Table absence = DATA_NOT_READY (not an error)
        """
        if not self._conn:
            self._data_status = DataStatus.NOT_READY
            self._data_message = "Database not connected"
            return

        try:
            tables = self._conn.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'main'
            """).fetchall()
            table_names = [t[0] for t in tables]

            if self._keyword_table in table_names:
                self._data_status = DataStatus.READY
                self._data_message = f"Table '{self._keyword_table}' available"
                logger.info(f"SellerSprite data ready: {self._keyword_table}")
            else:
                self._data_status = DataStatus.NOT_READY
                self._data_message = f"SellerSprite data not imported yet. Required table: {self._keyword_table}"
                logger.info(f"SellerSprite data not ready: {self._keyword_table} not found")

        except Exception as e:
            self._data_status = DataStatus.ERROR
            self._data_message = f"Failed to check data: {e}"
            logger.error(f"Data readiness check failed: {e}")

    def _data_not_ready_response(self) -> Dict[str, Any]:
        """
        Return standard DATA_NOT_READY response.

        Per MCP_CONTRACT.md §4.2:
        - No exception thrown
        - Clear status and message
        - Suggested next action
        """
        return {
            "status": DataStatus.NOT_READY,
            "message": self._data_message,
            "next_action": "Run SellerSprite data import pipeline",
            "required_table": self._keyword_table,
            "data": None
        }

    async def initialize(self) -> None:
        """Initialize database connection and check data readiness."""
        await super().initialize()

        try:
            import duckdb

            self._conn = duckdb.connect(self._database, read_only=True)
            logger.info(f"Connected to SellerSprite database: {self._database}")

            # Check data readiness (does not throw on missing table)
            self._check_data_readiness()

        except ImportError:
            raise ToolExecutionError(
                "DuckDB not installed. Install with: pip install duckdb",
                tool_name="initialize"
            )
        except Exception as e:
            raise ToolExecutionError(
                f"Failed to connect to database: {e}",
                tool_name="initialize"
            )

    async def shutdown(self) -> None:
        """Close database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None
        await super().shutdown()

    def list_tools(self) -> List[MCPTool]:
        """Return list of available tools."""
        return [
            MCPTool(
                name="diagnose_listing",
                description="""Diagnose a listing's market position.

Analyzes keywords, traffic potential, competition level, and risks.

Returns:
- Market scope (total keywords)
- Traffic pool (total searches)
- Average PPC cost
- Market monopoly level
- High-risk keywords (monopoly > 50%)""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "asin": {
                            "type": "string",
                            "description": "Amazon ASIN to diagnose (optional - analyzes general market if not provided)"
                        }
                    },
                    "required": []
                },
                risk_level=ToolRisk.READ_ONLY
            ),
            MCPTool(
                name="find_opportunities",
                description="""Find keyword opportunities based on strategy.

Strategies:
- blue_ocean: Low monopoly (<30%), high volume keywords
- golden_conversion: High purchase rate (>10%) keywords
- low_bid: Low PPC cost (<$1) with decent volume

Returns top 10 opportunities matching the strategy.""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "strategy": {
                            "type": "string",
                            "enum": ["blue_ocean", "golden_conversion", "low_bid"],
                            "description": "Opportunity finding strategy"
                        }
                    },
                    "required": ["strategy"]
                },
                risk_level=ToolRisk.READ_ONLY
            ),
            MCPTool(
                name="get_keyword_metrics",
                description="""Get detailed metrics for a specific keyword.

Returns:
- Search volume
- Purchase rate
- SPR (Sales Page Rank)
- Monopoly (click share)
- PPC bid estimate
- Product supply count""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "keyword": {
                            "type": "string",
                            "description": "Keyword to analyze"
                        }
                    },
                    "required": ["keyword"]
                },
                risk_level=ToolRisk.READ_ONLY
            ),
            MCPTool(
                name="analyze_market",
                description="""Analyze overall market metrics.

Returns aggregated statistics:
- Total keywords in database
- Total search volume
- Average metrics (PPC, monopoly, conversion)
- Volume distribution breakdown""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "min_volume": {
                            "type": "integer",
                            "description": "Minimum search volume filter (default: 0)",
                            "default": 0
                        }
                    },
                    "required": []
                },
                risk_level=ToolRisk.READ_ONLY
            ),
            MCPTool(
                name="top_keywords",
                description="""Get top keywords by various metrics.

Sort options:
- volume: Highest search volume
- conversion: Highest purchase rate
- opportunity: Best opportunity score (volume / monopoly)

Returns top N keywords with full metrics.""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "sort_by": {
                            "type": "string",
                            "enum": ["volume", "conversion", "opportunity"],
                            "description": "Metric to sort by",
                            "default": "volume"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Number of keywords to return (default: 10)",
                            "default": 10
                        }
                    },
                    "required": []
                },
                risk_level=ToolRisk.READ_ONLY
            ),
        ]

    async def handle_tool(
        self,
        name: str,
        arguments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a tool call.

        Per MCP_CONTRACT.md and SellerSprite_DATA_CONTRACT.md:
        - Returns DATA_NOT_READY status if table is missing
        - Does NOT throw exception for missing data
        """
        if not self._conn:
            raise ToolExecutionError(
                "Database not connected. Call initialize() first.",
                tool_name=name
            )

        # Check data readiness before any tool execution
        # SellerSprite MCP availability depends on data readiness, not system stability.
        if not self.is_data_ready:
            logger.info(f"Tool '{name}' called but data not ready")
            return self._data_not_ready_response()

        if name == "diagnose_listing":
            return await self._diagnose_listing(
                asin=arguments.get("asin")
            )
        elif name == "find_opportunities":
            return await self._find_opportunities(
                strategy=arguments["strategy"]
            )
        elif name == "get_keyword_metrics":
            return await self._get_keyword_metrics(
                keyword=arguments["keyword"]
            )
        elif name == "analyze_market":
            return await self._analyze_market(
                min_volume=arguments.get("min_volume", 0)
            )
        elif name == "top_keywords":
            return await self._top_keywords(
                sort_by=arguments.get("sort_by", "volume"),
                limit=arguments.get("limit", 10)
            )
        else:
            raise ToolNotFoundError(f"Unknown tool: {name}")

    async def _diagnose_listing(self, asin: Optional[str] = None) -> Dict[str, Any]:
        """Diagnose listing market position."""
        try:
            # Get aggregated metrics (using TRY_CAST for VARCHAR columns)
            summary = self._conn.execute(f"""
                SELECT
                    COUNT(*) as total_keywords,
                    COALESCE(SUM(TRY_CAST(search_volume AS BIGINT)), 0) as total_market_volume,
                    COALESCE(AVG(TRY_CAST(ppc_bid AS DOUBLE)), 0) as avg_ppc_bid,
                    COALESCE(AVG(TRY_CAST(click_share AS DOUBLE)), 0) as avg_monopoly,
                    COALESCE(SUM(TRY_CAST(search_volume AS BIGINT) * TRY_CAST(conversion_rate AS DOUBLE)), 0) as est_sales_potential
                FROM {self._keyword_table}
                WHERE TRY_CAST(search_volume AS BIGINT) > 0
            """).fetchone()

            # Get high-risk keywords (using TRY_CAST for comparisons)
            risks = self._conn.execute(f"""
                SELECT keyword, TRY_CAST(click_share AS DOUBLE) as click_share, TRY_CAST(search_volume AS BIGINT) as search_volume
                FROM {self._keyword_table}
                WHERE TRY_CAST(click_share AS DOUBLE) > 0.50
                ORDER BY TRY_CAST(search_volume AS BIGINT) DESC NULLS LAST
                LIMIT 5
            """).fetchall()

            # Get top keywords for context
            top_keywords = self._conn.execute(f"""
                SELECT keyword, TRY_CAST(search_volume AS BIGINT) as search_volume
                FROM {self._keyword_table}
                ORDER BY TRY_CAST(search_volume AS BIGINT) DESC NULLS LAST
                LIMIT 5
            """).fetchall()

            risk_keywords = [
                {
                    "keyword": r[0],
                    "monopoly": round(r[1] * 100, 1) if r[1] else 0,
                    "volume": r[2]
                }
                for r in risks
            ]

            return {
                "asin": asin or "Market Overview",
                "diagnosis": {
                    "total_keywords": summary[0],
                    "total_market_volume": int(summary[1]) if summary[1] else 0,
                    "avg_ppc_bid": round(float(summary[2]), 2) if summary[2] else 0,
                    "avg_monopoly_percent": round(float(summary[3]) * 100, 1) if summary[3] else 0,
                    "estimated_sales_potential": int(summary[4]) if summary[4] else 0
                },
                "top_keywords": [
                    {"keyword": k[0], "volume": k[1]} for k in top_keywords
                ],
                "high_risk_keywords": risk_keywords,
                "risk_count": len(risk_keywords)
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Diagnosis failed: {str(e)}",
                tool_name="diagnose_listing"
            )

    async def _find_opportunities(self, strategy: str) -> Dict[str, Any]:
        """Find keyword opportunities by strategy."""
        try:
            if strategy == "blue_ocean":
                query = f"""
                    SELECT keyword,
                           TRY_CAST(search_volume AS BIGINT) as search_volume,
                           TRY_CAST(click_share AS DOUBLE) as click_share,
                           TRY_CAST(ppc_bid AS DOUBLE) as ppc_bid
                    FROM {self._keyword_table}
                    WHERE TRY_CAST(click_share AS DOUBLE) < 0.30
                      AND TRY_CAST(search_volume AS BIGINT) > 5000
                    ORDER BY TRY_CAST(click_share AS DOUBLE) ASC NULLS LAST
                    LIMIT 10
                """
                title = "Blue Ocean Opportunities (Low Monopoly)"

            elif strategy == "golden_conversion":
                query = f"""
                    SELECT keyword,
                           TRY_CAST(search_volume AS BIGINT) as search_volume,
                           TRY_CAST(conversion_rate AS DOUBLE) as conversion_rate,
                           TRY_CAST(ppc_bid AS DOUBLE) as ppc_bid
                    FROM {self._keyword_table}
                    WHERE TRY_CAST(conversion_rate AS DOUBLE) > 0.10
                    ORDER BY TRY_CAST(conversion_rate AS DOUBLE) DESC NULLS LAST
                    LIMIT 10
                """
                title = "Golden Conversion Keywords (Rate > 10%)"

            elif strategy == "low_bid":
                query = f"""
                    SELECT keyword,
                           TRY_CAST(search_volume AS BIGINT) as search_volume,
                           TRY_CAST(ppc_bid AS DOUBLE) as ppc_bid,
                           TRY_CAST(click_share AS DOUBLE) as click_share
                    FROM {self._keyword_table}
                    WHERE TRY_CAST(ppc_bid AS DOUBLE) < 1.00
                      AND TRY_CAST(search_volume AS BIGINT) > 3000
                    ORDER BY TRY_CAST(search_volume AS BIGINT) DESC NULLS LAST
                    LIMIT 10
                """
                title = "Low Cost Gems (PPC < $1)"

            else:
                return {"error": f"Unknown strategy: {strategy}"}

            result = self._conn.execute(query)
            columns = [desc[0] for desc in result.description]
            rows = result.fetchall()

            opportunities = []
            for row in rows:
                opp = dict(zip(columns, row))
                # Format percentages (values are already cast to proper types)
                if 'click_share' in opp and opp['click_share']:
                    try:
                        opp['monopoly_percent'] = round(float(opp['click_share']) * 100, 1)
                    except (TypeError, ValueError):
                        opp['monopoly_percent'] = 0
                if 'conversion_rate' in opp and opp['conversion_rate']:
                    try:
                        opp['conversion_percent'] = round(float(opp['conversion_rate']) * 100, 2)
                    except (TypeError, ValueError):
                        opp['conversion_percent'] = 0
                opportunities.append(opp)

            return {
                "strategy": strategy,
                "title": title,
                "count": len(opportunities),
                "opportunities": opportunities
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Opportunity search failed: {str(e)}",
                tool_name="find_opportunities",
                details={"strategy": strategy}
            )

    async def _get_keyword_metrics(self, keyword: str) -> Dict[str, Any]:
        """Get metrics for a specific keyword."""
        try:
            # Sanitize input
            keyword_safe = keyword.replace("'", "''")

            result = self._conn.execute(f"""
                SELECT *
                FROM {self._keyword_table}
                WHERE keyword = '{keyword_safe}'
            """).fetchone()

            if not result:
                return {
                    "keyword": keyword,
                    "error": "Keyword not found",
                    "metrics": None
                }

            # Get column names
            columns = self._conn.execute(f"""
                SELECT * FROM {self._keyword_table} LIMIT 0
            """).description
            col_names = [c[0] for c in columns]

            # Build metrics dict
            metrics = dict(zip(col_names, result))

            # Format for readability (handle potential string values)
            def safe_float(val, default=0):
                try:
                    return float(val) if val else default
                except (TypeError, ValueError):
                    return default

            formatted = {
                "keyword": keyword,
                "metrics": {
                    "search_volume": metrics.get("search_volume"),
                    "conversion_rate_percent": round(safe_float(metrics.get("conversion_rate")) * 100, 2),
                    "spr": metrics.get("spr"),
                    "monopoly_percent": round(safe_float(metrics.get("click_share")) * 100, 1),
                    "ppc_bid": round(safe_float(metrics.get("ppc_bid")), 2),
                    "product_count": metrics.get("product_count"),
                    "purchase_count": metrics.get("purchase_count")
                },
                "raw_metrics": metrics
            }

            return formatted

        except Exception as e:
            raise ToolExecutionError(
                f"Metrics retrieval failed: {str(e)}",
                tool_name="get_keyword_metrics",
                details={"keyword": keyword}
            )

    async def _analyze_market(self, min_volume: int = 0) -> Dict[str, Any]:
        """Analyze overall market metrics."""
        try:
            # Overall stats (use TRY_CAST for columns that might be VARCHAR)
            # Note: click_share may not exist in Reverse ASIN exports, use click_share as fallback
            stats = self._conn.execute(f"""
                SELECT
                    COUNT(*) as total_keywords,
                    SUM(TRY_CAST(search_volume AS DOUBLE)) as total_volume,
                    AVG(TRY_CAST(search_volume AS DOUBLE)) as avg_volume,
                    AVG(TRY_CAST(ppc_bid AS DOUBLE)) as avg_ppc,
                    AVG(TRY_CAST(click_share AS DOUBLE)) as avg_monopoly,
                    AVG(TRY_CAST(conversion_rate AS DOUBLE)) as avg_conversion
                FROM {self._keyword_table}
                WHERE TRY_CAST(search_volume AS DOUBLE) >= {min_volume}
            """).fetchone()

            # Volume distribution
            distribution = self._conn.execute(f"""
                SELECT
                    CASE
                        WHEN TRY_CAST(search_volume AS DOUBLE) >= 100000 THEN 'mega (100k+)'
                        WHEN TRY_CAST(search_volume AS DOUBLE) >= 50000 THEN 'high (50k-100k)'
                        WHEN TRY_CAST(search_volume AS DOUBLE) >= 10000 THEN 'medium (10k-50k)'
                        WHEN TRY_CAST(search_volume AS DOUBLE) >= 1000 THEN 'low (1k-10k)'
                        ELSE 'tail (<1k)'
                    END as tier,
                    COUNT(*) as count
                FROM {self._keyword_table}
                WHERE TRY_CAST(search_volume AS DOUBLE) >= {min_volume}
                GROUP BY tier
                ORDER BY count DESC
            """).fetchall()

            return {
                "filter": {"min_volume": min_volume},
                "summary": {
                    "total_keywords": stats[0],
                    "total_search_volume": int(stats[1]) if stats[1] else 0,
                    "avg_search_volume": round(float(stats[2]), 0) if stats[2] else 0,
                    "avg_ppc_bid": round(float(stats[3]), 2) if stats[3] else 0,
                    "avg_monopoly_percent": round(float(stats[4]) * 100, 1) if stats[4] else 0,
                    "avg_conversion_percent": round(float(stats[5]) * 100, 2) if stats[5] else 0
                },
                "volume_distribution": [
                    {"tier": d[0], "count": d[1]} for d in distribution
                ]
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Market analysis failed: {str(e)}",
                tool_name="analyze_market"
            )

    async def _top_keywords(
        self,
        sort_by: str = "volume",
        limit: int = 10
    ) -> Dict[str, Any]:
        """Get top keywords by metric."""
        try:
            limit = min(limit, 100)  # Cap at 100

            if sort_by == "volume":
                order = "TRY_CAST(search_volume AS BIGINT) DESC NULLS LAST"
            elif sort_by == "conversion":
                order = "TRY_CAST(conversion_rate AS DOUBLE) DESC NULLS LAST"
            elif sort_by == "opportunity":
                # Opportunity score = volume / monopoly (higher is better)
                order = "(TRY_CAST(search_volume AS BIGINT) / NULLIF(TRY_CAST(click_share AS DOUBLE), 0)) DESC NULLS LAST"
            else:
                order = "TRY_CAST(search_volume AS BIGINT) DESC NULLS LAST"

            result = self._conn.execute(f"""
                SELECT
                    keyword,
                    TRY_CAST(search_volume AS BIGINT) as search_volume,
                    TRY_CAST(conversion_rate AS DOUBLE) as conversion_rate,
                    TRY_CAST(click_share AS DOUBLE) as click_share,
                    TRY_CAST(ppc_bid AS DOUBLE) as ppc_bid
                FROM {self._keyword_table}
                WHERE TRY_CAST(search_volume AS BIGINT) > 0
                ORDER BY {order}
                LIMIT {limit}
            """).fetchall()

            def safe_float(val, default=0):
                try:
                    return float(val) if val else default
                except (TypeError, ValueError):
                    return default

            keywords = []
            for row in result:
                keywords.append({
                    "keyword": row[0],
                    "volume": int(row[1]) if row[1] else 0,
                    "conversion_percent": round(safe_float(row[2]) * 100, 2),
                    "monopoly_percent": round(safe_float(row[3]) * 100, 1),
                    "ppc_bid": round(safe_float(row[4]), 2)
                })

            return {
                "sort_by": sort_by,
                "count": len(keywords),
                "keywords": keywords
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Top keywords failed: {str(e)}",
                tool_name="top_keywords",
                details={"sort_by": sort_by}
            )
