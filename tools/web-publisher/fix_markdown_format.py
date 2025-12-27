#!/usr/bin/env python3
"""
修复 Markdown 文件的格式问题
将错误的 h1 标记转换为正确的 Markdown 格式
"""

import re
from pathlib import Path


def fix_markdown_format(content: str) -> str:
    """修复 Markdown 格式"""
    lines = content.split('\n')
    fixed_lines = []
    in_frontmatter = False
    frontmatter_count = 0

    for line in lines:
        # 保留 frontmatter
        if line.strip() == '---':
            frontmatter_count += 1
            in_frontmatter = not in_frontmatter
            fixed_lines.append(line)
            continue

        if in_frontmatter or frontmatter_count < 2:
            fixed_lines.append(line)
            continue

        # 如果是 h1 标记
        if line.startswith('# '):
            content = line[2:].strip()

            # 跳过空行
            if not content:
                continue

            # 检查是否是大章节标题（包含 ●、●、第X周等）
            if any(marker in content for marker in ['●', '●', '第一周', '第二周', '第三周', '第四周', '第1周', '第2周', '第3周', '第4周']):
                # 转换为 h2
                fixed_lines.append(f'## {content}')

            # 检查是否是数字列表（1. 2. 3. 等）
            elif re.match(r'^\d+[\.、\.]', content):
                # 转换为普通列表项
                fixed_lines.append(f'{content}')

            # 检查是否是日期标题（开售第一天、第2天-第7天等）
            elif re.match(r'^(开售)?第?\d+天', content) or re.match(r'^第\d+-\d+天', content):
                # 转换为 h3
                fixed_lines.append(f'### {content}')

            # 检查是否是"目标"、"注意"这样的小标题
            elif content in ['目标', '注意', '注意事项', '总结', '建议', '重点', '核心']:
                # 转换为 h3
                fixed_lines.append(f'### {content}')

            # 其他情况，转换为普通段落
            else:
                fixed_lines.append(content)

        else:
            fixed_lines.append(line)

    return '\n'.join(fixed_lines)


def process_file(file_path: Path):
    """处理单个文件"""
    print(f"处理: {file_path.name}")

    # 读取原文件
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 修复格式
    fixed_content = fix_markdown_format(content)

    # 保存修复后的文件
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed_content)

    print(f"  ✅ 已修复")


def main():
    posts_dir = Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts'

    print(f"🔧 开始修复 Markdown 格式问题...\n")

    # 处理所有 Markdown 文件
    md_files = list(posts_dir.glob('*.md'))

    for md_file in md_files:
        process_file(md_file)

    print(f"\n✅ 完成！共处理 {len(md_files)} 个文件")


if __name__ == '__main__':
    main()
