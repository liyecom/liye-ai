#!/usr/bin/env python3
"""
Markdown 内容清洗脚本
移除 Markdown 文件中的垃圾数据：NaN、Sheet2、Unnamed、广告信息等
"""

import re
from pathlib import Path
import argparse


def clean_content(content: str) -> str:
    """
    清洗内容中的垃圾数据

    Args:
        content: 原始 Markdown 内容

    Returns:
        清洗后的内容
    """
    lines = content.split('\n')
    cleaned_lines = []

    for line in lines:
        # 移除包含垃圾数据的行
        if any(pattern in line for pattern in [
            'NaN',           # Excel 空单元格
            'Unnamed:',      # Excel 未命名列
            'Sheet2',        # Excel 工作表名
            'Sheet3',
            'Sheet1',
            '加微信',        # 广告信息
            'finley0000',    # 具体微信号
            '更多跨境电商资料', # 广告文案
            '更多资料',
        ]):
            continue

        # 移除只包含表格分隔符的无用行
        if re.match(r'^\s*\|\s*(---\s*\|)+\s*$', line):
            # 检查下一行是否也是垃圾
            continue

        cleaned_lines.append(line)

    # 移除多余空行（超过2个连续空行压缩为1个）
    final_lines = []
    empty_count = 0

    for line in cleaned_lines:
        if line.strip() == '':
            empty_count += 1
            if empty_count <= 2:
                final_lines.append(line)
        else:
            empty_count = 0
            final_lines.append(line)

    # 移除开头和结尾的空行
    while final_lines and final_lines[0].strip() == '':
        final_lines.pop(0)

    while final_lines and final_lines[-1].strip() == '':
        final_lines.pop()

    return '\n'.join(final_lines)


def clean_markdown_file(file_path: Path) -> bool:
    """
    清洗单个 Markdown 文件

    Args:
        file_path: 文件路径

    Returns:
        是否修改了文件
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_length = len(content)

        # 分离 frontmatter 和 content
        parts = content.split('---', 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            body = parts[2]
        else:
            # 没有 frontmatter
            frontmatter = ''
            body = content

        # 清洗 body
        cleaned_body = clean_content(body)

        # 重组
        if frontmatter:
            cleaned_content = f"---{frontmatter}---\n{cleaned_body}\n"
        else:
            cleaned_content = cleaned_body

        new_length = len(cleaned_content)

        # 检查是否有变化
        if cleaned_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(cleaned_content)
            print(f"   ✅ {file_path.name} (减少 {original_length - new_length} 字符)")
            return True

        return False

    except Exception as e:
        print(f"   ❌ 错误处理 {file_path.name}: {e}")
        return False


def clean_all_posts(posts_dir: Path):
    """
    清洗所有文章

    Args:
        posts_dir: 文章目录
    """
    print(f"🧹 开始清洗内容...")
    print(f"   目录: {posts_dir}\n")

    md_files = sorted(posts_dir.glob('*.md'))
    total = len(md_files)
    modified = 0

    for file_path in md_files:
        if clean_markdown_file(file_path):
            modified += 1

    print(f"\n✅ 清洗完成")
    print(f"   总文件: {total}")
    print(f"   已修改: {modified}")
    print(f"   未改动: {total - modified}")


def main():
    parser = argparse.ArgumentParser(description='清洗 Markdown 内容中的垃圾数据')
    parser.add_argument(
        '--posts-dir',
        type=str,
        default='~/github/liye_os/websites/amazon-optimization/src/content/posts',
        help='文章目录路径'
    )

    args = parser.parse_args()

    posts_dir = Path(args.posts_dir).expanduser()

    if not posts_dir.exists():
        print(f"❌ 错误: 目录不存在: {posts_dir}")
        return 1

    clean_all_posts(posts_dir)

    return 0


if __name__ == '__main__':
    exit(main())
