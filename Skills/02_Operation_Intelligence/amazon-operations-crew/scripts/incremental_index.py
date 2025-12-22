#!/usr/bin/env python3
"""
Incremental Vector Index Builder for Amazon Knowledge Base

增量索引器：只处理新增或修改的文件，提高索引效率

特点:
- 追踪文件修改时间
- 只索引变化的文件
- 删除已不存在文件的向量
- 维护状态文件
"""

import sys
from pathlib import Path
import hashlib
import json
from typing import Dict, Set, List
from datetime import datetime

# 添加 tools 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "tools"))

from simple_embedder import SimpleEmbedder

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
except ImportError:
    print("Error: qdrant-client not installed")
    print("Please run: pip install qdrant-client")
    sys.exit(1)


class IncrementalIndexer:
    """增量索引器"""

    def __init__(
        self,
        source_dir: Path,
        state_file: Path,
        qdrant_url: str = "http://localhost:6333",
        collection_name: str = "amazon_knowledge_base"
    ):
        """
        Args:
            source_dir: 源文件目录
            state_file: 状态文件路径
            qdrant_url: Qdrant 服务器 URL
            collection_name: 集合名称
        """
        self.source_dir = source_dir
        self.state_file = state_file
        self.qdrant_url = qdrant_url
        self.collection_name = collection_name

        # 初始化组件
        print("Initializing incremental indexer...")
        self.embedder = SimpleEmbedder(model_name="all-MiniLM-L6-v2")
        self.qdrant = QdrantClient(url=qdrant_url)

        # 加载状态
        self.state = self._load_state()

    def _load_state(self) -> Dict[str, float]:
        """
        加载索引状态文件

        Returns:
            字典: {file_path: last_modified_timestamp}
        """
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    state = json.load(f)
                print(f"✓ Loaded state: {len(state)} files tracked")
                return state
            except Exception as e:
                print(f"Warning: Could not load state file: {e}")
                return {}
        else:
            print("No existing state file, will perform full indexing")
            return {}

    def _save_state(self):
        """保存索引状态到文件"""
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.state_file, 'w') as f:
            json.dump(self.state, f, indent=2)
        print(f"✓ Saved state: {len(self.state)} files tracked")

    def scan_changes(self) -> tuple[List[Path], Set[str]]:
        """
        扫描文件变化

        Returns:
            (new_or_modified_files, deleted_files)
        """
        print(f"\nScanning directory: {self.source_dir}")

        # 当前所有文件
        current_files = {}
        for md_file in self.source_dir.glob("**/*.md"):
            rel_path = str(md_file.relative_to(self.source_dir))
            mtime = md_file.stat().st_mtime
            current_files[rel_path] = mtime

        # 检测新增或修改的文件
        new_or_modified = []
        for rel_path, mtime in current_files.items():
            if rel_path not in self.state or self.state[rel_path] < mtime:
                full_path = self.source_dir / rel_path
                new_or_modified.append(full_path)

        # 检测已删除的文件
        deleted = set(self.state.keys()) - set(current_files.keys())

        print(f"✓ Found {len(new_or_modified)} new/modified files")
        print(f"✓ Found {len(deleted)} deleted files")

        return new_or_modified, deleted

    def remove_deleted_files(self, deleted_files: Set[str]):
        """
        从 Qdrant 中删除已不存在文件的向量

        Args:
            deleted_files: 已删除文件的相对路径集合
        """
        if not deleted_files:
            return

        print(f"\nRemoving vectors for {len(deleted_files)} deleted files...")

        for rel_path in deleted_files:
            # 生成该文件所有 chunks 的 ID 前缀
            # 注意：我们之前使用 md5(filename_chunkindex) 作为 ID
            # 需要找到所有匹配该文件的 points

            # 使用 scroll 获取所有 points，然后过滤
            # 这里简化处理：通过 payload 的 file_path 字段过滤
            try:
                # 删除所有 file_path 匹配的 points
                self.qdrant.delete(
                    collection_name=self.collection_name,
                    points_selector={
                        "filter": {
                            "must": [
                                {
                                    "key": "file_path",
                                    "match": {"value": rel_path}
                                }
                            ]
                        }
                    }
                )
                print(f"  ✓ Removed vectors for: {rel_path}")
            except Exception as e:
                print(f"  ✗ Error removing {rel_path}: {e}")

            # 从状态中移除
            self.state.pop(rel_path, None)

    def index_files(self, files: List[Path]):
        """
        索引新增或修改的文件

        Args:
            files: 要索引的文件列表
        """
        if not files:
            print("\nNo files to index")
            return

        print(f"\nIndexing {len(files)} files...")

        # 导入 chunker
        from build_vector_index import MarkdownChunker
        chunker = MarkdownChunker(chunk_size=1000, overlap=100)

        all_points = []
        total_chunks = 0

        for i, md_file in enumerate(files, 1):
            rel_path = str(md_file.relative_to(self.source_dir))
            print(f"\n[{i}/{len(files)}] Processing: {md_file.name}")

            try:
                # 先删除该文件的旧向量（如果是修改）
                if rel_path in self.state:
                    try:
                        self.qdrant.delete(
                            collection_name=self.collection_name,
                            points_selector={
                                "filter": {
                                    "must": [
                                        {
                                            "key": "file_path",
                                            "match": {"value": rel_path}
                                        }
                                    ]
                                }
                            }
                        )
                        print(f"  ✓ Removed old vectors")
                    except:
                        pass

                # 读取并分块
                content = md_file.read_text(encoding='utf-8')
                chunks = chunker.chunk_by_headers(content, rel_path)
                print(f"  Generated {len(chunks)} chunks")

                # 生成 embeddings
                for j, chunk in enumerate(chunks):
                    embedding = self.embedder.embed_text(chunk['text'])

                    # 生成唯一 ID
                    chunk_id = hashlib.md5(
                        f"{md_file.name}_{j}_{md_file.stat().st_mtime}".encode()
                    ).hexdigest()

                    # 添加元数据
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

                # 更新状态
                self.state[rel_path] = md_file.stat().st_mtime

                # 批量上传
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
        print(f"Total files processed: {len(files)}")
        print(f"Total chunks indexed: {total_chunks}")

    def _upload_batch(self, points: List[PointStruct]):
        """批量上传 points 到 Qdrant"""
        self.qdrant.upsert(
            collection_name=self.collection_name,
            points=points
        )
        print(f"  ✓ Uploaded {len(points)} chunks")

    def run(self):
        """执行增量索引"""
        print("=" * 60)
        print("Incremental Amazon Knowledge Base Indexer")
        print("=" * 60)

        # 扫描变化
        new_or_modified, deleted = self.scan_changes()

        # 处理删除
        self.remove_deleted_files(deleted)

        # 索引新增/修改
        self.index_files(new_or_modified)

        # 保存状态
        self._save_state()

        print("\n" + "=" * 60)
        print("✅ Incremental indexing complete!")
        print("=" * 60)
        print(f"\nSummary:")
        print(f"  New/Modified files: {len(new_or_modified)}")
        print(f"  Deleted files: {len(deleted)}")
        print(f"  Total tracked files: {len(self.state)}")


def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Incremental vector index builder for Amazon knowledge base"
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("~/Documents/出海跨境/Amazon").expanduser(),
        help="Source directory to index"
    )
    parser.add_argument(
        "--state-file",
        type=Path,
        default=Path(__file__).parent.parent / ".index_state.json",
        help="State file path"
    )
    parser.add_argument(
        "--qdrant-url",
        default="http://localhost:6333",
        help="Qdrant server URL"
    )

    args = parser.parse_args()

    # 创建索引器
    indexer = IncrementalIndexer(
        source_dir=args.source,
        state_file=args.state_file,
        qdrant_url=args.qdrant_url
    )

    # 运行索引
    indexer.run()


if __name__ == "__main__":
    main()
