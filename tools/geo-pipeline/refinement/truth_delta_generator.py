"""
Truth Delta Generator (LLM-Assisted)
=====================================

Generates truth_delta suggestions for T1 candidates using Claude API.

IMPORTANT: This is NOT auto-fill. Generated deltas MUST pass TRUTH_DELTA_GATE.
The gate may reject LLM-generated deltas if they are vague or lack mechanism.

Usage:
    python -m refinement.truth_delta_generator --input candidates.json --output annotated.json

# ============================================================================
# FROZEN CONTRACT: TRUTH_DELTA_GATE
# ============================================================================
#
# TRUTH_DELTA_GATE is an **anti-noise constitutional gate**.
#
# Its purpose is to ensure T1 scarcity, NOT to maximize throughput.
# Low pass rates are EXPECTED and DESIRED behavior.
#
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  PROHIBITED MODIFICATIONS (Constitutional Violation)                    │
# ├─────────────────────────────────────────────────────────────────────────┤
# │  ❌ Auto-fill truth_delta when missing                                  │
# │  ❌ Pass candidates based on similarity/embedding distance              │
# │  ❌ Weaken validation rules to increase pass rate                       │
# │  ❌ Add "soft pass" or "conditional pass" logic                         │
# │  ❌ Bypass gate for "high quality" sources                              │
# │  ❌ Use fallback values when LLM returns NO_MECHANISM                   │
# └─────────────────────────────────────────────────────────────────────────┘
#
# If you need to modify this behavior, you MUST:
# 1. Update docs/architecture/T1_CANONICAL_DEFINITION.md first
# 2. Get explicit approval for constitutional amendment
# 3. Document the rationale in AMENDMENTS.md
#
# Reference: refinement/README.md § TRUTH_DELTA_GATE – Frozen Contract
# ============================================================================
"""

import os
import json
import time
from pathlib import Path
from typing import List, Dict, Optional
import anthropic

from .truth_delta_gate import TruthDeltaGate, validate_truth_delta


# System prompt for truth_delta generation
SYSTEM_PROMPT = """你是一个专业的知识单元分析师。你的任务是分析一段内容，并回答：

"这条内容新增了什么此前知识库中不存在的机制/因果关系？"

要求：
1. 必须描述一个具体的机制或因果关系
2. 使用"因为...所以..."、"当...时会导致..."、"通过...可以实现..."等因果句式
3. 不能是模糊的总结如"介绍了一些方法"、"讨论了相关话题"
4. 长度必须超过20个字符
5. 必须是可验证、可操作的知识点

示例（好）：
- "当ACoS超过35%时，降低bid 10-15%可以减少无效点击，因为高bid吸引的点击往往转化率较低"
- "Listing主图CTR低于2%会导致A9算法降低排名权重，因为Amazon将低CTR视为用户不感兴趣的信号"
- "使用Frequently Bought Together历史数据可以发现互补产品机会，因为Amazon已验证这些产品有购买关联"

示例（坏 - 会被拒绝）：
- "这篇文章介绍了Amazon运营技巧"（太模糊）
- "分享了一些PPC优化经验"（无具体机制）
- "提供了有用的建议"（样板语言）

如果内容确实不包含任何机制或因果关系，请回复：[NO_MECHANISM]"""


USER_PROMPT_TEMPLATE = """请分析以下内容，提取其中的机制或因果关系：

---
来源：{source}
标题：{title}
---

{content}

---

请用一句话描述这条内容新增了什么机制/因果关系："""


