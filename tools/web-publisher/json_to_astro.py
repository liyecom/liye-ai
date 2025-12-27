#!/usr/bin/env python3
"""
JSON to Astro Markdown Converter
将 enhanced_units.json 转换为 Astro Content Collections Markdown 文件

用法：
    python json_to_astro.py --input enhanced_top_300.json --output ~/github/liye_os/websites/amazon-optimization/src/content/posts
"""

import json
import argparse
from pathlib import Path
from datetime import datetime
import re


def sanitize_slug(slug):
    """清理 slug，确保 URL 友好"""
    # 移除特殊字符，只保留字母、数字、连字符
    slug = re.sub(r'[^a-z0-9-]', '-', slug.lower())
    # 移除连续的连字符
    slug = re.sub(r'-+', '-', slug)
    # 移除首尾连字符
    slug = slug.strip('-')
    return slug or 'untitled'


def escape_yaml_string(text):
    """转义 YAML 字符串中的特殊字符"""
    if not text:
        return '""'

    # 如果包含特殊字符，用引号包裹
    if any(char in text for char in [':', '#', '"', "'", '\n', '&', '*', '[', ']', '{', '}']):
        # 转义双引号
        text = text.replace('"', '\\"')
        return f'"{text}"'

    return text


def generate_markdown(unit, index):
    """
    为单个 unit 生成 Astro Markdown 文件内容

    Args:
        unit: 单个 unit 数据
        index: unit 序号（用于生成唯一 slug）

    Returns:
        tuple: (filename, markdown_content)
    """
    # 提取字段
    title = unit.get('title', f'Article {index}')
    description = unit.get('description', '')
    category = unit.get('category', '跨境电商')
    keywords = unit.get('keywords', [])
    slug = unit.get('slug', f'article-{index}')
    affiliate_products = unit.get('affiliate_products', [])
    cta_text = unit.get('cta_text', '了解更多')
    intent = unit.get('intent', 'informational')
    content = unit.get('content', '')
    source_file = unit.get('source_file', '')

    # 确保 slug 唯一且安全
    slug = sanitize_slug(slug)
    if not slug or slug == 'untitled':
        slug = f'post-{index:04d}'

    # 生成当前日期
    pub_date = datetime.now().strftime('%Y-%m-%d')

    # 构建 frontmatter（YAML 格式）
    frontmatter = f"""---
title: {escape_yaml_string(title)}
description: {escape_yaml_string(description)}
pubDate: {pub_date}
category: {escape_yaml_string(category)}
"""

    # 添加 keywords 数组
    if keywords:
        frontmatter += 'keywords:\n'
        for kw in keywords:
            frontmatter += f'  - {escape_yaml_string(kw)}\n'
    else:
        frontmatter += 'keywords: []\n'

    # 添加联盟产品数组
    if affiliate_products:
        frontmatter += 'affiliateProducts:\n'
        for product in affiliate_products:
            frontmatter += f'  - {product}\n'
    else:
        frontmatter += 'affiliateProducts: []\n'

    # 添加其他字段
    frontmatter += f"""ctaText: {escape_yaml_string(cta_text)}
intent: {intent}
source: {escape_yaml_string(source_file)}
---

"""

    # 完整 Markdown 内容
    markdown_content = frontmatter + content

    # 文件名：使用 slug
    filename = f"{slug}.md"

    return filename, markdown_content


def convert_json_to_astro(input_path: Path, output_dir: Path, limit: int = None):
    """
    转换 JSON 到 Astro Markdown 文件

    Args:
        input_path: 输入 JSON 文件路径
        output_dir: 输出目录
        limit: 限制转换数量（测试用）
    """
    print(f"📥 加载输入：{input_path}")

    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    units = data.get('units', [])
    total = len(units)

    if limit:
        units = units[:limit]
        print(f"🧪 测试模式：只转换前 {limit} 个 units")

    print(f"📊 总数：{len(units)} units")

    # 确保输出目录存在
    output_dir.mkdir(parents=True, exist_ok=True)

    # 转换每个 unit
    print(f"\n🚀 开始转换...")

    success_count = 0
    failed_count = 0

    for i, unit in enumerate(units, 1):
        try:
            filename, markdown_content = generate_markdown(unit, i)

            # 保存文件
            output_path = output_dir / filename

            # 检查文件名冲突
            if output_path.exists():
                # 添加序号后缀
                base_name = output_path.stem
                output_path = output_dir / f"{base_name}-{i}.md"

            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)

            success_count += 1

            if i % 50 == 0:
                print(f"   [{i}/{len(units)}] 已处理...")

        except Exception as e:
            print(f"   ❌ 失败 [{i}]: {e}")
            failed_count += 1

    # 统计报告
    print(f"\n✅ 转换完成")
    print(f"   成功：{success_count}")
    print(f"   失败：{failed_count}")
    print(f"   输出目录：{output_dir}")
    print(f"   文件数：{len(list(output_dir.glob('*.md')))}")


def main():
    parser = argparse.ArgumentParser(description='JSON to Astro Markdown Converter')
    parser.add_argument('--input', type=str, help='输入 JSON 文件路径')
    parser.add_argument('--output', type=str, help='输出目录路径')
    parser.add_argument('--limit', type=int, help='限制转换数量（测试用）')

    args = parser.parse_args()

    # 默认路径
    if not args.input:
        args.input = str(Path.home() / 'data/exports/amazon_local/enhanced_top_300.json')

    if not args.output:
        args.output = str(Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts')

    input_path = Path(args.input)
    output_dir = Path(args.output)

    # 检查输入文件
    if not input_path.exists():
        print(f"❌ 错误：输入文件不存在：{input_path}")
        return 1

    # 执行转换
    convert_json_to_astro(input_path, output_dir, limit=args.limit)

    return 0


if __name__ == '__main__':
    exit(main())
