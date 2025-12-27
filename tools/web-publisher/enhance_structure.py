#!/usr/bin/env python3
"""
智能识别并增强 Markdown 文章结构
将看起来像标题的独立短行转换为合适的标题级别
"""

import re
from pathlib import Path


def is_likely_heading(line: str, next_line: str = "") -> tuple:
    """判断一行是否可能是标题，返回 (是否是标题, 标题级别)"""
    text = line.strip()

    # 已经是标题，跳过
    if text.startswith('#'):
        return (False, 0)

    # 空行，跳过
    if not text:
        return (False, 0)

    # 太长的行不是标题（超过 30 个字符）
    if len(text) > 30:
        return (False, 0)

    # 数字列表项，不是标题
    if re.match(r'^\d+[\.、\.]', text):
        return (False, 0)

    # 包含句号或逗号的，不是标题
    if '。' in text or '，' in text:
        return (False, 0)

    # H2 级别的特征：
    # - 包含 "如何"、"什么"、"为什么"、"模式"、"策略"、"方法"、"技巧"
    # - 或者是阶段性标题："新品布局"、"广告打法"等
    h2_keywords = [
        '如何', '什么', '为什么', '情况', '模式', '策略', '方法',
        '技巧', '打法', '布局', '阶段', '步骤', '注意', '总结',
        '核心', '关键', '重点', '优势', '特点', '流程'
    ]

    if any(kw in text for kw in h2_keywords):
        return (True, 2)

    # H3 级别的特征：
    # - 包含序号或标记："模式一"、"模式二"、"其他"等
    # - 或者是问句
    h3_keywords = ['模式一', '模式二', '第一', '第二', '第三', '其他', '补充']

    if any(kw in text for kw in h3_keywords):
        return (True, 3)

    if text.endswith('？') or text.endswith('?'):
        return (True, 3)

    # 短标题（5-15个字符），且下一行不为空或是数字列表
    if 5 <= len(text) <= 15:
        if next_line.strip() and (
            next_line.strip().startswith('1.') or
            next_line.strip().startswith('▪') or
            len(next_line.strip()) > 20
        ):
            return (True, 2)

    return (False, 0)


def enhance_structure(content: str) -> str:
    """增强 Markdown 结构"""
    lines = content.split('\n')
    enhanced_lines = []
    in_frontmatter = False
    frontmatter_count = 0

    i = 0
    while i < len(lines):
        line = lines[i]

        # 保留 frontmatter
        if line.strip() == '---':
            frontmatter_count += 1
            in_frontmatter = not in_frontmatter
            enhanced_lines.append(line)
            i += 1
            continue

        if in_frontmatter or frontmatter_count < 2:
            enhanced_lines.append(line)
            i += 1
            continue

        # 获取下一行（用于判断）
        next_line = lines[i + 1] if i + 1 < len(lines) else ""

        # 检查是否是潜在标题
        is_heading, level = is_likely_heading(line, next_line)

        if is_heading:
            heading_prefix = '#' * level
            enhanced_lines.append(f"{heading_prefix} {line.strip()}")
        else:
            enhanced_lines.append(line)

        i += 1

    return '\n'.join(enhanced_lines)


def process_file(file_path: Path):
    """处理单个文件"""
    # 读取原文件
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 增强结构
    enhanced_content = enhance_structure(content)

    # 只有在有变化时才保存
    if enhanced_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(enhanced_content)
        print(f"✅ {file_path.name} - 已增强")
        return True
    else:
        print(f"⏭️  {file_path.name} - 无需修改")
        return False


def main():
    posts_dir = Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts'

    print(f"🔧 开始增强文章结构...\n")

    # 处理所有 Markdown 文件
    md_files = list(posts_dir.glob('*.md'))
    modified_count = 0

    for md_file in md_files:
        if process_file(md_file):
            modified_count += 1

    print(f"\n✅ 完成！共修改 {modified_count}/{len(md_files)} 个文件")


if __name__ == '__main__':
    main()
