#!/usr/bin/env python3
"""
为抓取的卖家精灵文章添加 Astro frontmatter
"""

from pathlib import Path
import re
import yaml

def add_frontmatter(input_file: Path) -> str:
    """为单个文件添加 frontmatter"""
    content = input_file.read_text(encoding='utf-8')

    # 提取现有 frontmatter（如果有）
    frontmatter_match = re.match(r'^---\n(.*?)\n---\n\n', content, re.DOTALL)
    if frontmatter_match:
        existing_meta = yaml.safe_load(frontmatter_match.group(1))
        # 提取正文
        body = content[frontmatter_match.end():]
    else:
        existing_meta = {}
        body = content

    # 提取标题
    title_match = re.search(r'^# (.+)$', body, re.MULTILINE)
    if title_match:
        title = title_match.group(1)
        # 移除标题行（Astro 会自动显示）
        body = body[title_match.end():].strip()
    else:
        title = input_file.stem

    # 生成 Astro frontmatter
    astro_frontmatter = {
        'title': title,
        'description': title[:150],  # 使用标题作为描述
        'pubDate': existing_meta.get('fetched_at', '2025-12-26'),
        'category': '亚马逊运营',
        'keywords': ['亚马逊', '运营', '选品', '广告', 'Listing'],
        'intent': 'informational',  # 默认为学习类内容
        'source': existing_meta.get('source', '卖家精灵'),
        'source_url': existing_meta.get('source_url', ''),
    }

    # 生成新文件内容
    new_content = f"""---
title: "{astro_frontmatter['title']}"
description: "{astro_frontmatter['description']}"
pubDate: {astro_frontmatter['pubDate']}
category: "{astro_frontmatter['category']}"
keywords: {astro_frontmatter['keywords']}
intent: "{astro_frontmatter['intent']}"
source: "{astro_frontmatter['source']}"
source_url: "{astro_frontmatter['source_url']}"
---

{body}
"""

    return new_content


def main():
    input_dir = Path.home() / 'github/liye_os/tools/web-publisher/fetched_articles_final'
    output_dir = Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts'

    if not input_dir.exists():
        print(f"❌ 输入目录不存在: {input_dir}")
        return

    if not output_dir.exists():
        print(f"❌ 输出目录不存在: {output_dir}")
        return

    md_files = list(input_dir.glob('*.md'))

    if not md_files:
        print(f"❌ 在 {input_dir} 中未找到 Markdown 文件")
        return

    print(f"📝 找到 {len(md_files)} 个文件\n")

    success = 0
    for md_file in md_files:
        try:
            new_content = add_frontmatter(md_file)
            output_file = output_dir / md_file.name
            output_file.write_text(new_content, encoding='utf-8')
            print(f"✅ {md_file.name}")
            success += 1
        except Exception as e:
            print(f"❌ {md_file.name}: {e}")

    print(f"\n✅ 完成！成功处理 {success}/{len(md_files)} 个文件")
    print(f"   输出目录: {output_dir}")


if __name__ == '__main__':
    main()
