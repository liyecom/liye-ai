"""
Simple Local Embedder using sentence-transformers
备用方案：当 Ollama 不可用时使用
"""

from typing import List
from sentence_transformers import SentenceTransformer


class SimpleEmbedder:
    """使用 sentence-transformers 的简单 embedder（100% 本地、免费）"""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        初始化 embedder

        Args:
            model_name: sentence-transformers 模型名称
                - all-MiniLM-L6-v2: 轻量快速 (80MB, 384维)
                - paraphrase-MiniLM-L6-v2: 语义相似度优化 (80MB, 384维)
                - all-mpnet-base-v2: 高质量 (420MB, 768维)
        """
        print(f"Loading embedding model: {model_name}...")
        self.model = SentenceTransformer(model_name)
        print(f"✓ Model loaded successfully")

    def embed_text(self, text: str) -> List[float]:
        """生成单个文本的 embedding"""
        return self.model.encode(text, convert_to_numpy=True).tolist()

    def embed_batch(
        self,
        texts: List[str],
        show_progress: bool = True
    ) -> List[List[float]]:
        """批量生成 embeddings"""
        embeddings = self.model.encode(
            texts,
            show_progress_bar=show_progress,
            convert_to_numpy=True
        )
        return [emb.tolist() for emb in embeddings]

    def get_embedding_dim(self) -> int:
        """获取 embedding 维度"""
        test_embedding = self.embed_text("test")
        return len(test_embedding)


if __name__ == "__main__":
    print("Testing Simple Embedder...")

    embedder = SimpleEmbedder()

    # 测试单个文本
    text = "亚马逊 PPC 广告优化策略"
    embedding = embedder.embed_text(text)
    print(f"\n✓ Embedding dimension: {len(embedding)}")
    print(f"✓ First 5 values: {embedding[:5]}")

    # 测试批量
    texts = [
        "如何降低 ACOS",
        "新品推广策略",
        "关键词研究方法"
    ]
    embeddings = embedder.embed_batch(texts, show_progress=False)
    print(f"\n✓ Batch embeddings: {len(embeddings)} items")
    print(f"✓ All same dimension: {all(len(e) == len(embedding) for e in embeddings)}")

    print("\n✅ Simple Embedder test passed!")
