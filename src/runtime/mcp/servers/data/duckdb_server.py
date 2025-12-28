"""
DuckDB MCP Server
=================

MCP Server for exposing DuckDB data warehouse as query tools.

This server provides read-only SQL access to the LiYe OS data lake,
enabling agents to query keyword metrics, sales data, and analytics.

Tools Exposed:
- execute_query: Run SQL queries (read-only)
- get_schema: Get table schema information
- list_tables: List available tables
- get_sample: Get sample rows from a table

See: docs/architecture/MCP_SPEC.md §6
"""

import logging
import re
from typing import Any, Dict, List, Optional

from ...base_server import BaseMCPServer, ToolNotFoundError, ToolExecutionError
from ...types import MCPTool, MCPResource, MCPServerConfig, ToolRisk

logger = logging.getLogger(__name__)


class DuckDBMCPServer(BaseMCPServer):
    """
    MCP Server for DuckDB data warehouse.

    Provides read-only SQL query capabilities over the data lake.

    Configuration:
        database: Path to DuckDB database file
        read_only: Force read-only mode (default: True)
        max_rows: Maximum rows per query (default: 1000)

    Usage:
        server = DuckDBMCPServer(config)
        await server.initialize()
        result = await server.handle_tool("execute_query", {"sql": "SELECT ..."})
    """

    # SQL patterns that modify data (blocked in read-only mode)
    WRITE_PATTERNS = [
        r'\bINSERT\b',
        r'\bUPDATE\b',
        r'\bDELETE\b',
        r'\bDROP\b',
        r'\bCREATE\b',
        r'\bALTER\b',
        r'\bTRUNCATE\b',
        r'\bMERGE\b',
    ]

    def __init__(self, config: MCPServerConfig):
        super().__init__(config)

        # Configuration with defaults
        self._database = config.config.get("database", "data/warehouse.duckdb")
        self._read_only = config.config.get("read_only", True)
        self._max_rows = config.config.get("max_rows", 1000)

        # DuckDB connection
        self._conn = None

    @property
    def server_name(self) -> str:
        return "duckdb-datalake"

    async def initialize(self) -> None:
        """Initialize DuckDB connection."""
        await super().initialize()

        try:
            import duckdb

            # Connect to database
            self._conn = duckdb.connect(
                self._database,
                read_only=self._read_only
            )
            logger.info(f"Connected to DuckDB: {self._database}")

            # Verify connection
            result = self._conn.execute("SELECT 1").fetchone()
            if result[0] != 1:
                raise ToolExecutionError("DuckDB connection test failed")

        except ImportError:
            raise ToolExecutionError(
                "DuckDB not installed. Install with: pip install duckdb",
                tool_name="initialize"
            )
        except Exception as e:
            raise ToolExecutionError(
                f"Failed to connect to DuckDB: {e}",
                tool_name="initialize"
            )

    async def shutdown(self) -> None:
        """Close DuckDB connection."""
        if self._conn:
            self._conn.close()
            self._conn = None
        await super().shutdown()

    def list_tools(self) -> List[MCPTool]:
        """Return list of available tools."""
        return [
            MCPTool(
                name="execute_query",
                description="""Execute a read-only SQL query on the data warehouse.

Returns query results as structured data. Only SELECT queries allowed.

Best for:
- Analyzing keyword metrics
- Aggregating sales data
- Finding opportunities

Example: SELECT keyword, search_volume FROM fact_keyword_snapshot LIMIT 10""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "sql": {
                            "type": "string",
                            "description": "SQL query to execute (SELECT only)"
                        },
                        "max_rows": {
                            "type": "integer",
                            "description": f"Maximum rows to return (default: {self._max_rows})",
                            "default": self._max_rows
                        }
                    },
                    "required": ["sql"]
                },
                risk_level=ToolRisk.READ_ONLY
            ),
            MCPTool(
                name="get_schema",
                description="""Get the schema (columns and types) for a table.

Returns column names, data types, and nullable status.""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "table_name": {
                            "type": "string",
                            "description": "Name of the table"
                        }
                    },
                    "required": ["table_name"]
                },
                risk_level=ToolRisk.READ_ONLY
            ),
            MCPTool(
                name="list_tables",
                description="""List all tables in the database.

Returns table names and row counts.""",
                input_schema={
                    "type": "object",
                    "properties": {},
                    "required": []
                },
                risk_level=ToolRisk.READ_ONLY
            ),
            MCPTool(
                name="get_sample",
                description="""Get sample rows from a table.

Useful for understanding table structure and data format.""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "table_name": {
                            "type": "string",
                            "description": "Name of the table"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Number of rows (default: 5)",
                            "default": 5
                        }
                    },
                    "required": ["table_name"]
                },
                risk_level=ToolRisk.READ_ONLY
            ),
            MCPTool(
                name="describe_stats",
                description="""Get statistical summary of numeric columns in a table.

Returns min, max, avg, count for each numeric column.""",
                input_schema={
                    "type": "object",
                    "properties": {
                        "table_name": {
                            "type": "string",
                            "description": "Name of the table"
                        }
                    },
                    "required": ["table_name"]
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
        if not self._conn:
            raise ToolExecutionError(
                "DuckDB not connected. Call initialize() first.",
                tool_name=name
            )

        if name == "execute_query":
            return await self._execute_query(
                sql=arguments["sql"],
                max_rows=arguments.get("max_rows", self._max_rows)
            )
        elif name == "get_schema":
            return await self._get_schema(table_name=arguments["table_name"])
        elif name == "list_tables":
            return await self._list_tables()
        elif name == "get_sample":
            return await self._get_sample(
                table_name=arguments["table_name"],
                limit=arguments.get("limit", 5)
            )
        elif name == "describe_stats":
            return await self._describe_stats(table_name=arguments["table_name"])
        else:
            raise ToolNotFoundError(f"Unknown tool: {name}")

    def _is_write_query(self, sql: str) -> bool:
        """Check if SQL query modifies data."""
        sql_upper = sql.upper()
        for pattern in self.WRITE_PATTERNS:
            if re.search(pattern, sql_upper, re.IGNORECASE):
                return True
        return False

    async def _execute_query(
        self,
        sql: str,
        max_rows: int = 1000
    ) -> Dict[str, Any]:
        """Execute a SQL query."""
        # Validate query
        if not sql or not sql.strip():
            return {"error": "Empty query", "results": []}

        if self._read_only and self._is_write_query(sql):
            return {
                "error": "Write operations not allowed in read-only mode",
                "query": sql
            }

        try:
            # Add LIMIT if not present
            sql_lower = sql.lower().strip()
            if 'limit' not in sql_lower:
                sql = f"{sql.rstrip(';')} LIMIT {max_rows}"

            # Execute query
            result = self._conn.execute(sql)
            columns = [desc[0] for desc in result.description]
            rows = result.fetchall()

            # Convert to list of dicts
            data = []
            for row in rows[:max_rows]:
                data.append(dict(zip(columns, row)))

            return {
                "query": sql,
                "columns": columns,
                "row_count": len(data),
                "data": data
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Query execution failed: {str(e)}",
                tool_name="execute_query",
                details={"query": sql}
            )

    async def _get_schema(self, table_name: str) -> Dict[str, Any]:
        """Get table schema."""
        try:
            # Sanitize table name
            table_name = table_name.replace("'", "''")

            # Get column info using PRAGMA
            result = self._conn.execute(f"PRAGMA table_info('{table_name}')").fetchall()

            if not result:
                return {
                    "error": f"Table not found: {table_name}",
                    "columns": []
                }

            columns = []
            for row in result:
                columns.append({
                    "name": row[1],
                    "type": row[2],
                    "nullable": not row[3],
                    "default": row[4],
                    "primary_key": bool(row[5])
                })

            return {
                "table": table_name,
                "column_count": len(columns),
                "columns": columns
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Schema retrieval failed: {str(e)}",
                tool_name="get_schema",
                details={"table": table_name}
            )

    async def _list_tables(self) -> Dict[str, Any]:
        """List all tables."""
        try:
            result = self._conn.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'main'
            """).fetchall()

            tables = []
            for row in result:
                table_name = row[0]
                # Get row count
                try:
                    count_result = self._conn.execute(
                        f"SELECT COUNT(*) FROM {table_name}"
                    ).fetchone()
                    row_count = count_result[0]
                except:
                    row_count = -1

                tables.append({
                    "name": table_name,
                    "row_count": row_count
                })

            return {
                "database": self._database,
                "table_count": len(tables),
                "tables": tables
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Table listing failed: {str(e)}",
                tool_name="list_tables"
            )

    async def _get_sample(
        self,
        table_name: str,
        limit: int = 5
    ) -> Dict[str, Any]:
        """Get sample rows from a table."""
        try:
            # Sanitize
            table_name = table_name.replace("'", "''")
            limit = min(limit, 100)  # Cap at 100

            result = self._conn.execute(
                f"SELECT * FROM {table_name} LIMIT {limit}"
            )
            columns = [desc[0] for desc in result.description]
            rows = result.fetchall()

            data = []
            for row in rows:
                data.append(dict(zip(columns, row)))

            return {
                "table": table_name,
                "columns": columns,
                "sample_count": len(data),
                "data": data
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Sample retrieval failed: {str(e)}",
                tool_name="get_sample",
                details={"table": table_name}
            )

    async def _describe_stats(self, table_name: str) -> Dict[str, Any]:
        """Get statistical summary of numeric columns."""
        try:
            # Sanitize
            table_name = table_name.replace("'", "''")

            # Get schema first to find numeric columns
            schema = await self._get_schema(table_name)
            if "error" in schema:
                return schema

            numeric_types = ['INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'NUMERIC', 'REAL']
            numeric_cols = [
                col["name"] for col in schema["columns"]
                if any(t in col["type"].upper() for t in numeric_types)
            ]

            if not numeric_cols:
                return {
                    "table": table_name,
                    "message": "No numeric columns found",
                    "stats": []
                }

            # Build stats query
            stats_parts = []
            for col in numeric_cols:
                stats_parts.append(f"""
                    '{col}' as column_name,
                    MIN({col}) as min_value,
                    MAX({col}) as max_value,
                    AVG({col}) as avg_value,
                    COUNT({col}) as non_null_count
                """)

            # Execute for each column (DuckDB doesn't support UNION in subquery well)
            stats = []
            for col in numeric_cols:
                result = self._conn.execute(f"""
                    SELECT
                        MIN({col}) as min_value,
                        MAX({col}) as max_value,
                        AVG({col}) as avg_value,
                        COUNT({col}) as non_null_count
                    FROM {table_name}
                """).fetchone()

                stats.append({
                    "column": col,
                    "min": result[0],
                    "max": result[1],
                    "avg": round(result[2], 4) if result[2] else None,
                    "count": result[3]
                })

            return {
                "table": table_name,
                "numeric_columns": len(stats),
                "stats": stats
            }

        except Exception as e:
            raise ToolExecutionError(
                f"Stats calculation failed: {str(e)}",
                tool_name="describe_stats",
                details={"table": table_name}
            )

    def list_resources(self) -> List[MCPResource]:
        """Return list of available resources."""
        return [
            MCPResource(
                uri=f"duckdb://{self._database}/schema",
                name="Database Schema",
                description=f"Schema for database '{self._database}'"
            )
        ]
