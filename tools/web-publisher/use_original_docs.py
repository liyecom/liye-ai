#!/usr/bin/env python3
"""
直接使用原始知识库中的完整文档，替换 GEO OS 生成的碎片化内容
"""

import json
import os
import shutil
from pathlib import Path
from datetime import datetime


def find_complete_documents(base_dir: Path) -> list:
    """找到所有完整的 Markdown 文档"""
    print(f"🔍 扫描原始知识库: {base_dir}")

    all_md_files = list(base_dir.rglob('*.md'))
    complete_docs = []

    for file_path in all_md_files:
        # 统计文件大小和内容
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 过滤条件
            char_count = len(content)

            # 合理的文章长度：1000-100000 字符（约 500-50000 中文字）
            # 太短的是片段，太长的是数据表
            if char_count < 1000 or char_count > 100000:
                continue

            # 排除纯列表文件（如邮箱列表、关键词数据）
            if '邮箱' in file_path.name or 'email' in file_path.name.lower():
                continue
            if '关键词' in file_path.name or 'keywords' in file_path.name.lower():
                continue
            if '选品' in file_path.name and char_count > 50000:
                # 超大选品数据表
                continue

            # 排除索引文件
            if 'README' in file_path.name:
                # README 可能有价值，单独检查
                if char_count < 1000:
                    continue

            complete_docs.append({
                'path': file_path,
                'relative_path': file_path.relative_to(base_dir),
                'name': file_path.name,
                'char_count': char_count,
                'category': file_path.parent.name,
            })

        except Exception as e:
            print(f"   ⚠️  无法读取: {file_path.name} - {e}")
            continue

    # 按字符数排序
    complete_docs.sort(key=lambda x: x['char_count'], reverse=True)

    return complete_docs


def copy_to_astro(docs: list, target_dir: Path):
    """复制文档到 Astro 项目"""
    target_dir.mkdir(parents=True, exist_ok=True)

    # 清空目标目录
    for file in target_dir.glob('*.md'):
        file.unlink()

    print(f"\\n📋 准备复制 {len(docs)} 个文档到 Astro 项目...")

    copied = []
    for doc in docs:
        source = doc['path']
        # 使用原始文件名
        target = target_dir / doc['name']

        # 如果文件名冲突，添加数字后缀
        counter = 1
        while target.exists():
            stem = doc['name'].replace('.md', '')
            target = target_dir / f"{stem}-{counter}.md"
            counter += 1

        shutil.copy2(source, target)
        copied.append({
            'source': str(doc['relative_path']),
            'target': target.name,
            'char_count': doc['char_count'],
            'category': doc['category'],
        })

    return copied


def main():
    # 原始知识库路径
    amazon_kb = Path.home() / 'documents/CrossBorder/Amazon'

    # Astro 项目路径
    astro_posts = Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts'

    print("🚀 提取原始完整文档替换 GEO OS 碎片\\n")

    # 1. 找到所有完整文档
    complete_docs = find_complete_documents(amazon_kb)

    print(f"\\n✅ 找到 {len(complete_docs)} 个完整文档")
    print(f"\\n📊 文档分类统计：")

    # 按分类统计
    categories = {}
    for doc in complete_docs:
        cat = doc['category']
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(doc)

    for cat, docs in sorted(categories.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"   {cat}: {len(docs)} 篇")

    print(f"\\n⭐ 内容最丰富的文档（前 20）：")
    for i, doc in enumerate(complete_docs[:20], 1):
        print(f"   {i}. {doc['name']} - {doc['char_count']} 字 ({doc['category']})")

    # 2. 复制到 Astro 项目
    copied = copy_to_astro(complete_docs, astro_posts)

    print(f"\\n✅ 已复制 {len(copied)} 个文档到 Astro 项目")

    # 3. 保存复制记录
    output_file = Path.home() / 'github/liye_os/tools/web-publisher/copied_docs.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(copied, f, ensure_ascii=False, indent=2)

    print(f"\\n💾 复制记录已保存到: {output_file}")

    # 4. 统计
    total_chars = sum(d['char_count'] for d in copied)
    avg_chars = total_chars // len(copied) if copied else 0

    print(f"\\n📈 内容统计：")
    print(f"   文档数量: {len(copied)}")
    print(f"   总字符数: {total_chars:,}")
    print(f"   平均每篇: {avg_chars:,} 字")

    print(f"\\n⚠️  下一步：")
    print(f"   1. 运行 enhance.py 为这些文档生成 frontmatter")
    print(f"   2. 重新构建网站")


if __name__ == '__main__':
    main()
