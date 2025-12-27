#!/usr/bin/env python3
"""
为文档添加简单的 frontmatter（不使用 API）
"""

import re
from pathlib import Path
from datetime import datetime


def extract_title_from_filename(filename: str) -> str:
    """从文件名推断标题"""
    # 移除扩展名
    name = filename.replace('.md', '')

    # 移除数字前缀
    name = re.sub(r'^\d+[_-]', '', name)

    # 替换下划线和连字符为空格
    name = name.replace('_', ' ').replace('-', ' ')

    # 移除"完整版"等后缀
    name = name.replace('完整版', '').strip()

    return name


def extract_existing_frontmatter(content: str) -> tuple:
    """提取已有的 frontmatter"""
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            return parts[1].strip(), parts[2].strip()
    return None, content


def infer_category(filename: str, content: str) -> str:
    """推断分类"""
    # 从文件名推断
    if '广告' in filename or '广告' in content[:500]:
        return '广告优化'
    elif '选品' in filename or '选品' in content[:500]:
        return '选品策略'
    elif 'VC' in filename or 'VC' in content[:500]:
        return '账号管理'
    elif '站外' in filename or '站外' in content[:500]:
        return '站外推广'
    elif '跟卖' in filename or '跟卖' in content[:500]:
        return '账号安全'
    elif '表格' in filename or '模板' in filename:
        return '工具模板'
    else:
        return '运营技巧'


def extract_keywords(content: str) -> list:
    """从内容中提取关键词"""
    keywords = set()

    # 常见关键词
    common_keywords = [
        'Amazon', '亚马逊', 'FBA', 'PPC', 'CPC', 'ACOS', 'ROI',
        '广告', '选品', 'Listing', 'BSR', '关键词', 'Review',
        '新品', '爆款', 'VC', '账号', '站外', '推广'
    ]

    for kw in common_keywords:
        if kw in content[:1000]:  # 只检查前 1000 字符
            keywords.add(kw)

    # 转换为列表并限制数量
    return list(keywords)[:5]


def generate_simple_frontmatter(file_path: Path) -> str:
    """生成简单的 frontmatter"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 提取已有 frontmatter
        existing_fm, body = extract_existing_frontmatter(content)

        # 如果已有 frontmatter，检查是否完整
        if existing_fm and all(key in existing_fm for key in ['title', 'category', 'pubDate']):
            print(f"   ⏭️  已有完整 frontmatter，跳过: {file_path.name}")
            return None

        # 推断元数据
        title = extract_title_from_filename(file_path.name)
        category = infer_category(file_path.name, body)
        keywords = extract_keywords(body)

        # 生成 frontmatter
        keywords_yaml = '\n'.join([f"  - {kw}" for kw in keywords]) if keywords else "  - Amazon"

        frontmatter = f"""---
title: {title}
description: {title}的详细指南和实战技巧
pubDate: {datetime.now().strftime('%Y-%m-%d')}
category: {category}
keywords:
{keywords_yaml}
affiliateProducts:
  - amazon_seller_tools
  - marketing_software
ctaText: 获取Amazon运营工具推荐
intent: commercial
---
"""

        # 写回文件
        new_content = frontmatter + body

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        return title

    except Exception as e:
        print(f"   ❌ 处理失败: {file_path.name} - {e}")
        return None


def main():
    posts_dir = Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts'

    print(f"🚀 添加简单 frontmatter...\\n   目录: {posts_dir}\\n")

    md_files = sorted(posts_dir.glob('*.md'))
    total = len(md_files)

    print(f"📋 找到 {total} 个文档\\n")

    processed = 0
    skipped = 0
    failed = 0

    for i, file_path in enumerate(md_files, 1):
        print(f"[{i}/{total}] {file_path.name}")

        result = generate_simple_frontmatter(file_path)

        if result is None:
            skipped += 1
        elif result:
            processed += 1
            print(f"   ✅ 标题: {result}")
        else:
            failed += 1

    print(f"\\n✅ 处理完成")
    print(f"   成功: {processed}")
    print(f"   跳过: {skipped}")
    print(f"   失败: {failed}")


if __name__ == '__main__':
    main()
