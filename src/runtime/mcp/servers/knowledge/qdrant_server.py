"""
Qdrant MCP Server
=================

MCP Server for exposing Qdrant vector database as knowledge base tools.

This server wraps the existing QdrantKnowledgeTool functionality and
exposes it through the MCP protocol.

Tools Exposed:
- semantic_search: Search knowledge base using semantic similarity
- similar_docs: Find documents similar to a given document
- get_document: Retrieve a specific document by ID

See: docs/architecture/MCP_SPEC.md §6
"""

import os
import logging
from typing import Any, Dict, List, Optional

from ...base_server import BaseMCPServer, ToolNotFoundError, ToolExecutionError
from ...types import MCPTool, MCPResource, MCPServerConfig, ToolRisk

logger = logging.getLogger(__name__)


class QdrantMCPServer(BaseMCPServer):
    """
    MCP Server for Qdrant vector database.

    Provides semantic search capabilities over a knowledge base
    stored in Qdrant.

    Configuration:
        url: Qdrant server URL (default: http://localhost:6333)
        collection: Collection name (default: amazon_knowledge_base)
        top_k: Default number of results (default: 5)
        embedding_model: Embedding model name (default: all-MiniLM-L6-v2)

    Usage:
        server = QdrantMCPServer(config)
        await server.initialize()
        result = await server.handle_tool("semantic_search", {"query": "..."})
    """

    def __init__(self, config: MCPServerConfig):
        super().__init__(config)

        # Configuration with defaults
        self._url = config.config.get("url", "http://localhost:6333")
        self._collection = config.config.get("collection", "amazon_knowledge_base")
        self._top_k = config.config.get("top_k", 5)
        self._embedding_model = config.config.get("embedding_model", "all-MiniLM-L6-v2")

        # Lazy-loaded clients
        self._qdrant = None
        self._embedder = None

    @property
    def server_name(self) -> str:
        return "qdrant-knowledge"

    async def initialize(self) -> None:
        """Initialize Qdrant client and embedder."""
        await super().initialize()

        # Set NO_PROXY for localhost (important for Mac)
        os.environ['NO_PROXY'] = 'localhost,127.0.0.1'
        os.environ['no_proxy'] = 'localhost,127.0.0.1'

        try:
            # Import dependencies
            from qdrant_client import QdrantClient

            # Initialize Qdrant client
            self._qdrant = QdrantClient(url=self._url)

            # Verify collection exists
            collections = self._qdrant.get_collections()
            collection_names = [c.name for c in collections.collections]

            if self._collection not in collection_names:
                logger.warning(
                    f"Collection '{self._collection}' not found. "
                    f"Available: {collection_names}"
                )
            else:
                logger.info(f"Connected to Qdrant collection: {self._collection}")

            # Initialize embedder
            try:
                # Try importing from tools directory
                import sys
                from pathlib import Path
                tools_path = Path(__file__).parent.parent.parent.parent.parent / "domain" / "amazon-growth" / "tools"
                if tools_path.exists():
                    sys.path.insert(0, str(tools_path))
                    from simple_embedder import SimpleEmbedder
                    self._embedder = SimpleEmbedder(model_name=self._embedding_model)
                    logger.info(f"Initialized embedder: {self._embedding_model}")
            except ImportError:
                logger.warning("SimpleEmbedder not available, using fallback")
                self._embedder = None

        except ImportError as e:
            raise ToolExecutionError(
                f"Missing dependency: {e}. Install with: pip install qdrant-client",
                tool_name="initialize"
            )
        except Exception as e:
            raise ToolExecutionError(
                f"Failed to connect to Qdrant: {e}",
                tool_name="initialize"
            )

    async def shutdown(self) -> None:
        """Cleanup resources."""
        self._qdrant = None
        self._embedder = None
        await super().shutdown()

    def list_tools(self) -> List[MCPTool]:
        """Return list of available tools."""
        return [
            MCPTool(
                name="semantic_search",
                description="""Search knowledge base using semantic similarity.

Searches through Amazon advertising strategies, ChatGPT prompts,
operational guides, and best practices.

Best for:
- Finding advertising strategies
- Discovering optimization methods
- Cross-referencing best practices

Input: Query string (Chinese or English)
Output: Top matching documents with relevance scores""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query (e.g., '如何降低ACOS')"
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Number of results (default: 5)",
                            "default": 5
                        }
                    },
                    "required": ["query"]
                },
                risk_level=ToolRisk.READ_ONLY
            ),
            MCPTool(
                name="similar_docs",
                description="""Find documents similar to a given document.

Given a document ID, returns the most similar documents
in the knowledge base.

Input: Document ID
Output: List of similar documents""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "doc_id": {
                            "type": "string",
                            "description": "Document ID to find similar docs for"
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Number of results (default: 5)",
                            "default": 5
                        }
                    },
                    "required": ["doc_id"]
                },
                risk_level=ToolRisk.READ_ONLY
            ),
            MCPTool(
                name="get_document",
                description="""Retrieve a specific document by ID.

Returns the full content and metadata for a document.

Input: Document ID
Output: Document content and metadata""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "doc_id": {
                            "type": "string",
                            "description": "Document ID to retrieve"
                        }
                    },
                    "required": ["doc_id"]
                },
                risk_level=ToolRisk.READ_ONLY
            ),
            MCPTool(
                name="list_collections",
                description="""List all available collections in Qdrant.

Returns collection names and their document counts.""",
                input_schema={
                    "type": "object",
                    "properties": {},
                    "required": []
                },
                risk_level=ToolRisk.READ_ONLY
            ),
        ]

    async def handle_tool(
        self,
        name: str,
        arguments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a tool call."""
        if not self._qdrant:
            raise ToolExecutionError(
                "Qdrant client not initialized. Call initialize() first.",
                tool_name=name
            )

        if name == "semantic_search":
            return await self._semantic_search(
                query=arguments["query"],
                top_k=arguments.get("top_k", self._top_k)
            )
        elif name == "similar_docs":
            return await self._similar_docs(
                doc_id=arguments["doc_id"],
                top_k=arguments.get("top_k", self._top_k)
            )
        elif name == "get_document":
            return await self._get_document(doc_id=arguments["doc_id"])
        elif name == "list_collections":
            return await self._list_collections()
        else:
            raise ToolNotFoundError(f"Unknown tool: {name}")

    async def _semantic_search(
        self,
        query: str,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """Execute semantic search."""
        if not query or not query.strip():
            return {
                "error": "Empty query",
                "results": []
            }

        try:
            # Generate query embedding
            if self._embedder:
                query_vector = self._embedder.embed_text(query)
            else:
                # Fallback: use Qdrant's built-in embedding if available
                raise ToolExecutionError(
                    "Embedder not available",
                    tool_name="semantic_search"
                )

            # Search Qdrant
            response = self._qdrant.query_points(
                collection_name=self._collection,
                query=query_vector,
                limit=top_k,
                with_payload=True
            )

            if not response.points:
                return {
                    "query": query,
                    "results": [],
                    "message": "No matching documents found"
                }

            # Format results
            results = []
            for point in response.points:
                payload = point.payload if hasattr(point, 'payload') else {}
                results.append({
                    "id": str(point.id),
                    "score": round(point.score * 100, 1) if hasattr(point, 'score') else 100,
                    "source_file": payload.get("source_file", "Unknown"),
                    "section_title": payload.get("section_title", "N/A"),
                    "text_preview": payload.get("text_preview", ""),
                    "char_count": payload.get("char_count", 0)
                })

            return {
                "query": query,
                "collection": self._collection,
                "total_results": len(results),
                "results": results
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Search failed: {str(e)}",
                tool_name="semantic_search",
                details={"query": query}
            )

    async def _similar_docs(
        self,
        doc_id: str,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """Find similar documents."""
        try:
            # Get the document's vector
            points = self._qdrant.retrieve(
                collection_name=self._collection,
                ids=[doc_id],
                with_vectors=True
            )

            if not points:
                return {
                    "error": f"Document not found: {doc_id}",
                    "results": []
                }

            # Search for similar
            vector = points[0].vector
            response = self._qdrant.query_points(
                collection_name=self._collection,
                query=vector,
                limit=top_k + 1,  # +1 to exclude self
                with_payload=True
            )

            # Filter out the source document
            results = []
            for point in response.points:
                if str(point.id) != doc_id:
                    payload = point.payload if hasattr(point, 'payload') else {}
                    results.append({
                        "id": str(point.id),
                        "score": round(point.score * 100, 1) if hasattr(point, 'score') else 100,
                        "source_file": payload.get("source_file", "Unknown"),
                        "section_title": payload.get("section_title", "N/A"),
                    })

            return {
                "source_doc_id": doc_id,
                "collection": self._collection,
                "similar_docs": results[:top_k]
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Similar docs search failed: {str(e)}",
                tool_name="similar_docs",
                details={"doc_id": doc_id}
            )

    async def _get_document(self, doc_id: str) -> Dict[str, Any]:
        """Retrieve a document by ID."""
        try:
            points = self._qdrant.retrieve(
                collection_name=self._collection,
                ids=[doc_id],
                with_payload=True
            )

            if not points:
                return {
                    "error": f"Document not found: {doc_id}",
                    "document": None
                }

            point = points[0]
            payload = point.payload if hasattr(point, 'payload') else {}

            return {
                "id": str(point.id),
                "collection": self._collection,
                "document": {
                    "source_file": payload.get("source_file", "Unknown"),
                    "section_title": payload.get("section_title", "N/A"),
                    "text": payload.get("text", payload.get("text_preview", "")),
                    "char_count": payload.get("char_count", 0),
                    "metadata": {
                        k: v for k, v in payload.items()
                        if k not in ["source_file", "section_title", "text", "text_preview", "char_count"]
                    }
                }
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Document retrieval failed: {str(e)}",
                tool_name="get_document",
                details={"doc_id": doc_id}
            )

    async def _list_collections(self) -> Dict[str, Any]:
        """List all collections."""
        try:
            collections = self._qdrant.get_collections()

            result = []
            for col in collections.collections:
                # Get collection info
                info = self._qdrant.get_collection(col.name)
                # Handle API differences between Qdrant client versions
                vectors_count = getattr(info, 'vectors_count', None)
                if vectors_count is None:
                    vectors_count = getattr(info, 'points_count', 0)
                result.append({
                    "name": col.name,
                    "vectors_count": vectors_count,
                    "points_count": getattr(info, 'points_count', 0),
                })

            return {
                "collections": result,
                "total": len(result)
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Failed to list collections: {str(e)}",
                tool_name="list_collections"
            )

    def list_resources(self) -> List[MCPResource]:
        """Return list of available resources."""
        return [
            MCPResource(
                uri=f"qdrant://{self._collection}/schema",
                name="Collection Schema",
                description=f"Schema for collection '{self._collection}'"
            )
        ]
