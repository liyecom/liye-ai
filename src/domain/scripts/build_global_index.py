#!/usr/bin/env python3
"""
全局知识库索引脚本
为 Obsidian 统一知识管理创建向量索引
"""

import sys
import hashlib
import json
from pathlib import Path
from typing import List, Dict, Tuple
from datetime import datetime

# 添加项目路径
project_dir = Path(__file__).parent.parent
sys.path.insert(0, str(project_dir))

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from tools.simple_embedder import SimpleEmbedder


class MarkdownChunker:
    """智能 Markdown 分块器"""

    def __init__(self, chunk_size: int = 800, overlap: int = 100):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk_by_headers(self, content: str, file_path: str) -> List[Dict]:
        """按 Markdown 标题分块，保持语义完整"""
        chunks = []

        # 按二级标题分割
        sections = content.split('\n## ')

        for i, section in enumerate(sections):
            if not section.strip():
                continue

            # 如果是第一个部分，可能包含一级标题
            if i == 0:
                text = section
            else:
                text = '## ' + section

            # 如果单个章节太长，按段落进一步分割
            if len(text) > self.chunk_size:
                sub_chunks = self._chunk_by_paragraphs(text)
                for j, sub_chunk in enumerate(sub_chunks):
                    chunks.append({
                        'text': sub_chunk,
                        'chunk_id': f"{i}_{j}",
                        'type': 'paragraph'
                    })
            else:
                chunks.append({
                    'text': text,
                    'chunk_id': str(i),
                    'type': 'section'
                })

        # 如果没有找到标题，按段落分割
        if len(chunks) == 0:
            chunks = self._chunk_by_paragraphs(content)

        return chunks

    def _chunk_by_paragraphs(self, text: str) -> List[Dict]:
        """按段落分块"""
        chunks = []
        paragraphs = text.split('\n\n')

        current_chunk = ""
        chunk_id = 0

        for para in paragraphs:
            if not para.strip():
                continue

            # 如果添加这个段落会超过限制
            if len(current_chunk) + len(para) > self.chunk_size:
                if current_chunk:
                    chunks.append({
                        'text': current_chunk.strip(),
                        'chunk_id': str(chunk_id),
                        'type': 'paragraph'
                    })
                    chunk_id += 1

                # 如果单个段落就超过限制，强制分割
                if len(para) > self.chunk_size:
                    for i in range(0, len(para), self.chunk_size - self.overlap):
                        chunk_text = para[i:i + self.chunk_size]
                        chunks.append({
                            'text': chunk_text,
                            'chunk_id': f"{chunk_id}_{i}",
                            'type': 'fragment'
                        })
                    current_chunk = ""
                else:
                    current_chunk = para + "\n\n"
            else:
                current_chunk += para + "\n\n"

        # 添加最后一个 chunk
        if current_chunk.strip():
            chunks.append({
                'text': current_chunk.strip(),
                'chunk_id': str(chunk_id),
                'type': 'paragraph'
            })

        return chunks


