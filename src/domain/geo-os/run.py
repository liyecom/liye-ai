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
from datetime import datetime, timedelta
import sys

from ingestion.normalize import normalize
from processing.chunk import chunk_documents
from processing.extract import extract_structure
from outputs.export_json import export_units


# ============================================================
# Tier Guard - Prevent Cross-Tier Misuse
# ============================================================

class TierGuardError(Exception):
    """Raised when tier guard rules are violated"""
    pass


class TierGuard:
    """
    Enforces Truth Source Tier rules before processing.
    Fail-fast: any violation immediately terminates execution.
    """

    def __init__(self, config):
        self.enabled = config.get('tier_guard', {}).get('enabled', False)
        self.rules = config.get('tier_guard', {}).get('rules', {})

    def check(self, source_name, source_cfg, args):
        """
        Check if source can be processed under current args.

        Args:
            source_name: Source identifier
            source_cfg: Source configuration dict
            args: Command line arguments

        Raises:
            TierGuardError: If any tier rule is violated
        """
        if not self.enabled:
            return

        tier = source_cfg.get('tier')
        if not tier:
            raise TierGuardError(
                f"[TierGuard] Source '{source_name}' has no tier defined. "
                f"All sources MUST have explicit tier: T0/T1/T2"
            )

        rule = self.rules.get(tier)
        if not rule:
            raise TierGuardError(
                f"[TierGuard] No guard rules defined for tier {tier}"
            )

        # Default run protection (no --source specified)
        if not rule.get('allow_default_run', False) and not args.source:
            raise TierGuardError(
                f"[TierGuard] Tier {tier} source '{source_name}' "
                f"cannot be processed by default run. Use --source {source_name}"
            )

        # RAG protection (future)
        if getattr(args, 'rag', False) and not rule.get('allow_rag', False):
            raise TierGuardError(
                f"[TierGuard] Tier {tier} source '{source_name}' "
                f"is forbidden from RAG usage"
            )

        # Export protection
        if getattr(args, 'export', True) and not rule.get('allow_export', False):
            raise TierGuardError(
                f"[TierGuard] Tier {tier} source '{source_name}' "
                f"is forbidden from export"
            )


def load_tier_guard_config():
    """
    Load tier guard configuration from config.yaml

    Returns:
        Tier guard config dict
    """
    config_path = Path(__file__).parent / 'config.yaml'
    if config_path.exists():
        with open(config_path) as f:
            return yaml.safe_load(f)
    return {}


# ============================================================
# T1 Metadata Validation (Decay & Review Guard)
# ============================================================

def validate_t1_metadata(unit):
    """
    Validate that a T1 unit has all required metadata fields.

    Args:
        unit: A knowledge unit dict with 'id' and 'metadata'

    Raises:
        TierGuardError: If any required field is missing or invalid
    """
    required_fields = [
        "confidence_level",
        "source_provenance",
        "promotion",
        "review",
        "decay",
    ]

    metadata = unit.get("metadata", {})

    for field in required_fields:
        if field not in metadata:
            raise TierGuardError(
                f"[TierGuard] T1 unit '{unit.get('id')}' missing required metadata field: {field}"
            )

    # Validate decay configuration
    decay = metadata.get("decay", {})
    if decay.get("decay_after_days", 0) <= 0:
        raise TierGuardError(
            f"[TierGuard] T1 unit '{unit.get('id')}' has invalid decay_after_days"
        )

    # Validate confidence_level
    valid_confidence = ["high", "medium", "low"]
    if metadata.get("confidence_level") not in valid_confidence:
        raise TierGuardError(
            f"[TierGuard] T1 unit '{unit.get('id')}' has invalid confidence_level"
        )


def is_t1_expired(unit):
    """
    Check if a T1 unit has expired based on its decay policy.

    Args:
        unit: A knowledge unit dict with metadata

    Returns:
        True if the unit has expired and needs review/demotion
    """
    metadata = unit.get("metadata", {})
    decay = metadata.get("decay", {})
    promotion = metadata.get("promotion", {})

    promoted_at_str = promotion.get("promoted_at")
    if not promoted_at_str:
        return True  # No promotion date = expired

    try:
        promoted_at = datetime.fromisoformat(promoted_at_str.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return True  # Invalid date = expired

    decay_days = decay.get("decay_after_days", 90)  # Default 90 days

    # Make both datetimes naive for comparison
    now = datetime.utcnow()
    if promoted_at.tzinfo is not None:
        promoted_at = promoted_at.replace(tzinfo=None)

    return now > promoted_at + timedelta(days=decay_days)


def check_t1_units(units):
    """
    Validate all T1 units before export/RAG usage.

    Args:
        units: List of knowledge units

    Raises:
        TierGuardError: If any T1 unit fails validation
    """
    for unit in units:
        if unit.get("tier") == "T1" or unit.get("metadata", {}).get("tier") == "T1":
            validate_t1_metadata(unit)
            if is_t1_expired(unit):
                raise TierGuardError(
                    f"[TierGuard] T1 unit '{unit.get('id')}' expired and must be reviewed or demoted"
                )


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
            tier = source_config.get('tier', '?')
            print(f"  [{tier}] {source_id}")
            print(f"      Name: {source_config.get('name', 'N/A')}")
            print(f"      Path: {source_config.get('path', 'N/A')}")
            print(f"      Size: {source_config.get('estimated_size', 'unknown')}")
            print()

    print("\n❌ Disabled Sources:")
    print("-" * 40)
    for source_id, source_config in sorted(sources.items(), key=lambda x: x[1].get('priority', 99)):
        if not source_config.get('enabled', False):
            tier = source_config.get('tier', '?')
            print(f"  [{tier}] {source_id}")
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

    # 加载 Tier Guard 配置
    tier_guard_config = load_tier_guard_config()
    guard = TierGuard(tier_guard_config)

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
    print(f"TierGuard: {'ENABLED' if guard.enabled else 'disabled'}")

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

            # === Tier Guard Check (fail-fast) ===
            source_cfg = raw_config.get('sources', {}).get(source_id, {})
            guard.check(source_id, source_cfg, args)

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
