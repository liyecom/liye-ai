#!/usr/bin/env python3
"""
提取 Top N 高质量 units

用法：
    python extract_top.py --input cleaned_units.json --output top_300.json --top 300
"""

import json
import argparse
from pathlib import Path
from datetime import datetime


def calculate_quality_score(unit):
    """
    计算质量分数（与 clean.py 保持一致）
    """
    score = 0
    content = unit.get('content', '')
    metadata = unit.get('metadata', {})

    # 1. 有标题
    if metadata.get('headings') and len(metadata['headings']) > 0:
        score += 30

    # 2. 有列表
    if metadata.get('bullets') and len(metadata['bullets']) > 0:
        score += 20

    # 3. 字数合理
    char_count = metadata.get('char_count', len(content))
    if 200 <= char_count <= 800:
        score += 20
    elif 100 <= char_count < 200 or 800 < char_count <= 1000:
        score += 10

    # 4. 有意义内容（简化版）
    clean_content = content.strip()
    if len(clean_content) >= 100:
        score += 30

    return score


def extract_top_units(input_path: Path, output_path: Path, top_n: int = 300):
    """
    提取 Top N 高质量 units

    Args:
        input_path: 输入 JSON
        output_path: 输出 JSON
        top_n: 提取数量
    """
    print(f"📥 加载输入：{input_path}")

    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    units = data['units']
    print(f"📊 原始数量：{len(units)} units")

    # 计算每个 unit 的质量分数
    print(f"🔍 计算质量分数...")
    scored_units = []

    for i, unit in enumerate(units, 1):
        score = calculate_quality_score(unit)
        scored_units.append((score, unit))

        if i % 10000 == 0:
            print(f"   [{i}/{len(units)}] 已处理...")

    # 按分数排序（降序）
    print(f"📊 按质量分数排序...")
    scored_units.sort(key=lambda x: x[0], reverse=True)

    # 提取 Top N
    top_units = [unit for score, unit in scored_units[:top_n]]
    top_scores = [score for score, unit in scored_units[:top_n]]

    # 生成输出
    output_data = {
        'version': '0.2.0',
        'extracted_at': datetime.now().isoformat(),
        'source_file': str(input_path),
        'original_count': len(units),
        'extracted_count': len(top_units),
        'extraction_method': f'top_{top_n}_by_quality_score',
        'units': top_units
    }

    # 保存
    print(f"\n💾 保存输出：{output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    # 统计报告
    print(f"\n✅ 提取完成")
    print(f"   原始数量：{len(units)}")
    print(f"   提取数量：{len(top_units)}")
    print(f"   提取比例：{len(top_units)/len(units)*100:.1f}%")
    print(f"   输出大小：{output_path.stat().st_size / (1024**2):.1f} MB")
    print()

    print("📊 Top N 质量分数分布：")
    print(f"   平均分：{sum(top_scores)/len(top_scores):.1f}")
    print(f"   最高分：{max(top_scores)}")
    print(f"   最低分：{min(top_scores)}")
    print()

    # 分数段统计
    score_ranges = {
        '90-100': sum(1 for s in top_scores if 90 <= s <= 100),
        '70-89': sum(1 for s in top_scores if 70 <= s < 90),
        '50-69': sum(1 for s in top_scores if 50 <= s < 70),
        '30-49': sum(1 for s in top_scores if 30 <= s < 50),
    }

    for range_name, count in score_ranges.items():
        if count > 0:
            print(f"   {range_name}分: {count} ({count/len(top_scores)*100:.1f}%)")

    # 显示前 5 个示例
    print()
    print("📋 Top 5 示例：")
    for i, (score, unit) in enumerate(scored_units[:5], 1):
        source = Path(unit['source_file']).name
        preview = unit['content'][:60].replace('\n', ' ')
        print(f"   {i}. [分数:{score}] {source}")
        print(f"      内容预览: {preview}...")


def main():
    parser = argparse.ArgumentParser(description='提取 Top N 高质量 units')
    parser.add_argument('--input', type=str, help='输入 JSON 文件路径')
    parser.add_argument('--output', type=str, help='输出 JSON 文件路径')
    parser.add_argument('--top', type=int, default=300, help='提取数量（默认 300）')

    args = parser.parse_args()

    # 默认路径
    if not args.input:
        args.input = str(Path.home() / 'data/exports/amazon_local/cleaned_units.json')

    if not args.output:
        args.output = str(Path.home() / f'data/exports/amazon_local/top_{args.top}_units.json')

    input_path = Path(args.input)
    output_path = Path(args.output)

    # 执行提取
    extract_top_units(input_path, output_path, top_n=args.top)

    return 0


if __name__ == '__main__':
    exit(main())
