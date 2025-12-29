#!/usr/bin/env python3
"""
GEO OS v0.1 - Main Entry Point
知识引擎主入口 - 支持多数据源

Usage:
    python run.py                    # 处理所有启用的数据源
    python run.py --source geo_seo   # 只处理指定数据源
    python run.py --dry-run          # 干运行模式
    python run.py --list-sources     # 列出所有数据源
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


def load_raw_config():
    """
    加载原始配置文件

    Returns:
        原始配置字典
    """
    config_path = Path(__file__).parent / 'config/geo.yaml'

    with open(config_path) as f:
        return yaml.safe_load(f)


def get_enabled_sources(raw_config):
    """
    获取所有启用的数据源列表

    Args:
        raw_config: 原始配置

    Returns:
        启用的数据源列表，按优先级排序
    """
    sources = raw_config.get('sources', {})
    enabled = []

    for source_id, source_config in sources.items():
        if source_config.get('enabled', False):
            enabled.append({
                'id': source_id,
                'name': source_config.get('name', source_id),
                'path': source_config.get('path', ''),
                'priority': source_config.get('priority', 99),
                'description': source_config.get('description', ''),
                'estimated_size': source_config.get('estimated_size', 'unknown')
            })

    # 按优先级排序
    enabled.sort(key=lambda x: x['priority'])
    return enabled


def load_config_for_source(raw_config, source_id):
    """
    为指定数据源加载配置

    Args:
        raw_config: 原始配置
        source_id: 数据源ID

    Returns:
        配置字典（包含展开的路径）
    """
    config = raw_config.copy()

    # 获取源配置
    source_config = raw_config.get('sources', {}).get(source_id, {})
    if not source_config:
        raise ValueError(f"Unknown source: {source_id}")

    # 构建路径
    paths = raw_config.get('paths', {})
    config['paths'] = {
        'source': Path(source_config.get('path', paths.get('source_template', '').replace('{source}', source_id))).expanduser(),
        'processed': Path(paths.get('processed_template', '~/data/processed/{source}').replace('{source}', source_id)).expanduser(),
        'exports': Path(paths.get('exports_template', '~/data/exports/{source}').replace('{source}', source_id)).expanduser(),
        'logs': Path(paths.get('logs', '~/github/liye_os/_meta/logs/geo-os')).expanduser(),
        'merged_exports': Path(paths.get('merged_exports', '~/data/exports/_merged')).expanduser()
    }

    # 添加源信息
    config['current_source'] = {
        'id': source_id,
        'name': source_config.get('name', source_id),
        'description': source_config.get('description', '')
    }

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
    return log_file


def process_source(config, source_id, dry_run=False, verbose=False):
    """
    处理单个数据源

    Args:
        config: 配置字典
        source_id: 数据源ID
        dry_run: 是否干运行
        verbose: 是否详细输出

    Returns:
        处理结果字典
    """
    results = {}

    print(f"\n{'='*60}")
    print(f"Processing Source: {source_id}")
    print(f"Path: {config['paths']['source']}")
    print(f"{'='*60}")

    # Step 1: Normalize
    print("\n  Step 1/4: Normalizing documents")
    print("  " + "-" * 40)
    results['normalize'] = normalize(config, dry_run=dry_run)

    # Step 2: Chunk
    print("\n  Step 2/4: Chunking documents")
    print("  " + "-" * 40)
    results['chunk'] = chunk_documents(config, dry_run=dry_run)

    # Step 3: Extract
    print("\n  Step 3/4: Extracting structure")
    print("  " + "-" * 40)
    results['extract'] = extract_structure(config, dry_run=dry_run)

    # Step 4: Export
    print("\n  Step 4/4: Exporting to JSON")
    print("  " + "-" * 40)
    results['export'] = export_units(config, dry_run=dry_run)

    return results


def print_source_summary(source_id, results):
    """打印单个数据源的处理总结"""
    print(f"\n  📊 {source_id} Summary:")

    if 'normalize' in results:
        norm = results['normalize']
        print(f"     Normalize: {norm.get('files_processed', 0)} files")

    if 'chunk' in results:
        chunk = results['chunk']
        print(f"     Chunks: {chunk.get('chunks_created', 0)} created")

    if 'extract' in results:
        extract = results['extract']
        print(f"     Units: {extract.get('units_created', 0)} created")

    if 'export' in results:
        export = results['export']
        print(f"     Export: {export.get('file_size_mb', 0):.2f} MB")


def list_sources(raw_config):
    """列出所有数据源"""
    print("\n" + "=" * 60)
    print("GEO OS - Available Truth Sources")
    print("=" * 60)

    sources = raw_config.get('sources', {})

    print("\n✅ Enabled Sources:")
    print("-" * 40)
    for source_id, source_config in sorted(sources.items(), key=lambda x: x[1].get('priority', 99)):
        if source_config.get('enabled', False):
            print(f"  [{source_config.get('priority', '?')}] {source_id}")
            print(f"      Name: {source_config.get('name', 'N/A')}")
            print(f"      Path: {source_config.get('path', 'N/A')}")
            print(f"      Size: {source_config.get('estimated_size', 'unknown')}")
            print()

    print("\n❌ Disabled Sources:")
    print("-" * 40)
    for source_id, source_config in sorted(sources.items(), key=lambda x: x[1].get('priority', 99)):
        if not source_config.get('enabled', False):
            print(f"  [{source_config.get('priority', '?')}] {source_id}")
            print(f"      Name: {source_config.get('name', 'N/A')}")
            print()


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='GEO OS v0.1 - Knowledge Engine (Multi-Source)')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode (不实际执行)')
    parser.add_argument('--source', default=None, help='Process specific source only (默认处理所有启用的源)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--list-sources', action='store_true', help='List all available sources')
    args = parser.parse_args()

    # 加载原始配置
    try:
        raw_config = load_raw_config()
    except Exception as e:
        print(f"❌ Error loading config: {e}")
        sys.exit(1)

    # 列出数据源
    if args.list_sources:
        list_sources(raw_config)
        sys.exit(0)

    # 确定要处理的数据源
    if args.source:
        sources_to_process = [{'id': args.source}]
    else:
        sources_to_process = get_enabled_sources(raw_config)

    if not sources_to_process:
        print("❌ No sources to process. Check config/geo.yaml")
        sys.exit(1)

    # 打印启动信息
    print("=" * 60)
    print("GEO OS v0.1 - Knowledge Engine")
    print("=" * 60)
    print(f"Mode: {'Single Source' if args.source else 'All Enabled Sources'}")
    print(f"Sources: {', '.join([s['id'] for s in sources_to_process])}")
    print(f"Dry run: {args.dry_run}")
    print(f"Verbose: {args.verbose}")

    # 设置日志
    try:
        first_config = load_config_for_source(raw_config, sources_to_process[0]['id'])
        log_file = setup_logging(first_config)
        print(f"📝 Log file: {log_file}")
    except Exception as e:
        print(f"❌ Error setting up logging: {e}")
        sys.exit(1)

    # 执行 pipeline
    start_time = datetime.now()
    all_results = {}

    try:
        for source_info in sources_to_process:
            source_id = source_info['id']
            config = load_config_for_source(raw_config, source_id)
            results = process_source(config, source_id, dry_run=args.dry_run, verbose=args.verbose)
            all_results[source_id] = results
            print_source_summary(source_id, results)

        # 总结
        elapsed = datetime.now() - start_time
        print("\n" + "=" * 60)
        print("✅ GEO OS Pipeline Completed Successfully")
        print("=" * 60)
        print(f"⏱️  Total time: {elapsed.total_seconds():.1f} seconds")
        print(f"📦 Sources processed: {len(all_results)}")

        # 汇总统计
        total_units = sum(
            r.get('extract', {}).get('units_created', 0)
            for r in all_results.values()
        )
        total_size = sum(
            r.get('export', {}).get('file_size_mb', 0)
            for r in all_results.values()
        )
        print(f"📊 Total units: {total_units}")
        print(f"💾 Total size: {total_size:.2f} MB")

    except Exception as e:
        print(f"\n❌ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
