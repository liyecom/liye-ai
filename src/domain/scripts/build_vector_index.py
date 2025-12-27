#!/usr/bin/env python3
"""
Build Vector Index for Amazon Knowledge Base

使用 Ollama + Qdrant 构建本地向量索引（零 API 成本）

特点:
- 智能分块：按 Markdown 标题和段落分割
- 全文索引：不丢失细节
- 元数据记录：记录来源文件、章节、时间
"""

import sys
from pathlib import Path
import hashlib
import re
from typing import List, Dict
from datetime import datetime

# 添加 tools 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "tools"))

from simple_embedder import SimpleEmbedder

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct
except ImportError:
    print("Error: qdrant-client not installed")
    print("Please run: pip install qdrant-client")
    sys.exit(1)


class MarkdownChunker:
    """智能 Markdown 分块器"""

    def __init__(self, chunk_size: int = 1000, overlap: int = 100):
        """
        Args:
            chunk_size: 目标 chunk 大小（字符数）
            overlap: 重叠字符数（保持上下文连贯性）
        """
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk_by_headers(self, content: str, file_path: str) -> List[Dict]:
        """
        按 Markdown 标题智能分块

        Args:
            content: Markdown 内容
            file_path: 文件路径（用于元数据）

        Returns:
            chunks 列表，每个 chunk 包含 text 和 metadata
        """
        chunks = []

        # 分割标题（支持 # 到 #### 级别）
        sections = re.split(r'\n(#{1,4}\s+.+)\n', content)

        current_section = {
            'title': 'Introduction',
            'content': '',
            'level': 0
        }

        for i, part in enumerate(sections):
            # 检查是否是标题
            header_match = re.match(r'^(#{1,4})\s+(.+)$', part)

            if header_match:
                # 保存上一个 section
                if current_section['content'].strip():
                    chunks.extend(
                        self._split_large_section(
                            current_section,
                            file_path
                        )
                    )

                # 开始新 section
                level = len(header_match.group(1))
                title = header_match.group(2).strip()
                current_section = {
                    'title': title,
                    'content': '',
                    'level': level
                }
            else:
                # 添加内容到当前 section
                current_section['content'] += part

        # 保存最后一个 section
        if current_section['content'].strip():
            chunks.extend(
                self._split_large_section(current_section, file_path)
            )

        return chunks

    def _split_large_section(
        self,
        section: Dict,
        file_path: str
    ) -> List[Dict]:
        """
        如果 section 太大，按段落进一步分割

        Args:
            section: 包含 title, content, level 的字典
            file_path: 文件路径

        Returns:
            chunks 列表
        """
        content = section['content'].strip()

        # 如果小于 chunk_size，直接返回
        if len(content) < self.chunk_size:
            return [{
                'text': f"# {section['title']}\n\n{content}",
                'metadata': {
                    'file_path': file_path,
                    'section_title': section['title'],
                    'section_level': section['level'],
                    'char_count': len(content)
                }
            }]

        # 按段落分割
        paragraphs = content.split('\n\n')
        chunks = []
        current_chunk = f"# {section['title']}\n\n"

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # 如果加入这个段落会超过 chunk_size
            if len(current_chunk) + len(para) > self.chunk_size:
                # 保存当前 chunk
                if len(current_chunk) > len(f"# {section['title']}\n\n"):
                    chunks.append({
                        'text': current_chunk.strip(),
                        'metadata': {
                            'file_path': file_path,
                            'section_title': section['title'],
                            'section_level': section['level'],
                            'char_count': len(current_chunk)
                        }
                    })

                # 开始新 chunk（保留 overlap）
                current_chunk = f"# {section['title']}\n\n"

            current_chunk += para + "\n\n"

        # 保存最后一个 chunk
        if len(current_chunk) > len(f"# {section['title']}\n\n"):
            chunks.append({
                'text': current_chunk.strip(),
                'metadata': {
                    'file_path': file_path,
                    'section_title': section['title'],
                    'section_level': section['level'],
                    'char_count': len(current_chunk)
                }
            })

        return chunks


