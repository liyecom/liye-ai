"""
Qdrant Knowledge Base Tool for CrewAI

Enables semantic search of Amazon knowledge base using:
- Qdrant vector database (local, containerized)
- SimpleEmbedder (sentence-transformers all-MiniLM-L6-v2)
- Zero API cost, 100% local execution
"""

import os
import sys
from pathlib import Path
from typing import List, Dict

try:
    from crewai.tools import BaseTool
except ImportError:
    # Fallback for standalone testing
    class BaseTool:
        def __init__(self):
            pass

# Add tools directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from simple_embedder import SimpleEmbedder

try:
    from qdrant_client import QdrantClient
except ImportError:
    print("Error: qdrant-client not installed")
    print("Please run: pip install qdrant-client")
    sys.exit(1)


class QdrantKnowledgeTool(BaseTool):
    """
    CrewAI tool for semantic search of Amazon knowledge base

    Uses Qdrant vector database with local embeddings (no API costs)
    """

    name: str = "Search Amazon Knowledge Base"
    description: str = """Semantic search of Amazon operations knowledge base.

    This tool searches through 66+ advertising strategies, ChatGPT prompts,
    operational guides, and best practices extracted from PDFs and documents.

    Best for:
    - Finding advertising strategies (e.g., "新品如何快速测款")
    - Discovering optimization methods (e.g., "降低ACOS的方法")
    - Cross-referencing best practices from multiple sources
    - Understanding specific tactics with examples and data

    Input: A search query describing what you're looking for (can be in Chinese or English)
    Output: Top 3 most relevant knowledge excerpts with source files and relevance scores
    """

    def __init__(
        self,
        qdrant_url: str = "http://localhost:6333",
        collection_name: str = "amazon_knowledge_base",
        top_k: int = 3
    ):
        """
        Initialize Qdrant Knowledge Base Tool

        Args:
            qdrant_url: Qdrant server URL (default: local Docker container)
            collection_name: Name of the vector collection
            top_k: Number of results to return (default: 3)
        """
        super().__init__()

        # Set NO_PROXY to bypass proxy for localhost (critical for Mac setup)
        os.environ['NO_PROXY'] = 'localhost,127.0.0.1'
        os.environ['no_proxy'] = 'localhost,127.0.0.1'

        # Use private attributes to avoid Pydantic conflicts
        self._qdrant_url = qdrant_url
        self._collection_name = collection_name
        self._top_k = top_k

        # Initialize components
        try:
            self._qdrant = QdrantClient(url=qdrant_url)
            self._embedder = SimpleEmbedder(model_name="all-MiniLM-L6-v2")

            # Verify collection exists
            collections = self._qdrant.get_collections()
            collection_names = [c.name for c in collections.collections]

            if collection_name not in collection_names:
                raise ValueError(
                    f"Collection '{collection_name}' not found in Qdrant. "
                    f"Available collections: {collection_names}\n"
                    f"Please run: python scripts/build_vector_index.py"
                )

            print(f"✓ Connected to Qdrant: {qdrant_url}")
            print(f"✓ Using collection: {collection_name}")

        except Exception as e:
            raise ConnectionError(
                f"Failed to initialize Qdrant Knowledge Tool: {e}\n"
                f"Make sure Qdrant is running: docker-compose up -d"
            )

    def _run(self, query: str) -> str:
        """
        Execute semantic search on knowledge base

        Args:
            query: Search query (e.g., "如何降低新品的ACOS")

        Returns:
            Formatted string with top results including:
            - Source file name
            - Section title
            - Relevance score (percentage)
            - Text preview
        """
        if not query or not query.strip():
            return "Error: Empty query. Please provide a search query."

        try:
            # Generate query embedding
            query_vector = self._embedder.embed_text(query)

            # Search Qdrant using query_points
            response = self._qdrant.query_points(
                collection_name=self._collection_name,
                query=query_vector,
                limit=self._top_k,
                with_payload=True
            )

            if not response.points:
                return f"未找到相关知识：'{query}'\n\n建议：\n- 尝试不同的关键词\n- 使用更通用的描述\n- 检查知识库是否已索引"

            # Format results for agent consumption
            output = f"📚 知识库检索结果 (查询: {query})\n"
            output += f"找到 {len(response.points)} 条相关内容\n\n"
            output += "=" * 60 + "\n\n"

            for i, point in enumerate(response.points, 1):
                # Calculate relevance as percentage (Qdrant returns score 0-1)
                relevance = point.score * 100 if hasattr(point, 'score') else 100

                # Extract metadata from payload
                payload = point.payload if hasattr(point, 'payload') else {}
                source_file = payload.get('source_file', 'Unknown')
                section_title = payload.get('section_title', 'N/A')
                char_count = payload.get('char_count', 0)
                text_preview = payload.get('text_preview', '')

                output += f"## 结果 {i}: {source_file}\n"
                output += f"**相关度**: {relevance:.1f}%\n"
                output += f"**章节**: {section_title}\n"
                output += f"**字数**: {char_count} 字符\n\n"
                output += f"**内容预览**:\n{text_preview}\n\n"
                output += "-" * 60 + "\n\n"

            output += "💡 **使用建议**: 参考以上内容时，请结合具体产品和市场情况灵活应用。\n"

            return output

        except Exception as e:
            return f"知识库检索错误: {str(e)}\n\n请检查:\n1. Qdrant 服务是否运行\n2. 集合是否已创建\n3. 网络连接"

    def search_batch(self, queries: List[str]) -> Dict[str, str]:
        """
        Batch search for multiple queries (utility method)

        Args:
            queries: List of search queries

        Returns:
            Dictionary mapping query to formatted results
        """
        results = {}
        for query in queries:
            results[query] = self._run(query)
        return results


# Convenience function for direct usage
def create_kb_tool() -> QdrantKnowledgeTool:
    """Factory function to create KB tool instance"""
    return QdrantKnowledgeTool()


if __name__ == "__main__":
    # Test the tool
    print("Testing Qdrant Knowledge Base Tool...\n")

    tool = QdrantKnowledgeTool()

    # Test queries
    test_queries = [
        "如何降低新品的ACOS",
        "新品推广策略",
        "提高转化率的方法"
    ]

    for query in test_queries:
        print(f"\n{'='*60}")
        print(f"测试查询: {query}")
        print('='*60)
        result = tool._run(query)
        print(result)
        print("\n")

    print("✅ Qdrant Knowledge Base Tool test complete!")