class TruthDeltaGenerator:
    """
    Generate truth_delta suggestions using Claude API.

    Note: Generated deltas are suggestions only.
    They MUST pass TRUTH_DELTA_GATE for T1 promotion.
    """

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.Anthropic()
        self.model = model
        self.gate = TruthDeltaGate()

        # Rate limiting
        self.requests_per_minute = 50
        self.last_request_time = 0

        # Statistics
        self.stats = {
            'total_processed': 0,
            'generated': 0,
            'no_mechanism': 0,
            'gate_passed': 0,
            'gate_failed': 0,
            'api_errors': 0
        }

    def _rate_limit(self):
        """Simple rate limiting"""
        min_interval = 60.0 / self.requests_per_minute
        elapsed = time.time() - self.last_request_time
        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)
        self.last_request_time = time.time()

    def generate_delta(self, candidate: Dict) -> Optional[str]:
        """
        Generate truth_delta for a single candidate.

        Returns:
            truth_delta string or None if no mechanism found
        """
        self._rate_limit()

        user_prompt = USER_PROMPT_TEMPLATE.format(
            source=candidate.get('source', 'Unknown'),
            title=candidate.get('source_title', 'Unknown'),
            content=candidate.get('content', '')
        )

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=200,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}]
            )

            delta = response.content[0].text.strip()

            if "[NO_MECHANISM]" in delta:
                self.stats['no_mechanism'] += 1
                return None

            self.stats['generated'] += 1
            return delta

        except Exception as e:
            print(f"[ERROR] API call failed: {e}")
            self.stats['api_errors'] += 1
            return None

    def process_candidates(self, candidates: List[Dict], validate: bool = True) -> List[Dict]:
        """
        Process a list of candidates and generate truth_delta.

        Args:
            candidates: List of candidate dicts
            validate: If True, run TRUTH_DELTA_GATE on generated deltas

        Returns:
            List of candidates with truth_delta filled (where possible)
        """
        results = []

        for i, candidate in enumerate(candidates):
            self.stats['total_processed'] += 1

            print(f"[{i+1}/{len(candidates)}] Processing: {candidate.get('id', 'unknown')[:30]}...")

            # Skip if already has truth_delta
            if candidate.get('truth_delta'):
                results.append(candidate)
                continue

            # Generate truth_delta
            delta = self.generate_delta(candidate)

            if delta:
                candidate['truth_delta'] = delta

                # Optionally validate with gate
                if validate:
                    result = validate_truth_delta(delta)
                    if result.passed:
                        candidate['gate_result'] = 'PASS'
                        self.stats['gate_passed'] += 1
                    else:
                        candidate['gate_result'] = f'FAIL: {result.reason.value}'
                        self.stats['gate_failed'] += 1
            else:
                candidate['truth_delta'] = None
                candidate['gate_result'] = 'SKIP: No mechanism found'

            results.append(candidate)

            # Progress update every 10 items
            if (i + 1) % 10 == 0:
                self._print_progress()

        return results

    def _print_progress(self):
        """Print progress statistics"""
        print(f"  Progress: {self.stats['total_processed']} processed, "
              f"{self.stats['generated']} generated, "
              f"{self.stats['gate_passed']} passed gate")

    def print_stats(self):
        """Print final statistics"""
        print("\n" + "=" * 50)
        print("Truth Delta Generation Statistics")
        print("=" * 50)
        print(f"Total processed: {self.stats['total_processed']}")
        print(f"Deltas generated: {self.stats['generated']}")
        print(f"No mechanism found: {self.stats['no_mechanism']}")
        print(f"Gate PASSED: {self.stats['gate_passed']}")
        print(f"Gate FAILED: {self.stats['gate_failed']}")
        print(f"API errors: {self.stats['api_errors']}")

        if self.stats['generated'] > 0:
            pass_rate = self.stats['gate_passed'] / self.stats['generated'] * 100
            print(f"Gate pass rate: {pass_rate:.1f}%")
        print("=" * 50)


def process_file(input_path: str, output_path: str, limit: int = None):
    """
    Process a candidates JSON file and generate truth_delta.

    Args:
        input_path: Path to candidates JSON
        output_path: Path for output JSON
        limit: Optional limit on number of candidates to process
    """
    input_path = Path(input_path).expanduser()
    output_path = Path(output_path).expanduser()

    print(f"Loading candidates from {input_path}...")
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    candidates = data.get('candidates', [])

    if limit:
        candidates = candidates[:limit]
        print(f"Processing first {limit} candidates...")

    generator = TruthDeltaGenerator()
    results = generator.process_candidates(candidates)

    generator.print_stats()

    # Update data with results
    data['candidates'] = results
    data['truth_delta_stats'] = generator.stats

    # Save results
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nResults saved to {output_path}")

    return generator.stats


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Generate truth_delta for T1 candidates')
    parser.add_argument('--input', required=True, help='Input candidates JSON file')
    parser.add_argument('--output', required=True, help='Output JSON file')
    parser.add_argument('--limit', type=int, help='Limit number of candidates to process')

    args = parser.parse_args()

    process_file(args.input, args.output, args.limit)
