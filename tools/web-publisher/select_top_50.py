#!/usr/bin/env python3
"""
从 296 个文档中筛选出前 50 篇最有价值的
"""

import re
from pathlib import Path


def analyze_document_value(file_path: Path) -> dict:
    """分析文档价值"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 基础指标
        char_count = len(content)
        lines = [line for line in content.split('\n') if line.strip()]

        # 标题数量（结构性指标）
        headings = re.findall(r'^#{1,6}\s+.+$', content, re.MULTILINE)

        # 段落数量
        paragraphs = [p for p in content.split('\n\n') if p.strip() and len(p.strip()) > 50]

        # 完整句子
        sentences = re.findall(r'[^。！？\.\?!]+[。！？\.\?!]', content)

        # 表格数量（表格多的通常是工具/模板，不是教程）
        tables = content.count('|---')

        # 列表项
        list_items = re.findall(r'^\s*[-*]\s+', content, re.MULTILINE)

        # 质量评分
        score = 0

        # 1. 长度评分（20分）- 倾向中等长度的教程
        if 3000 <= char_count <= 20000:
            score += 20
        elif 1500 <= char_count < 3000:
            score += 15
        elif 20000 < char_count <= 50000:
            score += 10
        elif char_count > 50000:
            score += 5  # 太长可能是表格

        # 2. 结构评分（25分）- 有清晰的章节结构
        if len(headings) >= 5:
            score += 25
        elif len(headings) >= 3:
            score += 15
        elif len(headings) >= 1:
            score += 5

        # 3. 段落评分（20分）- 有充实的内容段落
        if len(paragraphs) >= 10:
            score += 20
        elif len(paragraphs) >= 5:
            score += 15
        elif len(paragraphs) >= 2:
            score += 5

        # 4. 句子评分（15分）- 有完整的叙述
        if len(sentences) >= 20:
            score += 15
        elif len(sentences) >= 10:
            score += 10
        elif len(sentences) >= 5:
            score += 5

        # 5. 表格惩罚（-20分）- 表格太多说明是工具而非教程
        if tables > 20:
            score -= 20
        elif tables > 10:
            score -= 10
        elif tables > 5:
            score -= 5

        # 6. 列表加分（10分）- 有步骤或要点
        if len(list_items) >= 10:
            score += 10
        elif len(list_items) >= 5:
            score += 5

        # 7. 文件名加分（10分）- 优先完整版、攻略、指南
        if '完整版' in file_path.name:
            score += 10
        elif any(word in file_path.name for word in ['攻略', '指南', '详解', '实战', '技巧']):
            score += 5

        # 内容类型判断
        if tables > 10 and len(paragraphs) < 5:
            content_type = "工具/表格"
        elif '完整版' in file_path.name or len(paragraphs) >= 5:
            content_type = "教程/指南"
        elif len(list_items) >= 10:
            content_type = "清单/要点"
        else:
            content_type = "其他"

        return {
            'path': file_path,
            'name': file_path.name,
            'score': score,
            'char_count': char_count,
            'headings': len(headings),
            'paragraphs': len(paragraphs),
            'sentences': len(sentences),
            'tables': tables,
            'list_items': len(list_items),
            'content_type': content_type,
        }

    except Exception as e:
        print(f"   ❌ 分析失败: {file_path.name} - {e}")
        return None


def main():
    posts_dir = Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts'

    print(f"🔍 分析所有文档并筛选前 50 篇...\\n   目录: {posts_dir}\\n")

    md_files = list(posts_dir.glob('*.md'))
    results = []

    for file_path in md_files:
        result = analyze_document_value(file_path)
        if result:
            results.append(result)

    # 按评分排序
    results.sort(key=lambda x: x['score'], reverse=True)

    print(f"\\n📊 分析完成：共 {len(results)} 个文档")

    # 统计内容类型
    content_types = {}
    for r in results:
        ct = r['content_type']
        content_types[ct] = content_types.get(ct, 0) + 1

    print(f"\\n📋 内容类型分布：")
    for ct, count in sorted(content_types.items(), key=lambda x: x[1], reverse=True):
        print(f"   {ct}: {count} 篇")

    # 前 50 篇
    top_50 = results[:50]

    print(f"\\n⭐ 前 50 篇高质量文档：")
    for i, r in enumerate(top_50, 1):
        print(f"   {i}. {r['name']}")
        print(f"      评分: {r['score']} | 类型: {r['content_type']} | 字数: {r['char_count']} | 段落: {r['paragraphs']}")

    # 删除其他文档
    print(f"\\n🗑️  删除其他 {len(results) - 50} 个文档...")
    deleted = 0
    for r in results[50:]:
        r['path'].unlink()
        deleted += 1

    print(f"\\n✅ 清理完成")
    print(f"   保留: 50 篇高质量文档")
    print(f"   删除: {deleted} 篇低质量文档")

    # 保存 top 50 列表
    output_file = Path.home() / 'github/liye_os/tools/web-publisher/top_50_docs.txt'
    with open(output_file, 'w', encoding='utf-8') as f:
        for r in top_50:
            f.write(f"{r['name']}\\n")

    print(f"\\n💾 前 50 篇文档列表已保存到: {output_file}")


if __name__ == '__main__':
    main()
