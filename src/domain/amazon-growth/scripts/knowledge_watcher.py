#!/usr/bin/env python3
"""
知识库文件监控服务
自动检测 MD 文件变化并增量索引到 Qdrant
"""

import sys
import time
import hashlib
import logging
from pathlib import Path
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent, FileCreatedEvent, FileDeletedEvent

# 添加项目路径
project_dir = Path(__file__).parent.parent
sys.path.insert(0, str(project_dir))

from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from tools.simple_embedder import SimpleEmbedder
from scripts.build_global_index import MarkdownChunker

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/knowledge_watcher.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class KnowledgeIndexHandler(FileSystemEventHandler):
    """处理知识库文件变化"""

    def __init__(self):
        super().__init__()
        self.qdrant = QdrantClient(url="http://localhost:6333")
        self.embedder = SimpleEmbedder()
        self.chunker = MarkdownChunker(chunk_size=800, overlap=100)

        # 定义知识库映射（目录 → collection）
        self.source_mappings = {
            Path.home() / "Documents/出海跨境/Amazon": "amazon_knowledge_base",
            Path.home() / "Documents/生财有术": "shengcai_library",
            Path.home() / "Documents/癌症领域": "medical_resources",
            Path.home() / "Documents/liye_workspace/LiYe_OS/Skills": "liye_os_skills",
            Path.home() / "Documents/出海跨境": "crossborder_ecommerce",
            Path.home() / "Documents/liye_workspace/20 Areas": "para_areas"
        }

        # 防抖：避免短时间内多次触发
        self.last_indexed = {}
        self.debounce_seconds = 5

    def _get_collection_for_file(self, file_path: Path) -> str:
        """根据文件路径确定应该索引到哪个 collection"""
        for source_dir, collection_name in self.source_mappings.items():
            try:
                file_path.relative_to(source_dir)
                return collection_name
            except ValueError:
                continue
        return None

    def _should_index(self, file_path: Path) -> bool:
        """判断文件是否应该被索引"""
        # 只索引 MD 文件
        if file_path.suffix.lower() != '.md':
            return False

        # 排除隐藏文件和目录
        if any(part.startswith('.') for part in file_path.parts):
            return False

        # 防抖检查
        file_key = str(file_path)
        last_time = self.last_indexed.get(file_key, 0)
        current_time = time.time()

        if current_time - last_time < self.debounce_seconds:
            return False

        self.last_indexed[file_key] = current_time
        return True

    def _index_file(self, file_path: Path):
        """索引单个文件"""
        try:
            # 确定目标 collection
            collection_name = self._get_collection_for_file(file_path)
            if not collection_name:
                logger.warning(f"跳过文件（不在监控目录）: {file_path}")
                return

            # 读取文件内容
            content = file_path.read_text(encoding='utf-8')

            # 分块
            chunks = self.chunker.chunk_by_headers(content, str(file_path))

            # 生成向量并上传
            points = []
            for chunk in chunks:
                # 生成唯一 ID
                file_chunk_id = f"{file_path.stem}_{chunk['chunk_id']}"
                point_id = hashlib.md5(file_chunk_id.encode()).hexdigest()

                # 生成 embedding
                text_content = str(chunk.get('text', ''))
                if not text_content.strip():
                    continue

                embedding = self.embedder.embed_text(text_content)

                # 创建 point
                text_preview = text_content[:500] if text_content else ''
                point = PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        'source': collection_name,
                        'file_path': file_path.name,
                        'full_path': str(file_path),
                        'chunk_id': str(chunk.get('chunk_id', '')),
                        'chunk_type': chunk.get('type', 'unknown'),
                        'text': text_preview,
                        'text_length': len(text_content),
                        'indexed_at': datetime.now().isoformat()
                    }
                )
                points.append(point)

            # 批量上传
            if points:
                self.qdrant.upsert(
                    collection_name=collection_name,
                    points=points
                )
                logger.info(f"✓ 已索引: {file_path.name} → {collection_name} ({len(points)} chunks)")
            else:
                logger.warning(f"⚠ 文件无有效内容: {file_path.name}")

        except Exception as e:
            logger.error(f"✗ 索引失败: {file_path.name} - {e}")

    def _delete_file_from_index(self, file_path: Path):
        """从索引中删除文件"""
        try:
            collection_name = self._get_collection_for_file(file_path)
            if not collection_name:
                return

            # TODO: 实现删除逻辑（需要根据 full_path 查询并删除所有相关 points）
            # 暂时跳过，因为 Qdrant 删除需要先查询 ID
            logger.info(f"ℹ 文件已删除（索引暂未清理）: {file_path.name}")

        except Exception as e:
            logger.error(f"✗ 删除索引失败: {file_path.name} - {e}")

    def on_created(self, event):
        """处理文件创建事件"""
        if isinstance(event, FileCreatedEvent) and not event.is_directory:
            file_path = Path(event.src_path)
            if self._should_index(file_path):
                logger.info(f"🆕 检测到新文件: {file_path.name}")
                self._index_file(file_path)

    def on_modified(self, event):
        """处理文件修改事件"""
        if isinstance(event, FileModifiedEvent) and not event.is_directory:
            file_path = Path(event.src_path)
            if self._should_index(file_path):
                logger.info(f"✏️  检测到文件修改: {file_path.name}")
                self._index_file(file_path)

    def on_deleted(self, event):
        """处理文件删除事件"""
        if isinstance(event, FileDeletedEvent) and not event.is_directory:
            file_path = Path(event.src_path)
            if file_path.suffix.lower() == '.md':
                logger.info(f"🗑️  检测到文件删除: {file_path.name}")
                self._delete_file_from_index(file_path)


def main():
    """主函数"""
    logger.info("=" * 60)
    logger.info("🚀 知识库监控服务启动")
    logger.info("=" * 60)

    # 检查 Qdrant 连接
    try:
        qdrant = QdrantClient(url="http://localhost:6333")
        collections = qdrant.get_collections()
        logger.info(f"✓ Qdrant 连接成功，当前有 {len(collections.collections)} 个 collections")
    except Exception as e:
        logger.error(f"✗ 无法连接到 Qdrant: {e}")
        logger.error("请确保 Docker 容器正在运行: docker ps | grep qdrant")
        sys.exit(1)

    # 创建监控器
    event_handler = KnowledgeIndexHandler()
    observer = Observer()

    # 监控所有知识库目录
    watch_dirs = list(event_handler.source_mappings.keys())
    logger.info(f"📂 监控 {len(watch_dirs)} 个目录:")

    for watch_dir in watch_dirs:
        if watch_dir.exists():
            observer.schedule(event_handler, str(watch_dir), recursive=True)
            logger.info(f"   ✓ {watch_dir}")
        else:
            logger.warning(f"   ⚠ 目录不存在: {watch_dir}")

    # 启动监控
    observer.start()
    logger.info("=" * 60)
    logger.info("👀 开始监控文件变化... (按 Ctrl+C 停止)")
    logger.info("=" * 60)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("\n🛑 收到停止信号，正在关闭...")
        observer.stop()

    observer.join()
    logger.info("✓ 监控服务已停止")


if __name__ == "__main__":
    main()
