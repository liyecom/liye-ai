#!/usr/bin/env python3
"""
T2 → T1 Refinement Pipeline Runner
===================================

Full pipeline:
1. Load T2 raw data
2. Chunk into candidates
3. Generate truth_delta (LLM)
4. Validate with TRUTH_DELTA_GATE
5. Export approved T1 units

Usage:
    python run_refinement.py --sources helium10,reddit_fba --limit 50
    python run_refinement.py --all

# ============================================================================
# T1 CONSUMPTION RULES
# ============================================================================
#
# IMPORTANT: T1 is not an answer source. It is a reasoning substrate.
#
# The T1 units exported by this pipeline are subject to strict consumption rules:
#
# AUTHORIZED CONSUMERS:
#   ✅ Analyst Agent
#   ✅ Strategy Agent
#   ✅ OS-level Reasoning Modules
#
# PROHIBITED USAGE:
#   ❌ Human direct reading as tutorials
#   ❌ Direct content reuse in generation
#   ❌ RAG retrieval returning raw T1 as answers
#
# USAGE SPECIFICATION:
#   - T1 MUST be used as reasoning input
#   - T1 MUST NOT be returned directly as answer output
#   - T1 unit IDs MUST NOT appear in user-facing responses
#
# Reference: docs/architecture/T1_CONSUMPTION_RULES.md
# ============================================================================
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from refinement.pipeline import RefinementPipeline
from refinement.truth_delta_generator import TruthDeltaGenerator
from refinement.truth_delta_gate import TruthDeltaGate


def run_full_pipeline(
    sources: list,
    limit_per_source: int = None,
    skip_generation: bool = False
):
    """
    Run the complete T2 → T1 refinement pipeline.

    Args:
        sources: List of source names
        limit_per_source: Limit candidates per source (for testing)
        skip_generation: If True, skip LLM generation (use existing deltas)
    """
    print("=" * 60)
    print("T2 → T1 REFINEMENT PIPELINE")
    print("=" * 60)
    print(f"Sources: {', '.join(sources)}")
    print(f"Limit per source: {limit_per_source or 'None'}")
    print(f"Skip LLM generation: {skip_generation}")
    print("=" * 60)

    # Initialize pipeline
    pipeline = RefinementPipeline(
        t2_raw_path='~/data/T2_raw',
        output_path='~/data/T1_candidates'
    )

    # Initialize generator
    generator = TruthDeltaGenerator() if not skip_generation else None

    # Track results
    all_passed = []
    all_failed = []

    for source in sources:
        print(f"\n{'=' * 40}")
        print(f"PROCESSING: {source.upper()}")
        print(f"{'=' * 40}")

        # Step 1: Generate candidates from T2
        candidates, _ = pipeline.process_source(source)

        if limit_per_source:
            candidates = candidates[:limit_per_source]
            print(f"[LIMIT] Using first {limit_per_source} candidates")

        # Step 2: Generate truth_delta with LLM
        if generator and candidates:
            print(f"\n[LLM] Generating truth_delta for {len(candidates)} candidates...")

            candidate_dicts = []
            for c in candidates:
                candidate_dicts.append({
                    'id': c.id,
                    'content': c.content,
                    'source': c.source,
                    'source_url': c.source_url,
                    'source_title': c.source_title,
                    'language': c.language,
                    'chunk_index': c.chunk_index,
                    'total_chunks': c.total_chunks,
                    'char_count': c.char_count,
                    'truth_delta': c.truth_delta,
                    'gate_result': c.gate_result
                })

            # Process with LLM
            annotated = generator.process_candidates(candidate_dicts, validate=True)

            # Separate passed and failed
            for item in annotated:
                if item.get('gate_result') == 'PASS':
                    all_passed.append(item)
                else:
                    all_failed.append(item)

        # Export source-specific candidates
        output_path = Path('~/data/T1_candidates').expanduser()
        output_path.mkdir(parents=True, exist_ok=True)

    # Final statistics
    print("\n" + "=" * 60)
    print("FINAL RESULTS")
    print("=" * 60)

    pipeline.print_stats()

    if generator:
        generator.print_stats()

    print(f"\nT1 Units Approved: {len(all_passed)}")
    print(f"Candidates Rejected: {len(all_failed)}")

    # Export approved T1 units
    if all_passed:
        t1_output = Path('~/data/exports/T1_refined').expanduser()
        t1_output.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = t1_output / f't1_units_{timestamp}.json'

        t1_data = {
            'version': '0.1.0',
            'tier': 'T1',
            'generated_at': datetime.now().isoformat(),
            'pipeline': 'T2_REFINEMENT',
            'gate': 'TRUTH_DELTA_GATE',
            'unit_count': len(all_passed),
            # Consumption rules metadata
            'consumption_rules': {
                'reference': 'docs/architecture/T1_CONSUMPTION_RULES.md',
                'canonical_statement': 'T1 is not an answer source. It is a reasoning substrate.',
                'authorized_consumers': [
                    'Analyst Agent',
                    'Strategy Agent',
                    'OS-level Reasoning Modules'
                ],
                'prohibited_usage': [
                    'Human direct reading as tutorials',
                    'Direct content reuse in generation',
                    'RAG retrieval returning raw T1 as answers'
                ]
            },
            'units': all_passed
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(t1_data, f, ensure_ascii=False, indent=2)

        print(f"\n[SUCCESS] T1 units exported to: {output_file}")

        # Create latest symlink
        latest_link = t1_output / 't1_units_latest.json'
        if latest_link.exists():
            latest_link.unlink()
        latest_link.symlink_to(output_file.name)

    # Export rejected for review
    if all_failed:
        rejected_file = Path('~/data/T1_candidates/rejected.json').expanduser()
        with open(rejected_file, 'w', encoding='utf-8') as f:
            json.dump({
                'generated_at': datetime.now().isoformat(),
                'count': len(all_failed),
                'candidates': all_failed
            }, f, ensure_ascii=False, indent=2)

        print(f"[INFO] Rejected candidates saved to: {rejected_file}")

    return all_passed, all_failed


def main():
    parser = argparse.ArgumentParser(description='Run T2 → T1 Refinement Pipeline')

    parser.add_argument(
        '--sources',
        type=str,
        help='Comma-separated list of sources (e.g., helium10,reddit_fba)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Process all sources'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Limit candidates per source (for testing)'
    )
    parser.add_argument(
        '--skip-llm',
        action='store_true',
        help='Skip LLM generation (use existing truth_delta)'
    )

    args = parser.parse_args()

    # Determine sources
    if args.all:
        sources = ['sellersprite', 'junglescout', 'helium10', 'reddit_fba']
    elif args.sources:
        sources = [s.strip() for s in args.sources.split(',')]
    else:
        # Default to high-quality sources
        sources = ['helium10', 'reddit_fba']

    run_full_pipeline(
        sources=sources,
        limit_per_source=args.limit,
        skip_generation=args.skip_llm
    )


if __name__ == '__main__':
    main()
