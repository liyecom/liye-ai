#!/usr/bin/env python3
"""
分析 Markdown 内容质量，找出真正有价值的文章
"""

import re
from pathlib import Path
from typing import Dict, List


def analyze_file(file_path: Path) -> Dict:
    """分析单个文件的内容质量"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 分离 frontmatter
        parts = content.split('---', 2)
        if len(parts) >= 3:
            body = parts[2]
        else:
            body = content

        # 统计指标
        lines = body.strip().split('\n')
        total_lines = len(lines)

        # 统计实际内容行（非空行、非表头、非分隔符）
        content_lines = 0
        table_header_lines = 0
        table_separator_lines = 0
        empty_lines = 0

        for line in lines:
            stripped = line.strip()
            if not stripped:
                empty_lines += 1
            elif re.match(r'^\|[\s\-:]+\|', stripped):
                # 表格分隔符
                table_separator_lines += 1
            elif '|' in stripped and not any(word in stripped for word in ['ASIN', 'SKU', '商品名称', '日期', '广告', '销售', '订单']):
                # 可能是数据行
                content_lines += 1
            elif '|' in stripped:
                # 表头行
                table_header_lines += 1
            elif len(stripped) > 10:
                # 普通文本行（至少 10 个字符）
                content_lines += 1

        # 判断内容质量
        has_real_content = content_lines > 5  # 至少 5 行实际内容
        content_ratio = content_lines / total_lines if total_lines > 0 else 0

        return {
            'path': str(file_path),
            'name': file_path.name,
            'total_lines': total_lines,
            'content_lines': content_lines,
            'table_headers': table_header_lines,
            'table_separators': table_separator_lines,
            'empty_lines': empty_lines,
            'content_ratio': content_ratio,
            'has_real_content': has_real_content,
        }

    except Exception as e:
        print(f"   ❌ {file_path.name}: {e}")
        return None


def main():
    posts_dir = Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts'

    print(f"📊 分析内容质量...\\n   目录: {posts_dir}\\n")

    md_files = sorted(posts_dir.glob('*.md'))
    results = []

    for file_path in md_files:
        result = analyze_file(file_path)
        if result:
            results.append(result)

    # 分类
    good_files = [r for r in results if r['has_real_content']]
    empty_files = [r for r in results if not r['has_real_content']]

    print(f"\\n📈 统计结果：")
    print(f"   总文件数: {len(results)}")
    print(f"   有实际内容: {len(good_files)} ({len(good_files)/len(results)*100:.1f}%)")
    print(f"   内容为空: {len(empty_files)} ({len(empty_files)/len(results)*100:.1f}%)")

    print(f"\\n✅ 有价值的文件（前 20 个）：")
    good_sorted = sorted(good_files, key=lambda x: x['content_lines'], reverse=True)
    for i, r in enumerate(good_sorted[:20], 1):
        print(f"   {i}. {r['name']} - {r['content_lines']} 行内容 ({r['content_ratio']*100:.1f}%)")

    print(f"\\n❌ 空文件示例（前 10 个）：")
    for i, r in enumerate(empty_files[:10], 1):
        print(f"   {i}. {r['name']} - 仅 {r['content_lines']} 行内容")

    # 保存有价值的文件列表
    good_files_list = Path.home() / 'github/liye_os/tools/web-publisher/good_files.txt'
    with open(good_files_list, 'w', encoding='utf-8') as f:
        for r in good_sorted:
            f.write(f"{r['name']}\\n")

    print(f"\\n💾 已保存有价值的文件列表到: {good_files_list}")


if __name__ == '__main__':
    main()
