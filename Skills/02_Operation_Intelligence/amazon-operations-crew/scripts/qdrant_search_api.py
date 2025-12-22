#!/usr/bin/env python3
"""
Qdrant 语义搜索 API
为 Obsidian 提供跨 collection 语义搜索接口
"""

import sys
from pathlib import Path
from typing import List, Dict, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS

# 添加项目路径
project_dir = Path(__file__).parent.parent
sys.path.insert(0, str(project_dir))

from qdrant_client import QdrantClient
from tools.simple_embedder import SimpleEmbedder

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 全局初始化
qdrant_client = None
embedder = None

# 所有可用的 collections
AVAILABLE_COLLECTIONS = [
    'amazon_knowledge_base',
    'crossborder_ecommerce',
    'liye_os_skills',
    'para_areas',
    'shengcai_library',
    'medical_resources'
]


def init_services():
    """初始化服务"""
    global qdrant_client, embedder

    if qdrant_client is None:
        print("🔄 正在初始化 Qdrant 客户端...")
        qdrant_client = QdrantClient(url="http://localhost:6333")
        print("✓ Qdrant 客户端已连接")

    if embedder is None:
        print("🔄 正在加载 Embedding 模型...")
        embedder = SimpleEmbedder(model_name="all-MiniLM-L6-v2")
        print("✓ Embedding 模型已加载")


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    try:
        init_services()
        collections = qdrant_client.get_collections().collections
        return jsonify({
            'status': 'healthy',
            'collections': len(collections),
            'embedding_ready': embedder is not None
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500


@app.route('/collections', methods=['GET'])
def list_collections():
    """列出所有可用的 collections"""
    try:
        init_services()
        collections = qdrant_client.get_collections().collections

        result = []
        for coll in collections:
            info = qdrant_client.get_collection(coll.name)
            result.append({
                'name': coll.name,
                'points_count': info.points_count,
                'status': info.status
            })

        return jsonify({
            'collections': result,
            'total': len(result)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/search', methods=['POST'])
def semantic_search():
    """
    语义搜索 API

    请求体:
    {
        "query": "搜索关键词",
        "collections": ["liye_os_skills", "amazon_knowledge_base"],  // 可选
        "limit": 5  // 可选，默认 5
    }

    响应:
    {
        "query": "...",
        "results": [
            {
                "source": "collection_name",
                "file_path": "relative/path/to/file.md",
                "score": 0.95,
                "text": "匹配的文本片段...",
                "chunk_type": "section",
                "full_path": "/absolute/path/to/file.md"
            },
            ...
        ],
        "total": 5
    }
    """
    try:
        init_services()

        # 解析请求
        data = request.get_json()
        query = data.get('query')
        collections = data.get('collections', AVAILABLE_COLLECTIONS)
        limit_per_collection = data.get('limit', 5)

        if not query:
            return jsonify({'error': 'Missing query parameter'}), 400

        # 生成查询向量
        query_vector = embedder.embed_text(query)

        # 跨 collection 搜索
        all_results = []

        for collection_name in collections:
            if collection_name not in AVAILABLE_COLLECTIONS:
                continue

            try:
                response = qdrant_client.query_points(
                    collection_name=collection_name,
                    query=query_vector,
                    limit=limit_per_collection,
                    with_payload=True
                )

                for result in response.points:
                    all_results.append({
                        'source': collection_name,
                        'file_path': result.payload.get('file_path', ''),
                        'full_path': result.payload.get('full_path', ''),
                        'score': float(result.score),
                        'text': result.payload.get('text', ''),
                        'chunk_type': result.payload.get('chunk_type', 'unknown'),
                        'chunk_id': result.payload.get('chunk_id', ''),
                        'text_length': result.payload.get('text_length', 0)
                    })

            except Exception as e:
                print(f"⚠️  Error searching {collection_name}: {e}")
                continue

        # 按相关度排序
        all_results.sort(key=lambda x: x['score'], reverse=True)

        # 返回结果
        return jsonify({
            'query': query,
            'results': all_results[:limit_per_collection * 2],  # 最多返回 2 倍 limit
            'total': len(all_results),
            'searched_collections': collections
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/search/by-source', methods=['POST'])
def search_by_source():
    """
    按知识源搜索

    请求体:
    {
        "query": "搜索关键词",
        "source": "liye_os_skills",  // 单个 collection
        "limit": 10
    }
    """
    try:
        init_services()

        data = request.get_json()
        query = data.get('query')
        source = data.get('source')
        limit = data.get('limit', 10)

        if not query or not source:
            return jsonify({'error': 'Missing query or source parameter'}), 400

        if source not in AVAILABLE_COLLECTIONS:
            return jsonify({'error': f'Invalid source: {source}'}), 400

        # 生成查询向量
        query_vector = embedder.embed_text(query)

        # 搜索
        response = qdrant_client.query_points(
            collection_name=source,
            query=query_vector,
            limit=limit,
            with_payload=True
        )

        results = []
        for result in response.points:
            results.append({
                'file_path': result.payload.get('file_path', ''),
                'full_path': result.payload.get('full_path', ''),
                'score': float(result.score),
                'text': result.payload.get('text', ''),
                'chunk_type': result.payload.get('chunk_type', 'unknown')
            })

        return jsonify({
            'query': query,
            'source': source,
            'results': results,
            'total': len(results)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/stats', methods=['GET'])
def get_stats():
    """获取索引统计信息"""
    try:
        init_services()

        collections = qdrant_client.get_collections().collections
        stats = {
            'total_collections': len(collections),
            'collections': {},
            'total_chunks': 0
        }

        for coll in collections:
            info = qdrant_client.get_collection(coll.name)
            stats['collections'][coll.name] = {
                'points': info.points_count,
                'status': info.status
            }
            stats['total_chunks'] += info.points_count

        return jsonify(stats)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def main():
    """启动 API 服务"""
    print("\n" + "="*60)
    print("🚀 启动 Qdrant 语义搜索 API")
    print("="*60 + "\n")

    # 初始化服务
    init_services()

    print("\n✅ 服务已准备就绪！\n")
    print("API 端点:")
    print("  - GET  /health           - 健康检查")
    print("  - GET  /collections      - 列出所有 collections")
    print("  - POST /search           - 语义搜索（跨 collection）")
    print("  - POST /search/by-source - 按知识源搜索")
    print("  - GET  /stats            - 获取统计信息")
    print("\n监听地址: http://localhost:8000")
    print("\n按 Ctrl+C 停止服务\n")
    print("="*60 + "\n")

    # 启动 Flask 服务
    app.run(
        host='0.0.0.0',
        port=8000,
        debug=False
    )


if __name__ == '__main__':
    main()