class GlobalIndexBuilder:
    """全局知识库索引构建器"""

    # 定义要索引的源
    SOURCES = [
        {
            'name': 'liye_os_skills',
            'path': Path.home() / 'Documents/liye_workspace/LiYe_OS',
            'description': 'LiYe OS 能力框架和 Skills'
        },
        {
            'name': 'para_areas',
            'path': Path.home() / 'Documents/liye_workspace/20 Areas',
            'description': 'PARA 长期关注领域索引'
        },
        {
            'name': 'crossborder_ecommerce',
            'path': Path.home() / 'Documents/出海跨境',
            'description': '跨境电商工作区（Amazon/TikTok/独立站）'
        },
        {
            'name': 'shengcai_library',
            'path': Path.home() / 'Documents/生财有术',
            'description': '生财有术创业财商知识库'
        },
        {
            'name': 'medical_resources',
            'path': Path.home() / 'Documents/癌症领域',
            'description': '医疗健康资源'
        }
    ]

    def __init__(self, qdrant_url: str = "http://localhost:6333"):
        self.qdrant = QdrantClient(url=qdrant_url)
        self.embedder = SimpleEmbedder(model_name="all-MiniLM-L6-v2")
        self.chunker = MarkdownChunker(chunk_size=800, overlap=100)
        self.embedding_dim = self.embedder.get_embedding_dim()

        print(f"✓ Connected to Qdrant at {qdrant_url}")
        print(f"✓ Embedding dimension: {self.embedding_dim}")

    def create_collection(self, collection_name: str):
        """创建或重建 collection"""
        try:
            # 检查是否已存在
            collections = self.qdrant.get_collections().collections
            exists = any(c.name == collection_name for c in collections)

            if exists:
                print(f"⚠️  Collection '{collection_name}' already exists, recreating...")
                self.qdrant.delete_collection(collection_name)

            # 创建新 collection
            self.qdrant.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=self.embedding_dim,
                    distance=Distance.COSINE
                )
            )
            print(f"✓ Created collection: {collection_name}")

        except Exception as e:
            print(f"✗ Error creating collection {collection_name}: {e}")
            raise

    def scan_markdown_files(self, source_path: Path) -> List[Path]:
        """扫描目录下的所有 Markdown 文件"""
        if not source_path.exists():
            print(f"⚠️  Path does not exist: {source_path}")
            return []

        md_files = list(source_path.rglob("*.md"))
        print(f"  Found {len(md_files)} MD files in {source_path.name}")
        return md_files

    def index_file(self, file_path: Path, source_name: str) -> List[PointStruct]:
        """索引单个文件，返回 points"""
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')

            # 智能分块
            chunks = self.chunker.chunk_by_headers(content, str(file_path))

            if not chunks:
                return []

            # 生成 embeddings（批量）
            texts = [chunk['text'] for chunk in chunks]
            embeddings = self.embedder.embed_batch(texts, show_progress=False)

            # 创建 points
            points = []
            for chunk, embedding in zip(chunks, embeddings):
                # 生成唯一 ID
                chunk_identifier = f"{file_path}::{chunk['chunk_id']}"
                point_id = hashlib.md5(chunk_identifier.encode()).hexdigest()

                # 安全地获取文本预览
                text_content = str(chunk.get('text', ''))
                text_preview = text_content[:500] if text_content else ''

                point = PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        'source': source_name,
                        'file_path': str(file_path.relative_to(file_path.parent.parent.parent)),
                        'full_path': str(file_path),
                        'chunk_id': str(chunk.get('chunk_id', '')),
                        'chunk_type': chunk.get('type', 'unknown'),
                        'text': text_preview,  # 存储前 500 字符预览
                        'text_length': len(text_content),
                        'indexed_at': datetime.now().isoformat()
                    }
                )
                points.append(point)

            return points

        except Exception as e:
            print(f"  ✗ Error indexing {file_path.name}: {e}")
            return []

    def index_source(self, source: Dict, batch_size: int = 50):
        """索引一个知识源"""
        collection_name = source['name']
        source_path = source['path']

        print(f"\n{'='*60}")
        print(f"索引知识源: {source['description']}")
        print(f"Collection: {collection_name}")
        print(f"Path: {source_path}")
        print(f"{'='*60}\n")

        # 创建 collection
        self.create_collection(collection_name)

        # 扫描文件
        md_files = self.scan_markdown_files(source_path)

        if not md_files:
            print(f"⚠️  No files to index for {collection_name}")
            return

        # 批量处理文件
        all_points = []
        total_files = len(md_files)

        for i, md_file in enumerate(md_files, 1):
            if i % 10 == 0 or i == total_files:
                print(f"  Processing: {i}/{total_files} files...", end='\r')

            points = self.index_file(md_file, source['name'])
            all_points.extend(points)

            # 每 batch_size 个文件上传一次
            if len(all_points) >= batch_size * 10:  # 假设每个文件平均 10 个 chunks
                self.qdrant.upsert(
                    collection_name=collection_name,
                    points=all_points
                )
                all_points = []

        # 上传剩余的 points
        if all_points:
            self.qdrant.upsert(
                collection_name=collection_name,
                points=all_points
            )

        # 获取最终统计
        collection_info = self.qdrant.get_collection(collection_name)
        total_chunks = collection_info.points_count

        print(f"\n✅ 索引完成:")
        print(f"   文件数: {total_files}")
        print(f"   Chunks: {total_chunks}")
        print(f"   平均每文件: {total_chunks/total_files:.1f} chunks")

    def build_all(self):
        """构建所有知识源的索引"""
        print("\n" + "="*60)
        print("🚀 开始构建全局知识库索引")
        print("="*60 + "\n")

        start_time = datetime.now()

        for source in self.SOURCES:
            try:
                self.index_source(source)
            except Exception as e:
                print(f"\n✗ Failed to index {source['name']}: {e}")
                print("Continuing with next source...\n")

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        # 最终统计
        print("\n" + "="*60)
        print("✅ 全局索引构建完成！")
        print("="*60 + "\n")

        collections = self.qdrant.get_collections().collections
        print("Collections:")
        for coll in collections:
            info = self.qdrant.get_collection(coll.name)
            print(f"  - {coll.name}: {info.points_count} chunks")

        print(f"\n总耗时: {duration:.1f} 秒 ({duration/60:.1f} 分钟)")


def main():
    """主函数"""
    try:
        builder = GlobalIndexBuilder()
        builder.build_all()

        print("\n✅ 所有索引已创建！")
        print("\n下一步:")
        print("  1. 在 Obsidian 中测试全局搜索")
        print("  2. 配置 File Watcher 自动增量索引")
        print("  3. 创建 Obsidian 语义搜索插件集成")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
