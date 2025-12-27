#!/usr/bin/env python3
"""
深度分析内容质量 - 不仅看是否有内容，还要看信息密度
"""

import re
from pathlib import Path
from typing import Dict


def analyze_content_quality(file_path: Path) -> Dict:
    """深度分析单个文件的内容质量"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 分离 frontmatter
        parts = content.split('---', 2)
        if len(parts) >= 3:
            body = parts[2].strip()
        else:
            body = content.strip()

        # 基础统计
        total_chars = len(body)
        lines = [line.strip() for line in body.split('\n') if line.strip()]

        # 去除表格、列表符号后的纯文本
        text_only = re.sub(r'\|', '', body)  # 移除表格符号
        text_only = re.sub(r'^[-*#]+\s*', '', text_only, flags=re.MULTILINE)  # 移除列表和标题符号
        text_only = re.sub(r'\s+', ' ', text_only)  # 压缩空白
        pure_text_chars = len(text_only.strip())

        # 段落分析
        paragraphs = [p.strip() for p in body.split('\n\n') if p.strip()]
        long_paragraphs = [p for p in paragraphs if len(p) > 50]  # 超过50字符的段落

        # 标题分析
        headings = re.findall(r'^#{1,6}\s+.+$', body, re.MULTILINE)

        # 完整句子分析（以句号、问号、感叹号结尾的）
        sentences = re.findall(r'[^。！？\.\?!]+[。！？\.\?!]', body)
        long_sentences = [s for s in sentences if len(s) > 20]

        # 质量评分
        quality_score = 0

        # 1. 字符数评分（最多30分）
        if pure_text_chars > 1000:
            quality_score += 30
        elif pure_text_chars > 500:
            quality_score += 20
        elif pure_text_chars > 200:
            quality_score += 10
        elif pure_text_chars > 100:
            quality_score += 5

        # 2. 段落评分（最多25分）
        if len(long_paragraphs) >= 5:
            quality_score += 25
        elif len(long_paragraphs) >= 3:
            quality_score += 15
        elif len(long_paragraphs) >= 1:
            quality_score += 5

        # 3. 结构评分（最多20分）
        if len(headings) >= 3:
            quality_score += 20
        elif len(headings) >= 2:
            quality_score += 10
        elif len(headings) >= 1:
            quality_score += 5

        # 4. 句子质量评分（最多25分）
        if len(long_sentences) >= 10:
            quality_score += 25
        elif len(long_sentences) >= 5:
            quality_score += 15
        elif len(long_sentences) >= 2:
            quality_score += 5

        # 质量等级
        if quality_score >= 70:
            quality_level = "优秀"
        elif quality_score >= 50:
            quality_level = "良好"
        elif quality_score >= 30:
            quality_level = "一般"
        else:
            quality_level = "较差"

        return {
            'path': str(file_path),
            'name': file_path.name,
            'total_chars': total_chars,
            'pure_text_chars': pure_text_chars,
            'lines': len(lines),
            'paragraphs': len(paragraphs),
            'long_paragraphs': len(long_paragraphs),
            'headings': len(headings),
            'sentences': len(sentences),
            'long_sentences': len(long_sentences),
            'quality_score': quality_score,
            'quality_level': quality_level,
        }

    except Exception as e:
        print(f"   ❌ {file_path.name}: {e}")
        return None


def main():
    posts_dir = Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts'

    print(f"📊 深度分析内容质量...\\n   目录: {posts_dir}\\n")

    md_files = sorted(posts_dir.glob('*.md'))
    results = []

    for file_path in md_files:
        result = analyze_content_quality(file_path)
        if result:
            results.append(result)

    # 按质量分级
    excellent = [r for r in results if r['quality_score'] >= 70]
    good = [r for r in results if 50 <= r['quality_score'] < 70]
    medium = [r for r in results if 30 <= r['quality_score'] < 50]
    poor = [r for r in results if r['quality_score'] < 30]

    print(f"\\n📈 质量分布：")
    print(f"   总文件数: {len(results)}")
    print(f"   优秀 (≥70分): {len(excellent)} ({len(excellent)/len(results)*100:.1f}%)")
    print(f"   良好 (50-69分): {len(good)} ({len(good)/len(results)*100:.1f}%)")
    print(f"   一般 (30-49分): {len(medium)} ({len(medium)/len(results)*100:.1f}%)")
    print(f"   较差 (<30分): {len(poor)} ({len(poor)/len(results)*100:.1f}%)")

    print(f"\\n⭐ 优秀文章（≥70分）：")
    excellent_sorted = sorted(excellent, key=lambda x: x['quality_score'], reverse=True)
    for i, r in enumerate(excellent_sorted[:20], 1):
        print(f"   {i}. {r['name']}")
        print(f"      评分: {r['quality_score']}分 | 文本: {r['pure_text_chars']}字 | 段落: {r['long_paragraphs']} | 标题: {r['headings']}")

    print(f"\\n✅ 良好文章（50-69分）示例：")
    good_sorted = sorted(good, key=lambda x: x['quality_score'], reverse=True)
    for i, r in enumerate(good_sorted[:10], 1):
        print(f"   {i}. {r['name']} - {r['quality_score']}分")

    print(f"\\n❌ 较差文章（<30分）示例：")
    poor_sorted = sorted(poor, key=lambda x: x['quality_score'])
    for i, r in enumerate(poor_sorted[:10], 1):
        print(f"   {i}. {r['name']} - {r['quality_score']}分 ({r['pure_text_chars']}字)")

    # 保存不同等级的文件列表
    output_dir = Path.home() / 'github/liye_os/tools/web-publisher'

    with open(output_dir / 'excellent_files.txt', 'w', encoding='utf-8') as f:
        for r in excellent_sorted:
            f.write(f"{r['name']}\\n")

    with open(output_dir / 'poor_files.txt', 'w', encoding='utf-8') as f:
        for r in poor_sorted:
            f.write(f"{r['name']}\\n")

    print(f"\\n💾 已保存文件列表到: {output_dir}")

    # 推荐策略
    print(f"\\n💡 建议：")
    if len(excellent) < 20:
        print(f"   ⚠️  优秀文章太少（仅{len(excellent)}篇），建议：")
        print(f"      1. 回到原始数据源，查找更完整的文档")
        print(f"      2. 使用 AI 扩展现有内容（针对良好和一般级别的文章）")
        print(f"      3. 删除较差文章（{len(poor)}篇），只保留优秀和良好的")


if __name__ == '__main__':
    main()
