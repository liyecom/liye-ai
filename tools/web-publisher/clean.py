#!/usr/bin/env python3
"""
GEO OS - 数据清洗脚本
过滤低价值内容，保留优质 units

过滤规则：
1. 邮箱列表（email 占比 > 30%）
2. 纯数据表格（数字/符号占比 > 50%）
3. 过短内容（< 100 字符）
4. 过长重复内容（> 1000 字符且重复度高）
5. 无意义内容（乱码、占位符等）

用法：
    python clean.py --input /path/to/geo_units.json --output /path/to/cleaned_units.json
"""

import json
import re
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List
from collections import Counter


def is_email_list(content: str) -> bool:
    """判断是否为邮箱列表"""
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    emails = re.findall(email_pattern, content)

    # 如果邮箱数量 > 10 或邮箱占比 > 30%
    if len(emails) > 10:
        return True

    email_chars = sum(len(e) for e in emails)
    if len(content) > 0 and email_chars / len(content) > 0.3:
        return True

    return False


def is_data_table(content: str) -> bool:
    """判断是否为纯数据表格"""
    # 统计数字、符号的占比
    digits_symbols = sum(1 for c in content if c.isdigit() or c in '.,;:|()[]{}\\/-_=+*&^%$#@!~`')

    if len(content) > 0 and digits_symbols / len(content) > 0.5:
        return True

    return False


def is_too_short(content: str, min_length: int = 100) -> bool:
    """判断内容是否过短"""
    # 去除空白后计算长度
    clean_content = content.strip()
    return len(clean_content) < min_length


def is_too_long(content: str, max_length: int = 1000) -> bool:
    """判断内容是否过长"""
    return len(content) > max_length


def is_repetitive(content: str, threshold: float = 0.7) -> bool:
    """判断内容是否高度重复"""
    # 按行分割
    lines = [line.strip() for line in content.split('\n') if line.strip()]

    if len(lines) < 5:
        return False

    # 统计重复行
    line_counts = Counter(lines)
    most_common_count = line_counts.most_common(1)[0][1] if line_counts else 0

    # 如果某一行出现次数 > 总行数的 70%
    if len(lines) > 0 and most_common_count / len(lines) > threshold:
        return True

    return False


def has_meaningful_content(content: str) -> bool:
    """判断是否有有意义的内容"""
    # 移除空白、标点
    clean = re.sub(r'[^\w\s]', '', content)
    clean = clean.strip()

    # 如果只剩下很少字符
    if len(clean) < 50:
        return False

    # 如果是乱码（非中英文字符过多）
    non_chinese_english = sum(1 for c in clean if not ('\u4e00' <= c <= '\u9fff' or c.isalpha()))
    if len(clean) > 0 and non_chinese_english / len(clean) > 0.5:
        return False

    return True


