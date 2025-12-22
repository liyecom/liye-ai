#!/usr/bin/env python3
"""
重新索引失败的文件
专门处理之前索引失败的知识源
"""

import sys
from pathlib import Path

# 添加项目路径
project_dir = Path(__file__).parent.parent
sys.path.insert(0, str(project_dir))

from build_global_index import GlobalIndexBuilder

def main():
    """重新索引失败率高的 collections"""

    print("\n" + "="*60)
    print("🔄 重新索引失败的文件")
    print("="*60 + "\n")

    builder = GlobalIndexBuilder()

    # 定义需要重新索引的源（失败率高的）
    sources_to_reindex = [
        {
            'name': 'shengcai_library',
            'path': Path.home() / 'Documents/生财有术',
            'description': '生财有术创业财商知识库（重新索引）'
        },
        {
            'name': 'medical_resources',
            'path': Path.home() / 'Documents/癌症领域',
            'description': '医疗健康资源（重新索引）'
        }
    ]

    for source in sources_to_reindex:
        try:
            builder.index_source(source)
        except Exception as e:
            print(f"\n✗ Failed to reindex {source['name']}: {e}")
            print("Continuing with next source...\n")

    # 最终统计
    print("\n" + "="*60)
    print("✅ 重新索引完成！")
    print("="*60 + "\n")

    collections = builder.qdrant.get_collections().collections
    print("最终 Collections 统计:")
    for coll in sorted(collections, key=lambda c: c.name):
        info = builder.qdrant.get_collection(coll.name)
        print(f"  - {coll.name}: {info.points_count} chunks")

if __name__ == "__main__":
    main()
