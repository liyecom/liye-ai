from typing import Dict, List, Optional
import duckdb
import pandas as pd
from crewai.tools import BaseTool
from src.data_lake.db_manager import get_db_connection

class SellersSpriteTool(BaseTool):
    name: str = "SellersSprite Data Tool"
    description: str = (
        "A comprehensive tool for accessing Amazon Growth OS data. "
        "Useful for diagnosing listings, finding keyword opportunities, and analyzing market metrics from SellersSprite data."
    )

    def _run(self, operation: str, **kwargs) -> str:
        """
        Main entry point for the tool.
        Args:
            operation (str): One of 'diagnose_listing', 'find_opportunities', 'get_keyword_metrics'.
            **kwargs: Arguments specific to the operation (e.g. asin, strategy, keyword).
        """
        if operation == "diagnose_listing":
            return self.diagnose_listing(kwargs.get("asin"))
        elif operation == "find_opportunities":
            return self.find_opportunities(kwargs.get("strategy", "blue_ocean"))
        elif operation == "get_keyword_metrics":
            return self.get_keyword_metrics(kwargs.get("keyword"))
        else:
            return f"Error: Unknown operation '{operation}'"

    def diagnose_listing(self, asin: str) -> str:
        """
        Diagnoses a listing by comparing it against market metrics.
        Returns a markdown summary of Traffic, Efficiency, and Risks.
        """
        con = get_db_connection()
        
        # 1. Get ASIN basic info (Title, etc.)
        # Note: In a real scenario we'd query dim_asin, but it might be empty if we haven't loaded attributes.
        # We'll focus on the keywords linked to this ASIN in our snapshot (Reverse ASIN data).
        
        # 2. Aggregated Metrics from Keywords where this ASIN is in Top 10 (if available)
        # Or simply analysis of the keywords provided in the Reverse ASIN file if that IS the ASIN.
        # Assuming the fact_keyword_snapshot contains data relevant to the "Main ASIN" we imported.
        
        query = """
        SELECT 
            COUNT(*) as total_keywords,
            SUM(search_volume) as total_market_volume,
            AVG(ppc_bid) as avg_ppc_bid,
            AVG(aba_top3_click_share) as avg_monopoly,
            SUM(monthly_purchases) as est_total_sales_potential
        FROM fact_keyword_snapshot
        WHERE search_volume > 0
        """
        
        try:
            summary = con.execute(query).df().iloc[0]
            
            # 3. Identify Risks (High Monopoly Keywords)
            risk_query = """
            SELECT keyword, aba_top3_click_share 
            FROM fact_keyword_snapshot 
            WHERE aba_top3_click_share > 0.50 
            ORDER BY search_volume DESC 
            LIMIT 5
            """
            risks = con.execute(risk_query).df()
            
            risk_md = ""
            if not risks.empty:
                risk_md = "\n**⚠️ High Monopoly Risks (Click Share > 50%):**\n"
                for _, row in risks.iterrows():
                    risk_md += f"- `{row['keyword']}`: {row['aba_top3_click_share']*100:.1f}%\n"

            # 4. Get Representative Keywords (Context)
            top_kw_query = """
            SELECT keyword 
            FROM fact_keyword_snapshot 
            ORDER BY search_volume DESC 
            LIMIT 5
            """
            top_kws = con.execute(top_kw_query).df()
            kw_context = ", ".join(top_kws['keyword'].tolist())
            
            report = (
                f"### 🩺 Listing Diagnosis Report for Market Context\n"
                f"**Product Context (Top Keywords)**: {kw_context}\n"
                f"**Market Scope**: {summary['total_keywords']} keywords analyzed.\n"
                f"**Total Traffic Pool**: {summary['total_market_volume']:,} searches/mo.\n"
                f"**Avg PPC Cost**: ${summary['avg_ppc_bid']:.2f}\n"
                f"**Avg Market Monopoly**: {summary['avg_monopoly']*100:.1f}%\n"
                f"{risk_md}"
            )
            return report
            
        except Exception as e:
            return f"Error diagnosing listing: {e}"

    def find_opportunities(self, strategy: str) -> str:
        """
        Finds keyword opportunities based on specific strategies.
        Supported Strategies:
        - 'blue_ocean': Click Share < 30%, High Volume.
        - 'golden_conversion': Purchase Rate > 10%.
        - 'low_bid': PPC < $1.00.
        """
        con = get_db_connection()
        
        if strategy == "blue_ocean":
            query = """
            SELECT keyword, search_volume, aba_top3_click_share 
            FROM fact_keyword_snapshot 
            WHERE aba_top3_click_share < 0.30 AND search_volume > 5000
            ORDER BY aba_top3_click_share ASC 
            LIMIT 10
            """
            title = "🌊 Blue Ocean Opportunities (Low Monopoly)"
            
        elif strategy == "golden_conversion":
            query = """
            SELECT keyword, search_volume, purchase_rate 
            FROM fact_keyword_snapshot 
            WHERE purchase_rate > 0.10 
            ORDER BY purchase_rate DESC 
            LIMIT 10
            """
            title = "✨ Golden Conversion Keywords (Rate > 10%)"
            
        elif strategy == "low_bid":
            query = """
            SELECT keyword, search_volume, ppc_bid 
            FROM fact_keyword_snapshot 
            WHERE ppc_bid < 1.00 AND search_volume > 3000
            ORDER BY search_volume DESC 
            LIMIT 10
            """
            title = "💎 Low Cost Gems (PPC < $1)"
            
        else:
            return "Unknown strategy."
            
        try:
            df = con.execute(query).df()
            if df.empty:
                return f"No opportunities found for strategy: {strategy}"
            
            md = f"### {title}\n"
            md += df.to_markdown(index=False)
            return md
        except Exception as e:
            return f"Error finding opportunities: {e}"

    def get_keyword_metrics(self, keyword: str) -> str:
        """
        Retrieves detailed metrics for a specific keyword.
        """
        con = get_db_connection()
        query = f"""
        SELECT * FROM fact_keyword_snapshot 
        WHERE keyword = '{keyword.replace("'", "''")}'
        """
        try:
            df = con.execute(query).df()
            if df.empty:
                return f"Keyword '{keyword}' not found in database."
            
            # Format as single record view
            row = df.iloc[0]
            md = f"### 📊 Metrics for `{keyword}`\n"
            md += f"- **Search Volume**: {row.get('search_volume', 'N/A')}\n"
            md += f"- **Purchase Rate**: {row.get('purchase_rate', 0)*100:.2f}%\n"
            md += f"- **SPR**: {row.get('spr', 'N/A')}\n"
            md += f"- **Monopoly (Click Share)**: {row.get('aba_top3_click_share', 0)*100:.1f}%\n"
            md += f"- **PPC Bid**: ${row.get('ppc_bid', 0):.2f}\n"
            md += f"- **Supply**: {row.get('product_count', 'N/A')}\n"
            return md
        except Exception as e:
            return f"Error getting metrics: {e}"

class SellersSpriteReverseTool(BaseTool):
    name: str = "SellersSprite Reverse ASIN Tool"
    description: str = "Fetches Reverse ASIN data from SellersSprite API. (Restored Stub)"

    def _run(self, asin: str) -> str:
        return f"Reverse ASIN lookup for {asin} (Stubbed for Optimization Phase)"
