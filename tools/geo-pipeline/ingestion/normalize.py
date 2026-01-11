"""
GEO OS - Normalize Module
标准化模块：将各类文档转为Markdown

职责：
- 使用MarkItDown转换多种文件格式
- 处理 PDF, DOCX, PPTX, XLSX 等
- 输出标准化的Markdown

支持格式：
- PDF (.pdf)
- Word (.docx)
- PowerPoint (.pptx)
- Excel (.xlsx)
- HTML (.html)
- Text (.txt, .md)
"""

from pathlib import Path


def convert_to_markdown(file_path):
    """
    将文件转换为Markdown

    Args:
        file_path: 文件路径（Path对象或字符串）

    Returns:
        str: Markdown内容，如果失败返回None
    """
    file_path = Path(file_path)

    # 获取文件扩展名
    ext = file_path.suffix.lower()

    # 支持的格式
    supported_formats = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.htm']
    text_formats = ['.txt', '.md', '.markdown']

    try:
        # 如果是纯文本格式，直接读取
        if ext in text_formats:
            return file_path.read_text(encoding='utf-8', errors='ignore')

        # 如果是支持的格式，使用MarkItDown
        if ext in supported_formats:
            try:
                from markitdown import MarkItDown
                md = MarkItDown()
                result = md.convert(str(file_path))

                if result and result.text_content:
                    return result.text_content
                else:
                    return None
            except ImportError:
                print(f"   ⚠️  MarkItDown not installed, skipping {file_path.name}")
                return None

        # 不支持的格式
        return None

    except Exception as e:
        print(f"   ⚠️  Error converting {file_path.name}: {e}")
        return None


def get_supported_files(source_dir):
    """
    获取目录中所有支持的文件

    Args:
        source_dir: 源目录路径

    Returns:
        list: 支持的文件路径列表
    """
    supported_exts = {'.pdf', '.docx', '.pptx', '.xlsx', '.html', '.htm', '.txt', '.md', '.markdown'}

    all_files = []
    for file_path in Path(source_dir).rglob('*'):
        if file_path.is_file() and file_path.suffix.lower() in supported_exts:
            all_files.append(file_path)

    return all_files


def normalize(config, dry_run=False):
    """
    将各类文档转为Markdown

    Args:
        config: 配置字典
        dry_run: 是否干运行

    Returns:
        转换统计信息
    """
    print("📋 Normalize: 各类文档 → Markdown")

    source_dir = config['paths']['source']
    output_dir = config['paths']['processed'] / 'raw_md'

    # 获取所有支持的文件
    files_to_process = get_supported_files(source_dir)

    print(f"   Found {len(files_to_process)} files")

    if len(files_to_process) == 0:
        print("   ⚠️  No files to process")
        return {"files_found": 0, "files_processed": 0, "files_skipped": 0, "files_failed": 0}

    if dry_run:
        print("   [DRY RUN] Would convert files to Markdown")
        print(f"   Output directory: {output_dir}")
        # 显示前5个文件作为示例
        for f in files_to_process[:5]:
            rel_path = f.relative_to(source_dir)
            print(f"     - {rel_path}")
        if len(files_to_process) > 5:
            print(f"     ... and {len(files_to_process) - 5} more files")
        return {
            "files_found": len(files_to_process),
            "files_processed": 0,
            "files_skipped": 0,
            "files_failed": 0
        }

    # 创建输出目录
    output_dir.mkdir(parents=True, exist_ok=True)

    # 统计
    converted_count = 0
    skipped_count = 0
    failed_count = 0

    # 处理每个文件
    for i, file_path in enumerate(files_to_process, 1):
        try:
            # 计算相对路径
            rel_path = file_path.relative_to(source_dir)

            # 输出文件路径（保持目录结构）
            output_file = output_dir / rel_path.parent / f"{file_path.stem}.md"

            # 如果已存在，跳过
            if output_file.exists():
                skipped_count += 1
                if i <= 10 or i % 100 == 0:  # 只显示前10个和每100个
                    print(f"   [{i}/{len(files_to_process)}] Skipped (exists): {rel_path}")
                continue

            # 转换
            md_content = convert_to_markdown(file_path)

            if md_content is None:
                failed_count += 1
                if i <= 10 or i % 100 == 0:
                    print(f"   [{i}/{len(files_to_process)}] Failed: {rel_path}")
                continue

            # 创建输出目录
            output_file.parent.mkdir(parents=True, exist_ok=True)

            # 写入
            output_file.write_text(md_content, encoding='utf-8')
            converted_count += 1

            if i <= 10 or i % 100 == 0:
                print(f"   [{i}/{len(files_to_process)}] ✅ {rel_path} → {output_file.name}")

        except Exception as e:
            failed_count += 1
            if i <= 10 or i % 100 == 0:
                print(f"   [{i}/{len(files_to_process)}] ❌ {file_path.name}: {e}")

    # 总结
    print(f"\n   ✅ Conversion complete:")
    print(f"      Files found: {len(files_to_process)}")
    print(f"      Converted: {converted_count}")
    print(f"      Skipped: {skipped_count}")
    print(f"      Failed: {failed_count}")

    return {
        "files_found": len(files_to_process),
        "files_processed": converted_count,
        "files_skipped": skipped_count,
        "files_failed": failed_count
    }


if __name__ == "__main__":
    # 测试代码
    from pathlib import Path

    print("Testing normalize module...")
    test_config = {
        'paths': {
            'source': Path.home() / 'data/archives/shengcai',
            'processed': Path.home() / 'data/processed/shengcai'
        }
    }
    normalize(test_config, dry_run=True)
