"""
T2 → T1 Refinement Pipeline
============================

Converts T2 raw articles into T1 candidate knowledge units.

Pipeline stages:
1. Load T2 raw data
2. Chunk into knowledge units (~600 chars)
3. Extract metadata and structure
4. Generate truth_delta candidates (requires LLM or manual)
5. Validate with TRUTH_DELTA_GATE
6. Export approved T1 units

Constitutional References:
- docs/architecture/T1_CANONICAL_DEFINITION.md - T1 definition
- docs/architecture/T1_CONSUMPTION_RULES.md - Usage constraints

# ============================================================================
# T1 CONSUMPTION CONSTRAINT
# ============================================================================
#
# T1 is not an answer source. It is a reasoning substrate.
#
# Exported T1 units must only be consumed by:
#   - Analyst Agent
#   - Strategy Agent
#   - OS-level Reasoning Modules
#
# Prohibited:
#   - Human direct reading as tutorials
#   - Direct content reuse in generation
#   - RAG retrieval returning raw T1 as answers
#
# ============================================================================
"""

import os
import json
import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

from .truth_delta_gate import TruthDeltaGate, GateResult


@dataclass
class T2Article:
    """Raw T2 article"""
    source: str
    source_url: str
    fetched_at: str
    char_count: int
    language: str
    tier: str
    title: str
    content: str
    file_path: str


@dataclass
class T1Candidate:
    """Candidate T1 knowledge unit"""
    id: str
    content: str
    source: str
    source_url: str
    source_title: str
    language: str
    chunk_index: int
    total_chunks: int
    char_count: int
    truth_delta: Optional[str] = None  # REQUIRED for T1 promotion
    gate_result: Optional[str] = None


