
import argparse
from dotenv import load_dotenv
import os
from src.traffic_os.serp_etl import SerpPipeline

# Load environment variables
load_dotenv()

def main():
    parser = argparse.ArgumentParser(description="Traffic OS: Run SERP ETL Pipeline")
    parser.add_argument("--keywords", type=str, help="Comma-separated keywords or path to CSV file")
    parser.add_argument("--mock", action="store_true", help="Run in Mock mode (no API cost)")
    
    args = parser.parse_args()
    
    # 1. Parse Keywords
    keywords = []
    if args.keywords:
        if args.keywords.endswith(".csv") or args.keywords.endswith(".txt"):
            # File mode (placeholder implementation)
            print(f"Reading keywords from file: {args.keywords}")
            # with open(args.keywords) as f: lines = f.readlines()
            # keywords = [l.strip() for l in lines]
            pass
        else:
            # Comma string
            keywords = [k.strip() for k in args.keywords.split(",")]
    else:
        # Default test keywords
        keywords = ["indoor doormat", "small area rug", "front door mat"]

    # 2. Initialize Pipeline
    pipeline = SerpPipeline(mock=args.mock)
    
    # 3. Execute
    pipeline.run(keywords)

if __name__ == "__main__":
    main()