def calculate_quality_score(unit: Dict) -> int:
    """
    计算 unit 质量分数（0-100）

    评分标准：
    - 有标题：+30
    - 有列表：+20
    - 字数合理（200-800）：+20
    - 有意义内容：+30
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

    # 4. 有意义内容
    if has_meaningful_content(content):
        score += 30

    return score


def should_filter(unit: Dict) -> tuple[bool, str]:
    """
    判断是否应该过滤掉这个 unit

    Returns:
        (是否过滤, 原因)
    """
    content = unit.get('content', '')

    # 1. 邮箱列表
    if is_email_list(content):
        return (True, "邮箱列表")

    # 2. 纯数据表格
    if is_data_table(content):
        return (True, "纯数据表格")

    # 3. 过短内容
    if is_too_short(content, min_length=100):
        return (True, "内容过短")

    # 4. 高度重复
    if is_repetitive(content):
        return (True, "高度重复")

    # 5. 无意义内容
    if not has_meaningful_content(content):
        return (True, "无意义内容")

    return (False, "")


def clean_units(input_path: Path, output_path: Path, verbose: bool = False):
    """
    清洗 units 数据

    Args:
        input_path: 输入 JSON 文件
        output_path: 输出 JSON 文件
        verbose: 是否显示详细信息
    """
    print(f"📥 加载输入：{input_path}")

    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    units = data['units']
    total_units = len(units)

    print(f"📊 原始数据：{total_units} units")
    print(f"   文件大小：{input_path.stat().st_size / (1024**2):.1f} MB")
    print()

    # 统计
    filtered_units = []
    filter_reasons = Counter()
    quality_scores = []

    print("🧹 开始清洗...")

    for i, unit in enumerate(units, 1):
        # 判断是否过滤
        should_remove, reason = should_filter(unit)

        if should_remove:
            filter_reasons[reason] += 1
            if verbose and i <= 20:
                print(f"   [{i}/{total_units}] ❌ 过滤: {unit['id']} - {reason}")
            continue

        # 计算质量分数
        score = calculate_quality_score(unit)
        quality_scores.append(score)

        # 只保留质量分数 >= 30 的
        if score >= 30:
            filtered_units.append(unit)
            if verbose and i <= 20:
                print(f"   [{i}/{total_units}] ✅ 保留: {unit['id']} - 分数: {score}")
        else:
            filter_reasons["质量分数过低"] += 1

        # 进度显示
        if i % 10000 == 0:
            print(f"   [{i}/{total_units}] 已处理...")

    # 生成清洗后的数据
    output_data = {
        'version': '0.2.0',
        'cleaned_at': datetime.now().isoformat(),
        'source_file': str(input_path),
        'original_count': total_units,
        'cleaned_count': len(filtered_units),
        'filter_rate': f"{(1 - len(filtered_units)/total_units)*100:.1f}%",
        'units': filtered_units
    }

    # 保存
    print(f"\n💾 保存输出：{output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    # 统计报告
    print(f"\n✅ 清洗完成")
    print(f"   原始数量：{total_units}")
    print(f"   保留数量：{len(filtered_units)}")
    print(f"   过滤数量：{total_units - len(filtered_units)}")
    print(f"   过滤比例：{(1 - len(filtered_units)/total_units)*100:.1f}%")
    print(f"   输出大小：{output_path.stat().st_size / (1024**2):.1f} MB")
    print()

    print("📊 过滤原因统计：")
    for reason, count in filter_reasons.most_common():
        print(f"   {reason}: {count} ({count/total_units*100:.1f}%)")

    if quality_scores:
        print()
        print("📊 质量分数分布：")
        print(f"   平均分：{sum(quality_scores)/len(quality_scores):.1f}")
        print(f"   最高分：{max(quality_scores)}")
        print(f"   最低分：{min(quality_scores)}")

        # 分数段统计
        score_ranges = {
            '90-100': sum(1 for s in quality_scores if 90 <= s <= 100),
            '70-89': sum(1 for s in quality_scores if 70 <= s < 90),
            '50-69': sum(1 for s in quality_scores if 50 <= s < 70),
            '30-49': sum(1 for s in quality_scores if 30 <= s < 50),
        }

        for range_name, count in score_ranges.items():
            if count > 0:
                print(f"   {range_name}分: {count} ({count/len(quality_scores)*100:.1f}%)")


def main():
    parser = argparse.ArgumentParser(description='数据清洗脚本')
    parser.add_argument('--input', type=str, help='输入 JSON 文件路径')
    parser.add_argument('--output', type=str, help='输出 JSON 文件路径')
    parser.add_argument('--verbose', '-v', action='store_true', help='显示详细信息')

    args = parser.parse_args()

    # 默认路径
    if not args.input:
        args.input = str(Path.home() / 'data/exports/amazon_local/geo_units_v0.1.json')

    if not args.output:
        args.output = str(Path.home() / 'data/exports/amazon_local/cleaned_units.json')

    input_path = Path(args.input)
    output_path = Path(args.output)

    # 执行清洗
    clean_units(input_path, output_path, verbose=args.verbose)

    return 0


if __name__ == '__main__':
    exit(main())