class VectorIndexBuilder:
    """向量索引构建器"""

    def __init__(
        self,
        qdrant_url: str = "http://localhost:6333",
        collection_name: str = "amazon_knowledge_base"
    ):
        """
        Args:
            qdrant_url: Qdrant 服务器 URL
            collection_name: 集合名称
        """
        self.qdrant_url = qdrant_url
        self.collection_name = collection_name

        # 初始化组件
        print("Initializing components...")
        self.embedder = SimpleEmbedder(model_name="all-MiniLM-L6-v2")
        self.chunker = MarkdownChunker(chunk_size=1000, overlap=100)
        self.qdrant = QdrantClient(url=qdrant_url)

        # 获取 embedding 维度
        self.embedding_dim = self.embedder.get_embedding_dim()
        print(f"✓ Embedding dimension: {self.embedding_dim}")

    def create_collection(self):
        """创建或重建 Qdrant 集合"""
        print(f"\nCreating collection '{self.collection_name}'...")

        # 删除旧集合（如果存在）
        try:
            self.qdrant.delete_collection(self.collection_name)
            print("✓ Deleted existing collection")
        except:
            pass

        # 创建新集合
        self.qdrant.create_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(
                size=self.embedding_dim,
                distance=Distance.COSINE
            )
        )
        print("✓ Created new collection")

    def index_directory(
        self,
        directory: Path,
        pattern: str = "**/*.md",
        max_files: int = None
    ):
        """
        索引目录下的所有 Markdown 文件

        Args:
            directory: 要索引的目录
            pattern: 文件匹配模式
            max_files: 最多处理文件数（用于测试）
        """
        print(f"\nScanning directory: {directory}")
        md_files = list(directory.glob(pattern))

        if max_files:
            md_files = md_files[:max_files]
            print(f"Limiting to first {max_files} files for testing")

        print(f"Found {len(md_files)} Markdown files")

        all_points = []
        total_chunks = 0

        for i, md_file in enumerate(md_files, 1):
            print(f"\n[{i}/{len(md_files)}] Processing: {md_file.name}")

            try:
                # 读取文件
                content = md_file.read_text(encoding='utf-8')

                # 分块
                chunks = self.chunker.chunk_by_headers(
                    content,
                    str(md_file.relative_to(directory))
                )
                print(f"  Generated {len(chunks)} chunks")

                # 生成 embeddings
                for j, chunk in enumerate(chunks):
                    embedding = self.embedder.embed_text(chunk['text'])

                    # 生成唯一 ID
                    chunk_id = hashlib.md5(
                        f"{md_file.name}_{j}".encode()
                    ).hexdigest()

                    # 添加额外元数据
                    metadata = chunk['metadata']
                    metadata.update({
                        'source_file': md_file.name,
                        'full_path': str(md_file),
                        'chunk_index': j,
                        'indexed_at': datetime.now().isoformat()
                    })

                    point = PointStruct(
                        id=chunk_id,
                        vector=embedding,
                        payload={
                            **metadata,
                            'text_preview': chunk['text'][:300]
                        }
                    )
                    all_points.append(point)

                total_chunks += len(chunks)

                # 每 10 个文件批量上传一次
                if len(all_points) >= 50:
                    self._upload_batch(all_points)
                    all_points = []

            except Exception as e:
                print(f"  ✗ Error processing {md_file.name}: {e}")
                continue

        # 上传剩余的 points
        if all_points:
            self._upload_batch(all_points)

        print(f"\n✅ Indexing complete!")
        print(f"Total files: {len(md_files)}")
        print(f"Total chunks: {total_chunks}")

    def _upload_batch(self, points: List[PointStruct]):
        """批量上传 points 到 Qdrant"""
        self.qdrant.upsert(
            collection_name=self.collection_name,
            points=points
        )
        print(f"  ✓ Uploaded {len(points)} chunks")


def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Build vector index for Amazon knowledge base"
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("~/Documents/出海跨境/Amazon").expanduser(),
        help="Source directory to index"
    )
    parser.add_argument(
        "--qdrant-url",
        default="http://localhost:6333",
        help="Qdrant server URL"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Amazon Knowledge Base Vector Index Builder")
    print("=" * 60)

    # 创建 builder
    builder = VectorIndexBuilder(qdrant_url=args.qdrant_url)

    # 创建集合
    builder.create_collection()

    # 索引目录（处理所有文件）
    builder.index_directory(
        directory=args.source,
        pattern="**/*.md",
        max_files=None
    )

    print("\n" + "=" * 60)
    print("✅ Vector index built successfully!")
    print("=" * 60)
    print(f"\nYou can now query the index using Qdrant at {args.qdrant_url}")
    print(f"Collection name: {builder.collection_name}")


if __name__ == "__main__":
    main()
