"""
Geo Pipeline - Chunk Module
分块模块：将长文档分割为固定大小的chunks

职责：
- 按固定大小分块（带重叠）
- 保持语义完整性
- 输出chunk JSON
"""

import json
from pathlib import Path


def chunk_text(text, chunk_size=600, overlap=100):
    """
    简单滑动窗口分块

    Args:
        text: 文本内容
        chunk_size: 块大小（字符数）
        overlap: 重叠大小（字符数）

    Returns:
        chunks列表
    """
    chunks = []
    start = 0
    text_length = len(text)

    # 如果文本为空或很短，返回单个chunk
    if text_length == 0:
        return []

    if text_length <= chunk_size:
        return [{
            'start': 0,
            'end': text_length,
            'content': text.strip(),
            'char_count': text_length
        }]

    # 滑动窗口分块
    while start < text_length:
        end = min(start + chunk_size, text_length)
        chunk_content = text[start:end]

        # 只保存非空chunk
        if chunk_content.strip():
            chunks.append({
                'start': start,
                'end': end,
                'content': chunk_content,
                'char_count': len(chunk_content)
            })

        # 移动窗口（chunk_size - overlap）
        start += (chunk_size - overlap)

        # 如果下一个起点已经超过文本长度，停止
        if start >= text_length:
            break

    return chunks


def chunk_documents(config, dry_run=False):
    """
    将Markdown文档分块

    Args:
        config: 配置字典
        dry_run: 是否干运行

    Returns:
        分块统计信息
    """
    print("📋 Chunk: Markdown → 固定大小chunks")

    input_dir = config['paths']['processed'] / 'raw_md'
    output_dir = config['paths']['processed'] / 'chunks'

    # 获取所有Markdown文件
    md_files = list(input_dir.rglob('*.md'))
    print(f"   Found {len(md_files)} markdown files")

    if len(md_files) == 0:
        print("   ⚠️  No markdown files to process")
        return {"files_found": 0, "files_processed": 0, "chunks_created": 0}

    if dry_run:
        print("   [DRY RUN] Would chunk documents")
        print(f"   Output directory: {output_dir}")
        print(f"   Chunk size: {config['processing']['chunk_size']}")
        print(f"   Overlap: {config['processing']['chunk_overlap']}")
        # 显示前5个文件作为示例
        for f in md_files[:5]:
            rel_path = f.relative_to(input_dir)
            print(f"     - {rel_path}")
        if len(md_files) > 5:
            print(f"     ... and {len(md_files) - 5} more files")
        return {
            "files_found": len(md_files),
            "files_processed": 0,
            "chunks_created": 0
        }

    # 创建输出目录
    output_dir.mkdir(parents=True, exist_ok=True)

    # 统计
    total_chunks = 0
    processed_count = 0
    skipped_count = 0
    failed_count = 0

    # 处理每个文件
    for i, md_file in enumerate(md_files, 1):
        try:
            # 计算相对路径
            rel_path = md_file.relative_to(input_dir)

            # 输出文件路径（保持目录结构）
            output_file = output_dir / rel_path.parent / f"{md_file.stem}_chunks.json"

            # 如果已存在，跳过
            if output_file.exists():
                skipped_count += 1
                if i <= 10 or i % 100 == 0:  # 只显示前10个和每100个
                    print(f"   [{i}/{len(md_files)}] Skipped (exists): {rel_path}")
                continue

            # 读取内容
            content = md_file.read_text(encoding='utf-8', errors='ignore')

            # 分块
            chunks = chunk_text(
                content,
                chunk_size=config['processing']['chunk_size'],
                overlap=config['processing']['chunk_overlap']
            )

            if len(chunks) == 0:
                skipped_count += 1
                if i <= 10 or i % 100 == 0:
                    print(f"   [{i}/{len(md_files)}] Skipped (empty): {rel_path}")
                continue

            # 创建输出目录
            output_file.parent.mkdir(parents=True, exist_ok=True)

            # 保存chunks JSON
            chunk_data = {
                'source_file': str(md_file),
                'chunk_count': len(chunks),
                'total_chars': len(content),
                'chunks': chunks
            }

            output_file.write_text(
                json.dumps(chunk_data, indent=2, ensure_ascii=False),
                encoding='utf-8'
            )

            total_chunks += len(chunks)
            processed_count += 1

            if i <= 10 or i % 100 == 0:
                print(f"   [{i}/{len(md_files)}] ✅ {rel_path} → {len(chunks)} chunks")

        except Exception as e:
            failed_count += 1
            if i <= 10 or i % 100 == 0:
                print(f"   [{i}/{len(md_files)}] ❌ {md_file.name}: {e}")

    # 总结
    print(f"\n   ✅ Chunking complete:")
    print(f"      Files found: {len(md_files)}")
    print(f"      Processed: {processed_count}")
    print(f"      Skipped: {skipped_count}")
    print(f"      Failed: {failed_count}")
    print(f"      Total chunks: {total_chunks}")

    return {
        "files_found": len(md_files),
        "files_processed": processed_count,
        "files_skipped": skipped_count,
        "files_failed": failed_count,
        "chunks_created": total_chunks
    }


if __name__ == "__main__":
    # 测试代码
    from pathlib import Path

    print("Testing chunk module...")

    # 测试1: chunk_text函数
    print("\n1. Testing chunk_text function:")
    test_text = "这是一个测试文本。" * 100  # 约800字符
    chunks = chunk_text(test_text, chunk_size=200, overlap=50)
    print(f"   Text length: {len(test_text)}")
    print(f"   Chunks created: {len(chunks)}")
    if chunks:
        print(f"   First chunk: {chunks[0]['start']}-{chunks[0]['end']} ({chunks[0]['char_count']} chars)")
        print(f"   Last chunk: {chunks[-1]['start']}-{chunks[-1]['end']} ({chunks[-1]['char_count']} chars)")

    # 测试2: chunk_documents函数（dry run）
    print("\n2. Testing chunk_documents function (dry run):")
    test_config = {
        'paths': {
            'processed': Path.home() / 'data/processed/shengcai'
        },
        'processing': {
            'chunk_size': 600,
            'chunk_overlap': 100
        }
    }
    chunk_documents(test_config, dry_run=True)
