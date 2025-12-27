#!/usr/bin/env python3
"""
为原始 Markdown 文档添加 Astro frontmatter
"""

import os
import re
import json
from pathlib import Path
from datetime import datetime
import anthropic


def extract_existing_frontmatter(content: str) -> tuple:
    """提取已有的 frontmatter（如果有）"""
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            return parts[1].strip(), parts[2].strip()
    return None, content


def generate_frontmatter(file_path: Path, content: str, api_key: str) -> dict:
    """使用 Claude API 生成 frontmatter"""
    client = anthropic.Anthropic(api_key=api_key)

    # 提取已有 frontmatter（如果有）
    existing_fm, body = extract_existing_frontmatter(content)

    # 只取前 2000 字符作为预览
    preview = body[:2000]

    prompt = f"""请为以下 Amazon 跨境电商文档生成 Astro frontmatter。

文件名：{file_path.name}

{f"已有 frontmatter：\\n{existing_fm}\\n" if existing_fm else ""}

内容预览：
{preview}

请生成：
1. title: 吸引人的标题（50字符以内）
2. description: SEO描述（150字符以内）
3. category: 分类（从以下选择：跨境电商/广告优化/选品策略/运营技巧/站外推广/账号安全/工具模板）
4. keywords: 5个SEO关键词（数组）
5. affiliateProducts: 推荐的联盟产品（从以下选择，可多选）：
   - amazon_seller_tools（Amazon卖家工具）
   - marketing_software（营销软件）
   - online_courses（在线课程）
6. ctaText: Call-to-Action文案
7. intent: 用户意图（informational=纯学习/commercial=比较选择/transactional=准备购买）

返回严格的JSON格式：
{{
  "title": "...",
  "description": "...",
  "category": "...",
  "keywords": ["...", "...", ...],
  "affiliateProducts": ["...", "..."],
  "ctaText": "...",
  "intent": "informational|commercial|transactional"
}}"""

    try:
        message = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text.strip()

        # 提取 JSON
        json_match = re.search(r'\\{[\\s\\S]*\\}', response_text)
        if json_match:
            metadata = json.loads(json_match.group())
            return metadata
        else:
            print(f"   ⚠️  无法解析 JSON: {file_path.name}")
            return None

    except Exception as e:
        print(f"   ❌ API 调用失败: {file_path.name} - {e}")
        return None


def add_frontmatter_to_file(file_path: Path, metadata: dict):
    """为文件添加 frontmatter"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 移除已有的 frontmatter（如果有）
        _, body = extract_existing_frontmatter(content)

        # 生成新的 frontmatter
        frontmatter = f"""---
title: {metadata['title']}
description: {metadata['description']}
pubDate: {datetime.now().strftime('%Y-%m-%d')}
category: {metadata['category']}
keywords:
"""
        for kw in metadata['keywords']:
            frontmatter += f"  - {kw}\\n"

        if metadata.get('affiliateProducts'):
            frontmatter += "affiliateProducts:\\n"
            for prod in metadata['affiliateProducts']:
                frontmatter += f"  - {prod}\\n"

        frontmatter += f"""ctaText: {metadata.get('ctaText', '查看推荐工具')}
intent: {metadata['intent']}
---
"""

        # 组合新内容
        new_content = frontmatter + body

        # 写回文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        return True

    except Exception as e:
        print(f"   ❌ 写入失败: {file_path.name} - {e}")
        return False


def main():
    posts_dir = Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts'
    api_key = os.getenv('ANTHROPIC_API_KEY')

    if not api_key:
        print("❌ 未找到 ANTHROPIC_API_KEY 环境变量")
        return

    print(f"🚀 为原始文档添加 frontmatter...\\n   目录: {posts_dir}\\n")

    md_files = sorted(posts_dir.glob('*.md'))
    total = len(md_files)

    print(f"📋 找到 {total} 个文档\\n")

    processed = 0
    failed = 0

    for i, file_path in enumerate(md_files, 1):
        print(f"[{i}/{total}] 处理: {file_path.name}")

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 生成 frontmatter
            metadata = generate_frontmatter(file_path, content, api_key)

            if metadata:
                # 添加到文件
                if add_frontmatter_to_file(file_path, metadata):
                    processed += 1
                    print(f"   ✅ 成功: {metadata['title']}")
                else:
                    failed += 1
            else:
                failed += 1

        except Exception as e:
            print(f"   ❌ 错误: {e}")
            failed += 1

    print(f"\\n✅ 处理完成")
    print(f"   成功: {processed}")
    print(f"   失败: {failed}")


if __name__ == '__main__':
    main()
