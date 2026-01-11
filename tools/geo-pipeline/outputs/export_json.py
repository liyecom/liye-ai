"""
GEO OS - Export Module
导出模块：将所有units导出为单个JSON文件

职责：
- 收集所有unit文件
- 生成统一的JSON输出
- 创建latest软链接
- 输出系统可消费的geo_units.json
"""

import json
from pathlib import Path
from datetime import datetime


def export_units(config, dry_run=False):
    """
    导出所有units为单个JSON

    Args:
        config: 配置字典
        dry_run: 是否干运行

    Returns:
        导出统计信息
    """
    print("📋 Export: 输出geo_units.json")

    input_dir = config['paths']['processed'] / 'units'
    exports_dir = config['paths']['exports']
    output_file = exports_dir / 'geo_units_v0.1.json'

    # 获取所有unit文件
    unit_files = sorted(input_dir.glob('unit_*.json'))
    print(f"   Found {len(unit_files)} unit files")

    if len(unit_files) == 0:
        print("   ⚠️  No unit files to export")
        return {"units_found": 0, "units_exported": 0}

    if dry_run:
        print("   [DRY RUN] Would export to JSON")
        print(f"   Output file: {output_file}")
        print(f"   Pretty print: {config['output']['pretty_print']}")
        print(f"   Create symlink: {config['output']['create_latest_symlink']}")
        print(f"   First 5 units:")
        for f in unit_files[:5]:
            print(f"     - {f.name}")
        if len(unit_files) > 5:
            print(f"     ... and {len(unit_files) - 5} more units")
        return {
            "units_found": len(unit_files),
            "units_exported": 0
        }

    # 创建输出目录
    exports_dir.mkdir(parents=True, exist_ok=True)

    # 收集所有units
    print("   Collecting units...")
    units = []
    failed_count = 0

    for i, unit_file in enumerate(unit_files, 1):
        try:
            unit = json.loads(unit_file.read_text(encoding='utf-8'))
            units.append(unit)

            if i % 100 == 0 or i == len(unit_files):
                print(f"   [{i}/{len(unit_files)}] Loaded units...")

        except Exception as e:
            failed_count += 1
            print(f"   ⚠️  Failed to load {unit_file.name}: {e}")

    # 构建最终JSON
    export_data = {
        'version': '0.1.0',
        'source': str(config['paths']['source']),
        'processed_at': datetime.now().isoformat(),
        'unit_count': len(units),
        'units': units
    }

    # 写入JSON
    print("   Writing JSON...")
    if config['output']['pretty_print']:
        json_str = json.dumps(export_data, indent=2, ensure_ascii=False)
    else:
        json_str = json.dumps(export_data, ensure_ascii=False)

    output_file.write_text(json_str, encoding='utf-8')

    # 获取文件大小
    file_size = output_file.stat().st_size / (1024 * 1024)  # MB

    # 创建latest软链接
    if config['output']['create_latest_symlink']:
        latest_link = exports_dir / 'geo_units_latest.json'
        # 删除旧的软链接（如果存在）
        if latest_link.exists() or latest_link.is_symlink():
            latest_link.unlink()
        # 创建新的软链接
        latest_link.symlink_to(output_file.name)
        print(f"   ✅ Created symlink: {latest_link.name} → {output_file.name}")

    # 总结
    print(f"\n   ✅ Export complete:")
    print(f"      Units exported: {len(units)}")
    print(f"      Failed: {failed_count}")
    print(f"      Output file: {output_file}")
    print(f"      File size: {file_size:.2f} MB")

    return {
        "units_found": len(unit_files),
        "units_exported": len(units),
        "units_failed": failed_count,
        "output_file": str(output_file),
        "file_size_mb": file_size
    }


if __name__ == "__main__":
    # 测试代码
    from pathlib import Path

    print("Testing export module...")

    test_config = {
        'paths': {
            'source': Path.home() / 'data/archives/shengcai',
            'processed': Path.home() / 'data/processed/shengcai',
            'exports': Path.home() / 'data/exports/shengcai'
        },
        'output': {
            'pretty_print': True,
            'create_latest_symlink': True
        }
    }

    export_units(test_config, dry_run=True)
