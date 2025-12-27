#!/usr/bin/env python3
"""
删除内容为空的文件，只保留有价值的文章
"""

import re
from pathlib import Path


def has_real_content(file_path: Path) -> bool:
    """检查文件是否有实际内容"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 分离 frontmatter
        parts = content.split('---', 2)
        if len(parts) >= 3:
            body = parts[2]
        else:
            body = content

        # 统计实际内容行
        lines = body.strip().split('\n')
        content_lines = 0

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            # 跳过表格分隔符和表头
            if re.match(r'^\|[\s\-:]+\|', stripped):
                continue
            if '|' in stripped and any(word in stripped for word in ['ASIN', 'SKU', '商品名称', '日期', '广告', '销售', '订单', '展示量', '点击量', '转化率']):
                continue
            # 有效内容
            if len(stripped) > 10 or not '|' in stripped:
                content_lines += 1

        # 至少要有 5 行实际内容
        return content_lines > 5

    except Exception as e:
        print(f"   ❌ {file_path.name}: {e}")
        return False


def main():
    posts_dir = Path.home() / 'github/liye_os/websites/amazon-optimization/src/content/posts'

    print(f"🗑️  删除空文件...\\n   目录: {posts_dir}\\n")

    md_files = sorted(posts_dir.glob('*.md'))
    removed = 0
    kept = 0

    for file_path in md_files:
        if has_real_content(file_path):
            kept += 1
        else:
            file_path.unlink()
            print(f"   ❌ 删除: {file_path.name}")
            removed += 1

    print(f"\\n✅ 清理完成")
    print(f"   删除: {removed} 个空文件")
    print(f"   保留: {kept} 个有价值的文件")


if __name__ == '__main__':
    main()
