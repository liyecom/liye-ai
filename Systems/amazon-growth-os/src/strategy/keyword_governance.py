
import pandas as pd
import duckdb
import os
import sys

# Lifecycle Definitions
BUCKET_TEST = 'TEST'
BUCKET_GROW = 'GROW'
BUCKET_HARVEST = 'HARVEST'
BUCKET_DEFEND = 'DEFEND'
BUCKET_KILL = 'KILL'

class KeywordBucketer:
    def __init__(self, brand_terms=None):
        self.brand_terms = brand_terms or []

    def classify_row(self, row):
        """
        Apply the SOP Logic to a single row.
        """
        rank = row['organic_rank']
        text = row['keyword_text']
        
        # 0. Safety/Data Check
        if rank is None:
            rank = 0
            
        # 1. DEFEND Check (Brand Terms)
        # Simple string matching for MVP
        for term in self.brand_terms:
            if term.lower() in text.lower():
                return BUCKET_DEFEND
        
        # 2. KILL Check (No exposure > 30 days - or Rank 0 for MVP)
        # "No exposure" usually means rank is 0 or > 50 (invisible)
        # Strict KILL: Rank 0 (Not indexed)
        if rank == 0:
            return BUCKET_KILL
            
        # 3. HARVEST (Rank 1-7)
        if 1 <= rank <= 7:
            return BUCKET_HARVEST
            
        # 4. GROW (Rank 8-20 - The Strike Zone)
        if 8 <= rank <= 20:
            return BUCKET_GROW
            
        # 5. TEST (Rank > 20)
        if rank > 20:
            return BUCKET_TEST
            
        return "UNKNOWN"

    def process_dataframe(self, df):
        """
        Apply classification to a dataframe.
        """
        if df.empty:
            return df
        
        df['bucket'] = df.apply(self.classify_row, axis=1)
        
        # Generate Action Recommendations based on bucket
        df['proposed_action'] = df['bucket'].map({
            BUCKET_TEST: "Launch Auto/Broad/Exact (Low Bid)",
            BUCKET_GROW: "Push SEO + PPC Exact Match (Top of Search)",
            BUCKET_HARVEST: "Optimize Profit, Control ACOS, Prevent Overbidding",
            BUCKET_DEFEND: "SB + SP Exact (High Bid) to Protect Share",
            BUCKET_KILL: "Archive/Negate"
        })
        
        return df

if __name__ == "__main__":
    # Test
    sample = pd.DataFrame({
        'keyword_text': ['brand term', 'good keyword', 'new keyword', 'bad keyword'],
        'organic_rank': [5, 12, 35, 0]
    })
    bucketer = KeywordBucketer(brand_terms=['brand'])
    print(bucketer.process_dataframe(sample))
