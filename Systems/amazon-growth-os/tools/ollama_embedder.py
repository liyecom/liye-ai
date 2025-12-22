"""
Ollama Embedder - 使用本地 Ollama 生成 embeddings（零 API 成本）

支持的模型:
- nomic-embed-text (137M, 英文优化, 768维)
- gte-large-zh (670M, 中文优化, 1024维)
- bge-m3 (2.3GB, 多语言, 1024维)
"""

import requests
import json
from typing import List, Union


class OllamaEmbedder:
    """使用 Ollama 本地生成 embeddings"""

    def __init__(
        self,
        model: str = "nomic-embed-text",
        base_url: str = "http://localhost:11434"
    ):
        """
        初始化 Ollama Embedder

        Args:
            model: embedding 模型名称
            base_url: Ollama API 基础 URL
        """
        self.model = model
        self.base_url = base_url
        self._verify_model()

    def _verify_model(self):
        """验证模型是否已安装"""
        try:
            response = requests.get(f"{self.base_url}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                installed = any(m["name"].startswith(self.model) for m in models)
                if not installed:
                    raise ValueError(
                        f"Model '{self.model}' not found. "
                        f"Please run: ollama pull {self.model}"
                    )
                print(f"✓ Ollama model '{self.model}' is ready")
            else:
                raise ConnectionError("Cannot connect to Ollama. Is it running?")
        except requests.exceptions.ConnectionError:
            raise ConnectionError(
                "Cannot connect to Ollama at {self.base_url}. "
                "Please start Ollama with: ollama serve"
            )

    def embed_text(self, text: str) -> List[float]:
        """
        生成单个文本的 embedding

        Args:
            text: 要编码的文本

        Returns:
            embedding 向量 (list of floats)
        """
        response = requests.post(
            f"{self.base_url}/api/embeddings",
            json={
                "model": self.model,
                "prompt": text
            },
            timeout=30
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Ollama embedding failed: {response.status_code} {response.text}"
            )

        return response.json()["embedding"]

    def embed_batch(
        self,
        texts: List[str],
        show_progress: bool = True
    ) -> List[List[float]]:
        """
        批量生成 embeddings

        Args:
            texts: 文本列表
            show_progress: 是否显示进度

        Returns:
            embeddings 列表
        """
        embeddings = []
        total = len(texts)

        for i, text in enumerate(texts):
            embedding = self.embed_text(text)
            embeddings.append(embedding)

            if show_progress and (i + 1) % 10 == 0:
                print(f"Processed {i + 1}/{total} embeddings...")

        return embeddings

    def get_embedding_dim(self) -> int:
        """获取 embedding 维度"""
        # 测试 embedding 获取维度
        test_embedding = self.embed_text("test")
        return len(test_embedding)


# 便利函数
def create_embedder(model: str = "nomic-embed-text") -> OllamaEmbedder:
    """创建 embedder 实例（便利函数）"""
    return OllamaEmbedder(model=model)


if __name__ == "__main__":
    # 测试代码
    print("Testing Ollama Embedder...")

    embedder = OllamaEmbedder()

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

    print("\n✅ Ollama Embedder test passed!")