class RefinementPipeline:
    """
    T2 → T1 Refinement Pipeline

    Constitutional constraints:
    - NO auto-fill of truth_delta
    - NO fallback for failed validations
    - All units must pass TRUTH_DELTA_GATE
    """

    # Processing parameters
    CHUNK_SIZE = 600
    CHUNK_OVERLAP = 100
    MIN_CHUNK_SIZE = 100  # Skip chunks smaller than this

    def __init__(self, t2_raw_path: str, output_path: str):
        self.t2_raw_path = Path(t2_raw_path).expanduser()
        self.output_path = Path(output_path).expanduser()
        self.gate = TruthDeltaGate()

        # Statistics
        self.stats = {
            'articles_processed': 0,
            'candidates_generated': 0,
            'candidates_with_delta': 0,
            'gate_passed': 0,
            'gate_failed': 0,
            'by_source': {}
        }

    def load_t2_articles(self, source: str) -> List[T2Article]:
        """Load all T2 articles from a source directory"""
        source_path = self.t2_raw_path / source
        articles = []

        if not source_path.exists():
            print(f"[WARN] Source path not found: {source_path}")
            return articles

        for file_path in source_path.glob("*.md"):
            if file_path.name.startswith("_"):
                continue  # Skip stats files

            try:
                article = self._parse_article(file_path, source)
                if article:
                    articles.append(article)
            except Exception as e:
                print(f"[ERROR] Failed to parse {file_path}: {e}")

        return articles

    def _parse_article(self, file_path: Path, source: str) -> Optional[T2Article]:
        """Parse a T2 markdown article"""
        content = file_path.read_text(encoding='utf-8')

        # Extract YAML frontmatter
        frontmatter_match = re.match(r'^---\n(.+?)\n---\n(.+)$', content, re.DOTALL)
        if not frontmatter_match:
            return None

        frontmatter_text = frontmatter_match.group(1)
        body = frontmatter_match.group(2).strip()

        # Parse frontmatter
        frontmatter = {}
        for line in frontmatter_text.split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                frontmatter[key.strip()] = value.strip()

        # Extract title from first heading
        title_match = re.match(r'^#\s+(.+)$', body, re.MULTILINE)
        title = title_match.group(1) if title_match else file_path.stem

        return T2Article(
            source=frontmatter.get('source', source),
            source_url=frontmatter.get('source_url', ''),
            fetched_at=frontmatter.get('fetched_at', ''),
            char_count=int(frontmatter.get('char_count', len(body))),
            language=frontmatter.get('language', 'en'),
            tier=frontmatter.get('tier', 'T2'),
            title=title,
            content=body,
            file_path=str(file_path)
        )

    def chunk_article(self, article: T2Article) -> List[T1Candidate]:
        """Split article into chunks suitable for T1 units"""
        candidates = []
        content = article.content

        # Remove title line (already captured)
        content = re.sub(r'^#\s+.+\n', '', content).strip()

        # Split by paragraphs first
        paragraphs = re.split(r'\n\n+', content)

        current_chunk = ""
        chunk_index = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # Skip very short paragraphs that look like navigation/footer
            if len(para) < 30 and not re.search(r'[.!?]$', para):
                continue

            if len(current_chunk) + len(para) + 2 <= self.CHUNK_SIZE:
                current_chunk += ("\n\n" if current_chunk else "") + para
            else:
                # Save current chunk if large enough
                if len(current_chunk) >= self.MIN_CHUNK_SIZE:
                    candidates.append(self._create_candidate(
                        article, current_chunk, chunk_index
                    ))
                    chunk_index += 1

                # Start new chunk with overlap
                if len(para) > self.CHUNK_SIZE:
                    # Handle very long paragraphs
                    for i in range(0, len(para), self.CHUNK_SIZE - self.CHUNK_OVERLAP):
                        chunk = para[i:i + self.CHUNK_SIZE]
                        if len(chunk) >= self.MIN_CHUNK_SIZE:
                            candidates.append(self._create_candidate(
                                article, chunk, chunk_index
                            ))
                            chunk_index += 1
                    current_chunk = ""
                else:
                    current_chunk = para

        # Don't forget last chunk
        if len(current_chunk) >= self.MIN_CHUNK_SIZE:
            candidates.append(self._create_candidate(
                article, current_chunk, chunk_index
            ))

        # Update total_chunks for all candidates
        total = len(candidates)
        for c in candidates:
            c.total_chunks = total

        return candidates

    def _create_candidate(self, article: T2Article, content: str, index: int) -> T1Candidate:
        """Create a T1 candidate from chunk"""
        # Generate unique ID
        source_short = article.source.lower().replace(' ', '_')[:10]
        title_short = re.sub(r'[^a-zA-Z0-9]', '', article.title)[:20]
        unit_id = f"t1_{source_short}_{title_short}_{index}"

        return T1Candidate(
            id=unit_id,
            content=content,
            source=article.source,
            source_url=article.source_url,
            source_title=article.title,
            language=article.language,
            chunk_index=index,
            total_chunks=0,  # Will be updated later
            char_count=len(content),
            truth_delta=None,  # MUST be filled externally
            gate_result=None
        )

    def process_source(self, source: str) -> Tuple[List[T1Candidate], List[T1Candidate]]:
        """
        Process a single T2 source.

        Returns:
            Tuple of (candidates_needing_delta, validated_units)
        """
        print(f"\n[{source}] Loading T2 articles...")
        articles = self.load_t2_articles(source)
        print(f"[{source}] Loaded {len(articles)} articles")

        all_candidates = []
        for article in articles:
            candidates = self.chunk_article(article)
            all_candidates.extend(candidates)
            self.stats['articles_processed'] += 1

        self.stats['candidates_generated'] += len(all_candidates)
        print(f"[{source}] Generated {len(all_candidates)} candidates")

        # Track by source
        self.stats['by_source'][source] = {
            'articles': len(articles),
            'candidates': len(all_candidates)
        }

        return all_candidates, []  # No validated units yet (need truth_delta)

    def validate_candidates(self, candidates: List[T1Candidate]) -> Tuple[List[T1Candidate], List[T1Candidate]]:
        """
        Validate candidates that have truth_delta filled.

        Returns:
            Tuple of (passed_units, failed_units)
        """
        passed = []
        failed = []

        for candidate in candidates:
            if candidate.truth_delta is None:
                continue  # Skip candidates without truth_delta

            self.stats['candidates_with_delta'] += 1

            result = self.gate.evaluate({
                'content': candidate.content,
                'truth_delta': candidate.truth_delta
            })

            if result.passed:
                candidate.gate_result = "PASS"
                passed.append(candidate)
                self.stats['gate_passed'] += 1
            else:
                candidate.gate_result = f"FAIL: {result.reason.value if result.reason else 'Unknown'}"
                failed.append(candidate)
                self.stats['gate_failed'] += 1

        return passed, failed

    def export_candidates(self, candidates: List[T1Candidate], filename: str):
        """Export candidates to JSON for truth_delta annotation"""
        output_file = self.output_path / filename
        output_file.parent.mkdir(parents=True, exist_ok=True)

        data = {
            'generated_at': datetime.now().isoformat(),
            'total_candidates': len(candidates),
            'instruction': (
                "Fill 'truth_delta' field for each candidate.\n"
                "Must answer: '这条内容新增了什么此前 T1 中不存在的机制/因果关系？'\n"
                "Requirements: >20 chars, specific mechanism/causality, not vague/boilerplate"
            ),
            'candidates': [asdict(c) for c in candidates]
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"[EXPORT] Candidates saved to {output_file}")
        return output_file

    def export_validated(self, units: List[T1Candidate], filename: str):
        """
        Export validated T1 units.

        NOTE: Exported T1 units are subject to consumption rules.
        Reference: docs/architecture/T1_CONSUMPTION_RULES.md

        T1 is not an answer source. It is a reasoning substrate.
        """
        output_file = self.output_path / filename

        data = {
            'version': '0.1.0',
            'tier': 'T1',
            'generated_at': datetime.now().isoformat(),
            'unit_count': len(units),
            # Consumption rules - T1 usage constraints
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
            'units': [asdict(u) for u in units]
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"[EXPORT] T1 units saved to {output_file}")
        return output_file

    def print_stats(self):
        """Print processing statistics"""
        print("\n" + "=" * 50)
        print("T2 → T1 Refinement Pipeline Statistics")
        print("=" * 50)
        print(f"Articles processed: {self.stats['articles_processed']}")
        print(f"Candidates generated: {self.stats['candidates_generated']}")
        print(f"Candidates with truth_delta: {self.stats['candidates_with_delta']}")
        print(f"Gate PASSED: {self.stats['gate_passed']}")
        print(f"Gate FAILED: {self.stats['gate_failed']}")
        print("\nBy source:")
        for source, data in self.stats['by_source'].items():
            print(f"  {source}: {data['articles']} articles → {data['candidates']} candidates")
        print("=" * 50)


def run_pipeline(sources: List[str] = None):
    """
    Run the T2 → T1 refinement pipeline.

    This generates candidate files that need truth_delta annotation.
    """
    if sources is None:
        sources = ['sellersprite', 'junglescout', 'helium10', 'reddit_fba']

    pipeline = RefinementPipeline(
        t2_raw_path='~/data/T2_raw',
        output_path='~/data/T1_candidates'
    )

    all_candidates = []

    for source in sources:
        candidates, _ = pipeline.process_source(source)
        all_candidates.extend(candidates)

        # Export per-source candidates
        pipeline.export_candidates(
            candidates,
            f'{source}_candidates.json'
        )

    # Export combined candidates
    pipeline.export_candidates(all_candidates, 'all_candidates.json')

    pipeline.print_stats()

    return pipeline


if __name__ == '__main__':
    run_pipeline()
