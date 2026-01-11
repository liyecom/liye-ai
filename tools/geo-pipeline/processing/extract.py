"""
Geo Pipeline - Extract Module
提取模块：提取文档结构（标题、列表等）

职责：
- 提取Markdown标题
- 提取列表项
- 生成结构化metadata
- 输出unit JSON
"""

import json
import re
from pathlib import Path


def extract_headings(text, max_level=3):
    """
    提取Markdown标题

    Args:
        text: Markdown文本
        max_level: 最大标题层级（1-6）

    Returns:
        标题列表，每项包含 level 和 text
    """
    headings = []

    for line in text.split('\n'):
        # 匹配 Markdown 标题格式：# Title, ## Title, etc.
        match = re.match(r'^(#{1,6})\s+(.+)$', line.strip())
        if match:
            level = len(match.group(1))
            if level <= max_level:
                title = match.group(2).strip()
                # 移除可能的标题末尾的 #
                title = re.sub(r'\s*#+\s*$', '', title)
                headings.append({
                    'level': level,
                    'text': title
                })

    return headings


def extract_bullets(text):
    """
    提取列表项

    Args:
        text: Markdown文本

    Returns:
        列表项内容列表
    """
    bullets = []

    for line in text.split('\n'):
        # 匹配无序列表：- item, * item, + item
        match = re.match(r'^\s*[-*+]\s+(.+)$', line)
        if match:
            bullet_text = match.group(1).strip()
            bullets.append(bullet_text)

    return bullets


def extract_structure(config, dry_run=False):
    """
    提取文档结构

    Args:
        config: 配置字典
        dry_run: 是否干运行

    Returns:
        提取统计信息
    """
    print("📋 Extract: 提取标题、列表等结构")

    input_dir = config['paths']['processed'] / 'chunks'
    output_dir = config['paths']['processed'] / 'units'

    # 获取所有chunk文件
    chunk_files = list(input_dir.rglob('*_chunks.json'))
    print(f"   Found {len(chunk_files)} chunk files")

    if len(chunk_files) == 0:
        print("   ⚠️  No chunk files to process")
        return {"files_found": 0, "units_created": 0}

    if dry_run:
        print("   [DRY RUN] Would extract structure")
        print(f"   Output directory: {output_dir}")
        print(f"   Max heading level: {config['processing']['max_heading_level']}")
        # 显示前5个文件作为示例
        for f in chunk_files[:5]:
            rel_path = f.relative_to(input_dir)
            print(f"     - {rel_path}")
        if len(chunk_files) > 5:
            print(f"     ... and {len(chunk_files) - 5} more files")
        return {
            "files_found": len(chunk_files),
            "units_created": 0
        }

    # 创建输出目录
    output_dir.mkdir(parents=True, exist_ok=True)

    # 统计
    unit_id = 0
    processed_files = 0
    failed_files = 0
    units_with_headings = 0
    units_with_bullets = 0

    # 处理每个chunk文件
    for i, chunk_file in enumerate(chunk_files, 1):
        try:
            # 读取chunk数据
            data = json.loads(chunk_file.read_text(encoding='utf-8'))

            # 处理每个chunk
            for chunk_idx, chunk in enumerate(data['chunks']):
                # 提取结构
                headings = extract_headings(
                    chunk['content'],
                    max_level=config['processing']['max_heading_level']
                )
                bullets = extract_bullets(chunk['content'])

                # 创建unit
                unit = {
                    'id': f"unit_{unit_id:06d}",
                    'source_file': data['source_file'],
                    'chunk_index': chunk_idx,
                    'content': chunk['content'],
                    'metadata': {
                        'headings': headings,
                        'bullets': bullets,
                        'char_count': chunk['char_count']
                    },
                    # v0.2预留字段
                    'embeddings': None,
                    'entities': None,
                    'claims': None
                }

                # 保存unit
                unit_file = output_dir / f"unit_{unit_id:06d}.json"
                unit_file.write_text(
                    json.dumps(unit, indent=2, ensure_ascii=False),
                    encoding='utf-8'
                )

                # 统计
                if headings:
                    units_with_headings += 1
                if bullets:
                    units_with_bullets += 1

                unit_id += 1

            processed_files += 1

            if i <= 10 or i % 100 == 0:
                rel_path = chunk_file.relative_to(input_dir)
                print(f"   [{i}/{len(chunk_files)}] ✅ {rel_path} → {len(data['chunks'])} units")

        except Exception as e:
            failed_files += 1
            if i <= 10 or i % 100 == 0:
                print(f"   [{i}/{len(chunk_files)}] ❌ {chunk_file.name}: {e}")

    # 总结
    print(f"\n   ✅ Extraction complete:")
    print(f"      Chunk files found: {len(chunk_files)}")
    print(f"      Processed: {processed_files}")
    print(f"      Failed: {failed_files}")
    print(f"      Total units created: {unit_id}")
    print(f"      Units with headings: {units_with_headings}")
    print(f"      Units with bullets: {units_with_bullets}")

    return {
        "files_found": len(chunk_files),
        "files_processed": processed_files,
        "files_failed": failed_files,
        "units_created": unit_id,
        "units_with_headings": units_with_headings,
        "units_with_bullets": units_with_bullets
    }


if __name__ == "__main__":
    # 测试代码
    from pathlib import Path

    print("Testing extract module...")

    # 测试1: extract_headings函数
    print("\n1. Testing extract_headings function:")
    test_markdown = """
# 一级标题
这是一些内容。

## 二级标题
更多内容。

### 三级标题
- 列表项1
- 列表项2

#### 四级标题（应该被过滤）
"""
    headings = extract_headings(test_markdown, max_level=3)
    print(f"   Found {len(headings)} headings:")
    for h in headings:
        print(f"   - Level {h['level']}: {h['text']}")

    # 测试2: extract_bullets函数
    print("\n2. Testing extract_bullets function:")
    bullets = extract_bullets(test_markdown)
    print(f"   Found {len(bullets)} bullets:")
    for b in bullets:
        print(f"   - {b}")

    # 测试3: extract_structure函数（dry run）
    print("\n3. Testing extract_structure function (dry run):")
    test_config = {
        'paths': {
            'processed': Path.home() / 'data/processed/shengcai'
        },
        'processing': {
            'max_heading_level': 3
        }
    }
    extract_structure(test_config, dry_run=True)
