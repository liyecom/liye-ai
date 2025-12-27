#!/usr/bin/env python3
"""
GEO OS v0.1 - Main Entry Point
知识引擎主入口

Usage:
    python run.py                    # 处理默认数据源
    python run.py --dry-run          # 干运行模式
    python run.py --source sample    # 指定数据源
"""

import argparse
import yaml
from pathlib import Path
from datetime import datetime
import sys

from ingestion.normalize import normalize
from processing.chunk import chunk_documents
from processing.extract import extract_structure
from outputs.export_json import export_units


def load_config(source_name='shengcai'):
    """
    加载配置文件

    Args:
        source_name: 数据源名称

    Returns:
        配置字典
    """
    config_path = Path(__file__).parent / 'config/geo.yaml'

    with open(config_path) as f:
        config = yaml.safe_load(f)

    # 展开路径，替换 ~ 为用户主目录，替换 {source} 占位符
    for key in ['source', 'processed', 'exports', 'logs']:
        path_str = config['paths'][key]
        # 替换数据源名称占位符（支持两种格式）
        path_str = path_str.replace('{source}', source_name)
        path_str = path_str.replace('shengcai', source_name)
        config['paths'][key] = Path(path_str).expanduser()

    return config


def setup_logging(config):
    """
    设置日志

    Args:
        config: 配置字典

    Returns:
        日志文件路径
    """
    log_file = config['paths']['logs'] / f"geo_run_{datetime.now():%Y%m%d_%H%M%S}.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    # 简单日志：将输出同时写入文件（可选，暂时不实现复杂日志）
    return log_file


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='GEO OS v0.1 - Knowledge Engine')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode (不实际执行)')
    parser.add_argument('--source', default='shengcai', help='Source name (数据源名称)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    args = parser.parse_args()

    print("=" * 60)
    print("GEO OS v0.1 - Knowledge Engine")
    print("=" * 60)
    print(f"Source: {args.source}")
    print(f"Dry run: {args.dry_run}")
    print(f"Verbose: {args.verbose}")
    print()

    # 加载配置
    try:
        config = load_config(args.source)
        log_file = setup_logging(config)
        print(f"📝 Config loaded: {config['paths']['source']}")
        print(f"📝 Log file: {log_file}")
        print()
    except Exception as e:
        print(f"❌ Error loading config: {e}")
        sys.exit(1)

    # 执行pipeline
    start_time = datetime.now()
    results = {}

    try:
        # Step 1: Normalize
        print("\n" + "=" * 60)
        print("Step 1/4: Normalizing documents")
        print("=" * 60)
        results['normalize'] = normalize(config, dry_run=args.dry_run)

        # Step 2: Chunk
        print("\n" + "=" * 60)
        print("Step 2/4: Chunking documents")
        print("=" * 60)
        results['chunk'] = chunk_documents(config, dry_run=args.dry_run)

        # Step 3: Extract
        print("\n" + "=" * 60)
        print("Step 3/4: Extracting structure")
        print("=" * 60)
        results['extract'] = extract_structure(config, dry_run=args.dry_run)

        # Step 4: Export
        print("\n" + "=" * 60)
        print("Step 4/4: Exporting to JSON")
        print("=" * 60)
        results['export'] = export_units(config, dry_run=args.dry_run)

        # 总结
        elapsed = datetime.now() - start_time
        print("\n" + "=" * 60)
        print("✅ GEO OS Pipeline Completed Successfully")
        print("=" * 60)
        print(f"⏱️  Total time: {elapsed.total_seconds():.1f} seconds")
        print()
        print("📊 Results Summary:")

        if 'normalize' in results:
            norm = results['normalize']
            print(f"   Normalize:")
            print(f"      Files found: {norm.get('files_found', 0)}")
            print(f"      Processed: {norm.get('files_processed', 0)}")
            print(f"      Skipped: {norm.get('files_skipped', 0)}")
            print(f"      Failed: {norm.get('files_failed', 0)}")

        if 'chunk' in results:
            chunk = results['chunk']
            print(f"   Chunk:")
            print(f"      Files found: {chunk.get('files_found', 0)}")
            print(f"      Chunks created: {chunk.get('chunks_created', 0)}")

        if 'extract' in results:
            extract = results['extract']
            print(f"   Extract:")
            print(f"      Units created: {extract.get('units_created', 0)}")
            print(f"      With headings: {extract.get('units_with_headings', 0)}")
            print(f"      With bullets: {extract.get('units_with_bullets', 0)}")

        if 'export' in results:
            export = results['export']
            print(f"   Export:")
            print(f"      Units exported: {export.get('units_exported', 0)}")
            print(f"      File size: {export.get('file_size_mb', 0):.2f} MB")
            print(f"      Output: {export.get('output_file', 'N/A')}")

    except Exception as e:
        print(f"\n❌ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
