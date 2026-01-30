# CrewAI + Governance Kernel Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect CrewAI → MCP execution chain to LiYe Governance Kernel, enabling Gate → Execute → Verdict → Replay with evidence package generation.

**Architecture:** Python `GovernedMCPToolProvider` wraps existing `MCPToolProvider`. Each tool call goes through a Node.js governance bridge (subprocess) that runs the JavaScript governance kernel. Feature flag `LIYE_GOVERNANCE_ENABLED` controls activation.

**Tech Stack:** Python 3.10+, Node.js 20+, CrewAI 1.7.0, existing JS Governance Kernel

---

## Task 1: Create Governance Bridge Script (Node.js)

**Files:**
- Create: `src/runtime/mcp/governance_bridge.mjs`

**Step 1: Write the bridge script**

```javascript
#!/usr/bin/env node
/**
 * Governance Bridge for Python Integration
 *
 * Provides JSON-in/JSON-out interface to governance kernel.
 * Called via subprocess from Python GovernedMCPToolProvider.
 *
 * Usage:
 *   echo '{"action":"gate","input":{...}}' | node governance_bridge.mjs
 */

import { runGovernanceCycle } from '../../governance/index.mjs';
import { gate } from '../../governance/gate.mjs';
import { createTrace } from '../../governance/trace/trace_writer.mjs';
import { replay } from '../../governance/replay.mjs';
import { generateVerdict, formatVerdictMarkdown } from '../../governance/verdict.mjs';

async function main() {
  // Read JSON from stdin
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    console.error(JSON.stringify({ error: 'No input provided' }));
    process.exit(1);
  }

  let request;
  try {
    request = JSON.parse(input);
  } catch (e) {
    console.error(JSON.stringify({ error: `Invalid JSON: ${e.message}` }));
    process.exit(1);
  }

  const { action, input: actionInput, trace_id } = request;

  try {
    let result;

    switch (action) {
      case 'gate': {
        // Quick gate check only
        const trace = createTrace(undefined, '.liye/traces');
        const gateReport = gate(actionInput, { trace });
        result = {
          trace_id: trace.trace_id,
          gate_report: gateReport,
          decision: gateReport.decision
        };
        break;
      }

      case 'full_cycle': {
        // Full governance cycle: gate → verdict → replay
        const cycleResult = await runGovernanceCycle(actionInput, {
          baseDir: '.liye/traces'
        });
        result = {
          trace_id: cycleResult.trace_id,
          trace_dir: cycleResult.trace_dir,
          gate_report: cycleResult.gateReport,
          decision: cycleResult.gateReport.decision,
          verdict: cycleResult.verdict,
          replay: {
            status: cycleResult.replayResult.status,
            pass: cycleResult.replayResult.status === 'PASS',
            checks: cycleResult.replayResult.checks
          }
        };
        break;
      }

      case 'replay': {
        // Replay existing trace
        const replayResult = replay(trace_id, {
          baseDir: '.liye/traces',
          writeResults: true
        });
        result = {
          trace_id,
          replay: {
            status: replayResult.status,
            pass: replayResult.status === 'PASS',
            event_count: replayResult.event_count,
            checks: replayResult.checks,
            errors: replayResult.errors.slice(0, 10)
          }
        };
        break;
      }

      default:
        result = { error: `Unknown action: ${action}` };
    }

    console.log(JSON.stringify(result));
  } catch (e) {
    console.log(JSON.stringify({
      error: e.message,
      stack: e.stack
    }));
    process.exit(1);
  }
}

main();
```

**Step 2: Test the bridge manually**

Run:
```bash
cd /Users/liye/github/liye_os
echo '{"action":"gate","input":{"task":"test","proposed_actions":[{"action_type":"read"}]}}' | node src/runtime/mcp/governance_bridge.mjs
```

Expected: JSON output with `trace_id`, `gate_report`, `decision`

**Step 3: Commit**

```bash
git add src/runtime/mcp/governance_bridge.mjs
git commit -m "feat(governance): add JS bridge for Python integration"
```

---

## Task 2: Create GovernedMCPToolProvider

**Files:**
- Create: `src/runtime/mcp/adapters/governed_tool_provider.py`

**Step 1: Write the governed provider**

```python
"""
Governed MCP Tool Provider
==========================

Extends MCPToolProvider with LiYe Governance Kernel integration.
Every tool call goes through: Gate → Execute → Verdict → Replay

Enable with: LIYE_GOVERNANCE_ENABLED=1

See: docs/integrations/CREWAI_GOVERNANCE_INTEGRATION_V1.md
"""

import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from .crewai_adapter import MCPToolProvider, MCPToolWrapper, create_crewai_tool, _run_async

logger = logging.getLogger(__name__)

# Feature flag
GOVERNANCE_ENABLED = os.environ.get('LIYE_GOVERNANCE_ENABLED', '0') == '1'

# Path to governance bridge
BRIDGE_SCRIPT = Path(__file__).parent.parent / 'governance_bridge.mjs'


class GovernanceError(Exception):
    """Raised when governance check fails."""
    pass


class GovernanceBridge:
    """
    Bridge to JavaScript Governance Kernel via subprocess.

    Provides Fail Closed semantics: any error → BLOCK.
    """

    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self._bridge_path = str(BRIDGE_SCRIPT)

    def _call_bridge(self, action: str, input_data: Dict, trace_id: Optional[str] = None) -> Dict:
        """Call governance bridge via subprocess."""
        request = {
            'action': action,
            'input': input_data
        }
        if trace_id:
            request['trace_id'] = trace_id

        try:
            result = subprocess.run(
                ['node', self._bridge_path],
                input=json.dumps(request),
                capture_output=True,
                text=True,
                timeout=self.timeout,
                cwd=str(Path(__file__).parent.parent.parent.parent.parent)  # repo root
            )

            if result.returncode != 0:
                stderr = result.stderr.strip()
                logger.error(f"Governance bridge error: {stderr}")
                # Fail Closed: return UNKNOWN on error
                return {
                    'error': f'Bridge error: {stderr}',
                    'decision': 'UNKNOWN'
                }

            return json.loads(result.stdout)

        except subprocess.TimeoutExpired:
            logger.error(f"Governance bridge timeout after {self.timeout}s")
            return {
                'error': 'Governance timeout',
                'decision': 'UNKNOWN'
            }
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON from bridge: {e}")
            return {
                'error': f'Invalid response: {e}',
                'decision': 'UNKNOWN'
            }
        except Exception as e:
            logger.error(f"Governance bridge exception: {e}")
            return {
                'error': str(e),
                'decision': 'UNKNOWN'
            }

    def run_full_cycle(
        self,
        task: str,
        proposed_actions: List[Dict],
        context: Optional[Dict] = None
    ) -> Dict:
        """
        Run full governance cycle: Gate → Verdict → Replay.

        Returns:
            {
                'trace_id': str,
                'decision': 'ALLOW'|'BLOCK'|'DEGRADE'|'UNKNOWN',
                'gate_report': {...},
                'verdict': {...},
                'replay': {'status': 'PASS'|'FAIL', ...}
            }
        """
        input_data = {
            'task': task,
            'proposed_actions': proposed_actions,
            'context': context or {}
        }
        return self._call_bridge('full_cycle', input_data)

    def gate_only(
        self,
        task: str,
        proposed_actions: List[Dict],
        context: Optional[Dict] = None
    ) -> Dict:
        """Quick gate check without full cycle."""
        input_data = {
            'task': task,
            'proposed_actions': proposed_actions,
            'context': context or {}
        }
        return self._call_bridge('gate', input_data)

    def replay(self, trace_id: str) -> Dict:
        """Replay and verify existing trace."""
        return self._call_bridge('replay', {}, trace_id=trace_id)


class GovernedToolWrapper(MCPToolWrapper):
    """
    Tool wrapper that enforces governance before execution.

    Flow:
    1. governance_gate → decision
    2. BLOCK/UNKNOWN → reject with trace_id
    3. ALLOW/DEGRADE → execute tool
    4. governance_verdict + replay
    5. Return result with trace_id
    """

    def __init__(self, *args, governance: GovernanceBridge, **kwargs):
        super().__init__(*args, **kwargs)
        self._governance = governance

    def _run(self, *args, **kwargs) -> str:
        """Execute with governance enforcement."""
        import json as json_module

        # Parse input (same as parent)
        parsed_kwargs = {}
        if args and not kwargs:
            first_arg = args[0]
            if isinstance(first_arg, str):
                try:
                    parsed_kwargs = json_module.loads(first_arg)
                except json_module.JSONDecodeError:
                    schema = self._tool.input_schema
                    if schema and schema.get('required'):
                        parsed_kwargs = {schema['required'][0]: first_arg}
                    else:
                        parsed_kwargs = {'query': first_arg}
            elif isinstance(first_arg, dict):
                parsed_kwargs = first_arg
        else:
            parsed_kwargs = self._parse_input(kwargs)

        # Build proposed action
        proposed_action = {
            'action_type': self._infer_action_type(),
            'tool': self._tool.name,
            'server': self._server_name,
            'arguments': parsed_kwargs
        }

        # Build task description
        task = f"Execute {self._server_name}/{self._tool.name}"
        if parsed_kwargs.get('query'):
            task += f": {parsed_kwargs['query'][:100]}"

        # Run governance cycle
        logger.info(f"Running governance for {self._tool.name}")
        gov_result = self._governance.run_full_cycle(
            task=task,
            proposed_actions=[proposed_action],
            context={'server': self._server_name, 'tool': self._tool.name}
        )

        trace_id = gov_result.get('trace_id', 'unknown')
        decision = gov_result.get('decision', 'UNKNOWN')

        # Fail Closed: BLOCK or UNKNOWN → reject
        if decision in ('BLOCK', 'UNKNOWN'):
            error_msg = f"Governance {decision}: {self._tool.name}"
            if gov_result.get('gate_report', {}).get('risks'):
                risks = gov_result['gate_report']['risks']
                error_msg += f" (risks: {[r.get('type') for r in risks]})"
            error_msg += f" [trace_id: {trace_id}]"
            logger.warning(error_msg)
            return json_module.dumps({
                'ok': False,
                'error': error_msg,
                'trace_id': trace_id,
                'governance': {'decision': decision}
            })

        # ALLOW or DEGRADE → execute
        logger.info(f"Governance {decision} for {self._tool.name}, executing")
        try:
            result = _run_async(
                self._server.handle_tool(self._tool.name, parsed_kwargs)
            )

            # Format response with governance metadata
            if isinstance(result, dict):
                result['_governance'] = {
                    'trace_id': trace_id,
                    'decision': decision,
                    'replay_status': gov_result.get('replay', {}).get('status', 'UNKNOWN')
                }
                return self._format_result(result)

            return json_module.dumps({
                'ok': True,
                'result': str(result),
                'trace_id': trace_id,
                'governance': {'decision': decision}
            })

        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            return json_module.dumps({
                'ok': False,
                'error': str(e),
                'trace_id': trace_id,
                'governance': {'decision': decision, 'execution_failed': True}
            })

    def _infer_action_type(self) -> str:
        """Infer action type from tool name."""
        name = self._tool.name.lower()
        if any(x in name for x in ['search', 'query', 'get', 'list', 'read']):
            return 'read'
        if any(x in name for x in ['delete', 'remove', 'drop']):
            return 'delete'
        if any(x in name for x in ['write', 'create', 'insert', 'update', 'put']):
            return 'write'
        if any(x in name for x in ['send', 'email', 'notify', 'publish']):
            return 'send'
        return 'execute'


def create_governed_crewai_tool(wrapper: GovernedToolWrapper) -> Any:
    """Create CrewAI BaseTool from GovernedToolWrapper."""
    try:
        from crewai.tools import BaseTool
        from pydantic import PrivateAttr, Field, create_model
        from typing import Optional, Type
    except ImportError:
        logger.warning("CrewAI not installed, returning wrapper directly")
        return wrapper

    captured_wrapper = wrapper

    # Build args_schema from input_schema (same as crewai_adapter)
    args_schema_class = None
    input_schema = wrapper._tool.input_schema
    if input_schema and input_schema.get('properties'):
        fields = {}
        properties = input_schema.get('properties', {})
        required = input_schema.get('required', [])

        type_mapping = {
            'string': str, 'integer': int, 'number': float,
            'boolean': bool, 'array': list, 'object': dict,
        }

        for prop_name, prop_def in properties.items():
            prop_type = prop_def.get('type', 'string')
            prop_desc = prop_def.get('description', '')
            prop_default = prop_def.get('default')
            python_type = type_mapping.get(prop_type, str)

            if prop_name in required:
                if prop_default is not None:
                    fields[prop_name] = (python_type, Field(default=prop_default, description=prop_desc))
                else:
                    fields[prop_name] = (python_type, Field(..., description=prop_desc))
            else:
                fields[prop_name] = (Optional[python_type], Field(default=prop_default, description=prop_desc))

        if fields:
            schema_name = f"{wrapper.name.replace('-', '_').replace('.', '_')}GovernedSchema"
            args_schema_class = create_model(schema_name, **fields)

    tool_name = captured_wrapper.name
    tool_desc = f"[Governed] {captured_wrapper.description}"

    class GovernedDynamicMCPTool(BaseTool):
        _mcp_wrapper: GovernedToolWrapper = PrivateAttr(default=None)

        def _run(self, *args, **kwargs) -> str:
            return self._mcp_wrapper._run(*args, **kwargs)

    GovernedDynamicMCPTool.__name__ = f"Governed_MCP_{captured_wrapper.name.replace('-', '_').replace('.', '_')}"

    init_kwargs = {'name': tool_name, 'description': tool_desc}
    if args_schema_class:
        init_kwargs['args_schema'] = args_schema_class

    instance = GovernedDynamicMCPTool(**init_kwargs)
    instance._mcp_wrapper = captured_wrapper

    return instance


class GovernedMCPToolProvider(MCPToolProvider):
    """
    MCP Tool Provider with Governance Kernel enforcement.

    Every tool call goes through: Gate → Execute → Verdict → Replay

    Usage:
        # Enable governance
        os.environ['LIYE_GOVERNANCE_ENABLED'] = '1'

        # Create provider
        provider = GovernedMCPToolProvider(registry)

        # Get governed tools
        tools = provider.get_tools(["qdrant-knowledge"])

        # Use in agent - every call now produces evidence package
        agent = Agent(tools=tools, ...)
    """

    def __init__(self, registry, governance_timeout: int = 30):
        super().__init__(registry)
        self._governance = GovernanceBridge(timeout=governance_timeout)

    def _load_server_tools(self, server_name: str) -> List[Any]:
        """Load tools with governance wrapper."""
        server = self._registry.get_server(server_name)

        if not server:
            logger.warning(f"Server not found or disabled: {server_name}")
            return []

        if server_name not in self._initialized_servers:
            try:
                _run_async(server.initialize())
                self._initialized_servers.add(server_name)
            except Exception as e:
                logger.error(f"Failed to initialize server {server_name}: {e}")
                return []

        tools = []
        for mcp_tool in server.list_tools():
            # Use governed wrapper
            wrapper = GovernedToolWrapper(
                server, mcp_tool, server_name,
                governance=self._governance
            )
            crewai_tool = create_governed_crewai_tool(wrapper)
            tools.append(crewai_tool)
            logger.debug(f"Wrapped governed tool: {mcp_tool.name} from {server_name}")

        return tools


def get_tool_provider(registry, governed: Optional[bool] = None):
    """
    Factory function to get appropriate tool provider.

    Args:
        registry: MCPRegistry instance
        governed: Force governed mode (None = use env var)

    Returns:
        MCPToolProvider or GovernedMCPToolProvider
    """
    use_governed = governed if governed is not None else GOVERNANCE_ENABLED

    if use_governed:
        logger.info("Using GovernedMCPToolProvider (LIYE_GOVERNANCE_ENABLED=1)")
        return GovernedMCPToolProvider(registry)
    else:
        logger.info("Using MCPToolProvider (governance disabled)")
        return MCPToolProvider(registry)
```

**Step 2: Verify syntax**

Run:
```bash
cd /Users/liye/github/liye_os
python -m py_compile src/runtime/mcp/adapters/governed_tool_provider.py
```

Expected: No output (success)

**Step 3: Commit**

```bash
git add src/runtime/mcp/adapters/governed_tool_provider.py
git commit -m "feat(crewai): add GovernedMCPToolProvider with governance enforcement"
```

---

## Task 3: Update Adapter Exports

**Files:**
- Modify: `src/runtime/mcp/adapters/__init__.py`

**Step 1: Read current exports**

Run: Read `src/runtime/mcp/adapters/__init__.py`

**Step 2: Add governed exports**

Add to `__init__.py`:
```python
from .governed_tool_provider import (
    GovernedMCPToolProvider,
    GovernedToolWrapper,
    GovernanceBridge,
    get_tool_provider,
    GOVERNANCE_ENABLED
)
```

**Step 3: Verify import**

Run:
```bash
cd /Users/liye/github/liye_os
python -c "from src.runtime.mcp.adapters import GovernedMCPToolProvider; print('OK')"
```

Expected: `OK`

**Step 4: Commit**

```bash
git add src/runtime/mcp/adapters/__init__.py
git commit -m "feat(crewai): export GovernedMCPToolProvider from adapters"
```

---

## Task 4: Create Dependency File

**Files:**
- Create: `src/runtime/requirements.crewai.txt`

**Step 1: Write requirements file**

```text
# CrewAI optional dependencies for LiYe OS
# Install with: pip install -r src/runtime/requirements.crewai.txt

crewai==1.7.0
```

**Step 2: Commit**

```bash
git add src/runtime/requirements.crewai.txt
git commit -m "docs(deps): add optional crewai requirements file"
```

---

## Task 5: Create Demo Directory Structure

**Files:**
- Create: `examples/crewai/governed-tool-call/input_allow.json`
- Create: `examples/crewai/governed-tool-call/input_block.json`
- Create: `examples/crewai/governed-tool-call/run_demo.py`

**Step 1: Create demo directory**

Run:
```bash
mkdir -p examples/crewai/governed-tool-call
```

**Step 2: Create ALLOW case input**

```json
{
  "task": "Search knowledge base for product optimization",
  "context": {
    "user": "operator",
    "environment": "demo"
  },
  "proposed_actions": [
    {
      "action_type": "read",
      "tool": "semantic_search",
      "server": "qdrant-knowledge",
      "arguments": {
        "query": "ACOS optimization strategies"
      }
    }
  ]
}
```

**Step 3: Create BLOCK case input**

```json
{
  "task": "Delete all files in system directory",
  "context": {
    "user": "unknown",
    "environment": "demo"
  },
  "proposed_actions": [
    {
      "action_type": "delete",
      "tool": "filesystem_delete",
      "server": "filesystem",
      "arguments": {
        "path": "/etc/passwd"
      }
    }
  ]
}
```

**Step 4: Create demo script**

```python
#!/usr/bin/env python3
"""
Governed Tool Call Demo

Demonstrates:
1. ALLOW case - safe read operation → executes with evidence
2. BLOCK case - dangerous delete → rejected with trace_id

Usage:
    python examples/crewai/governed-tool-call/run_demo.py
"""

import json
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from src.runtime.mcp.adapters.governed_tool_provider import GovernanceBridge

def main():
    print("=" * 60)
    print("Governed Tool Call Demo")
    print("=" * 60)
    print()

    bridge = GovernanceBridge(timeout=30)
    demo_dir = Path(__file__).parent

    # Test 1: ALLOW case
    print("Test 1: ALLOW case (safe read operation)")
    print("-" * 40)

    with open(demo_dir / "input_allow.json") as f:
        allow_input = json.load(f)

    result = bridge.run_full_cycle(
        task=allow_input["task"],
        proposed_actions=allow_input["proposed_actions"],
        context=allow_input.get("context", {})
    )

    print(f"  Decision: {result.get('decision')}")
    print(f"  Trace ID: {result.get('trace_id')}")
    print(f"  Replay:   {result.get('replay', {}).get('status')}")

    if result.get("decision") not in ("ALLOW", "DEGRADE"):
        print("  ❌ Expected ALLOW or DEGRADE")
        return False
    print("  ✓ ALLOW case passed")
    print()

    # Test 2: BLOCK case
    print("Test 2: BLOCK case (dangerous delete operation)")
    print("-" * 40)

    with open(demo_dir / "input_block.json") as f:
        block_input = json.load(f)

    result = bridge.run_full_cycle(
        task=block_input["task"],
        proposed_actions=block_input["proposed_actions"],
        context=block_input.get("context", {})
    )

    print(f"  Decision: {result.get('decision')}")
    print(f"  Trace ID: {result.get('trace_id')}")
    print(f"  Replay:   {result.get('replay', {}).get('status')}")

    if result.get("decision") != "BLOCK":
        print("  ❌ Expected BLOCK")
        return False
    print("  ✓ BLOCK case passed")
    print()

    # Verify evidence packages exist
    print("Verifying evidence packages...")
    traces_dir = project_root / ".liye" / "traces"
    if traces_dir.exists():
        traces = list(traces_dir.iterdir())
        print(f"  Found {len(traces)} trace(s) in {traces_dir}")
        for trace_dir in traces[-2:]:  # Show last 2
            print(f"    → {trace_dir.name}/")
            for f in trace_dir.iterdir():
                print(f"      ├── {f.name}")

    print()
    print("=" * 60)
    print("✅ Demo completed successfully!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
```

**Step 5: Run demo**

Run:
```bash
cd /Users/liye/github/liye_os
python examples/crewai/governed-tool-call/run_demo.py
```

Expected: Both ALLOW and BLOCK cases pass, evidence packages generated

**Step 6: Commit**

```bash
git add examples/crewai/governed-tool-call/
git commit -m "feat(demo): add CrewAI governed tool call demo"
```

---

## Task 6: Create Smoke Test

**Files:**
- Create: `.claude/scripts/crewai_governance_smoke_test.py`

**Step 1: Write smoke test**

```python
#!/usr/bin/env python3
"""
CrewAI Governance Smoke Test

Validates:
1. GovernanceBridge can call JS governance kernel
2. ALLOW decisions allow execution
3. BLOCK decisions prevent execution (Fail Closed)
4. Evidence packages are generated
5. Replay passes

Usage:
    python .claude/scripts/crewai_governance_smoke_test.py
"""

import json
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

TRACE_DIR = project_root / ".liye" / "traces"

passed = 0
failed = 0


def assert_true(condition: bool, message: str):
    global passed, failed
    if condition:
        print(f"  ✓ {message}")
        passed += 1
    else:
        print(f"  ✗ {message}")
        failed += 1


def test_bridge_import():
    """Test 1: Can import GovernanceBridge"""
    print("Test 1: Import GovernanceBridge")
    try:
        from src.runtime.mcp.adapters.governed_tool_provider import GovernanceBridge
        assert_true(True, "GovernanceBridge imported")
        return GovernanceBridge
    except ImportError as e:
        assert_true(False, f"Import failed: {e}")
        return None


def test_bridge_script_exists():
    """Test 2: Bridge script exists"""
    print("\nTest 2: Bridge script exists")
    bridge_path = project_root / "src" / "runtime" / "mcp" / "governance_bridge.mjs"
    assert_true(bridge_path.exists(), f"governance_bridge.mjs exists at {bridge_path}")


def test_allow_case(BridgeClass):
    """Test 3: ALLOW case"""
    print("\nTest 3: ALLOW case (safe read)")
    if not BridgeClass:
        assert_true(False, "BridgeClass not available")
        return None

    bridge = BridgeClass(timeout=30)
    result = bridge.run_full_cycle(
        task="Search knowledge base",
        proposed_actions=[{
            "action_type": "read",
            "tool": "semantic_search"
        }],
        context={"environment": "test"}
    )

    assert_true("trace_id" in result, "Has trace_id")
    assert_true(result.get("decision") in ("ALLOW", "DEGRADE"),
                f"Decision is ALLOW or DEGRADE (got: {result.get('decision')})")
    assert_true(result.get("replay", {}).get("status") == "PASS",
                f"Replay PASS (got: {result.get('replay', {}).get('status')})")

    return result.get("trace_id")


def test_block_case(BridgeClass):
    """Test 4: BLOCK case"""
    print("\nTest 4: BLOCK case (dangerous delete)")
    if not BridgeClass:
        assert_true(False, "BridgeClass not available")
        return None

    bridge = BridgeClass(timeout=30)
    result = bridge.run_full_cycle(
        task="Delete system files",
        proposed_actions=[{
            "action_type": "delete",
            "tool": "filesystem_delete",
            "resource": "/etc/passwd"
        }],
        context={"environment": "test"}
    )

    assert_true("trace_id" in result, "Has trace_id")
    assert_true(result.get("decision") == "BLOCK",
                f"Decision is BLOCK (got: {result.get('decision')})")
    assert_true(result.get("replay", {}).get("status") == "PASS",
                f"Replay PASS (got: {result.get('replay', {}).get('status')})")

    return result.get("trace_id")


def test_evidence_package(trace_id: str):
    """Test 5: Evidence package structure"""
    print(f"\nTest 5: Evidence package for {trace_id}")
    if not trace_id:
        assert_true(False, "No trace_id to verify")
        return

    trace_dir = TRACE_DIR / trace_id
    assert_true(trace_dir.exists(), f"Trace directory exists")

    if trace_dir.exists():
        files = list(trace_dir.iterdir())
        file_names = [f.name for f in files]

        assert_true("events.ndjson" in file_names, "Has events.ndjson")
        assert_true("verdict.json" in file_names, "Has verdict.json")
        assert_true("verdict.md" in file_names, "Has verdict.md")
        assert_true("replay.json" in file_names, "Has replay.json")


def test_fail_closed(BridgeClass):
    """Test 6: Fail Closed behavior"""
    print("\nTest 6: Fail Closed (UNKNOWN → no execution)")
    if not BridgeClass:
        assert_true(False, "BridgeClass not available")
        return

    bridge = BridgeClass(timeout=30)
    # Send action with no context - should still produce trace
    result = bridge.run_full_cycle(
        task="Unknown risky operation",
        proposed_actions=[{
            "action_type": "send",
            "tool": "email_sender",
            "resource": "external"
        }],
        context={}
    )

    decision = result.get("decision")
    assert_true(decision in ("BLOCK", "UNKNOWN", "DEGRADE"),
                f"Risky action not blindly ALLOWED (got: {decision})")
    assert_true("trace_id" in result, "Still has trace_id for audit")


def test_governed_provider_import():
    """Test 7: GovernedMCPToolProvider import"""
    print("\nTest 7: GovernedMCPToolProvider import")
    try:
        from src.runtime.mcp.adapters.governed_tool_provider import (
            GovernedMCPToolProvider,
            get_tool_provider,
            GOVERNANCE_ENABLED
        )
        assert_true(True, "GovernedMCPToolProvider imported")
        assert_true(callable(get_tool_provider), "get_tool_provider is callable")
    except ImportError as e:
        assert_true(False, f"Import failed: {e}")


def main():
    print("=" * 60)
    print("CrewAI Governance Smoke Test")
    print("=" * 60)
    print()

    # Run tests
    BridgeClass = test_bridge_import()
    test_bridge_script_exists()
    allow_trace = test_allow_case(BridgeClass)
    block_trace = test_block_case(BridgeClass)
    test_evidence_package(allow_trace)
    test_evidence_package(block_trace)
    test_fail_closed(BridgeClass)
    test_governed_provider_import()

    # Summary
    print()
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    if failed == 0:
        print("\n✅ All CrewAI governance smoke tests passed!")
        return 0
    else:
        print("\n❌ Some tests failed.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
```

**Step 2: Run smoke test**

Run:
```bash
cd /Users/liye/github/liye_os
python .claude/scripts/crewai_governance_smoke_test.py
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add .claude/scripts/crewai_governance_smoke_test.py
git commit -m "test(crewai): add governance integration smoke test"
```

---

## Task 7: Create Documentation

**Files:**
- Create: `docs/integrations/CREWAI_GOVERNANCE_INTEGRATION_V1.md`

**Step 1: Write documentation**

```markdown
# CrewAI + LiYe Governance Kernel Integration v1

## Why Governance?

CrewAI agents execute tools autonomously. Without governance:
- Agents may call dangerous tools (delete, send email, modify system)
- No audit trail of decisions
- "Blind confidence" - agent says it succeeded but no evidence

LiYe Governance Kernel provides:
- **Gate**: Risk assessment before every tool call
- **Evidence**: Append-only trace of all decisions
- **Replay**: Deterministic verification of trace integrity
- **Fail Closed**: If governance unavailable, tool calls are blocked

## Quick Start

### 1. Install Optional Dependencies

```bash
pip install -r src/runtime/requirements.crewai.txt
```

### 2. Enable Governance

```bash
export LIYE_GOVERNANCE_ENABLED=1
```

### 3. Use GovernedMCPToolProvider

```python
from src.runtime.mcp.registry import MCPRegistry
from src.runtime.mcp.adapters import GovernedMCPToolProvider

# Load registry
registry = MCPRegistry.from_config("config/mcp_servers.yaml")

# Create governed provider
provider = GovernedMCPToolProvider(registry)

# Get tools - every call now goes through governance
tools = provider.get_tools(["qdrant-knowledge"])

# Use in CrewAI agent
from crewai import Agent
agent = Agent(
    role="Researcher",
    tools=tools,
    # ...
)
```

### 4. Run Demo

```bash
python examples/crewai/governed-tool-call/run_demo.py
```

### 5. Check Evidence

```bash
ls -la .liye/traces/
# Each trace contains:
#   events.ndjson  - Append-only event chain
#   verdict.json   - Decision semantics
#   verdict.md     - Human-readable verdict
#   replay.json    - Verification result
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CrewAI Agent                            │
│                          │                                  │
│                          ▼                                  │
│               GovernedMCPToolProvider                       │
│                          │                                  │
│         ┌────────────────┼────────────────┐                │
│         ▼                ▼                ▼                │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│   │  Gate    │───▶│ Execute  │───▶│ Verdict  │           │
│   │(JS Node) │    │(MCP Tool)│    │(JS Node) │           │
│   └──────────┘    └──────────┘    └──────────┘           │
│         │                                │                 │
│         ▼                                ▼                 │
│   ┌──────────┐                    ┌──────────┐           │
│   │  BLOCK   │                    │  Replay  │           │
│   │  UNKNOWN │                    │(JS Node) │           │
│   │    ↓     │                    └──────────┘           │
│   │  REJECT  │                          │                 │
│   └──────────┘                          ▼                 │
│                                   .liye/traces/           │
└─────────────────────────────────────────────────────────────┘
```

## Decisions

| Decision | Meaning | Tool Execution |
|----------|---------|----------------|
| ALLOW | Safe, no risks detected | ✓ Proceeds |
| DEGRADE | Some risks, proceed with caution | ✓ Proceeds |
| BLOCK | High risk detected | ✗ Rejected |
| UNKNOWN | Cannot assess risk | ✗ Rejected (Fail Closed) |

## Evidence Package

Each tool call generates a trace at `.liye/traces/<trace_id>/`:

- `events.ndjson`: Append-only event log with hash chain
- `verdict.json`: Machine-readable decision
- `verdict.md`: Human-readable explanation
- `replay.json`: Verification result (PASS/FAIL)

## Feature Flag

| Variable | Value | Behavior |
|----------|-------|----------|
| `LIYE_GOVERNANCE_ENABLED` | `1` | Use GovernedMCPToolProvider |
| `LIYE_GOVERNANCE_ENABLED` | `0` or unset | Use standard MCPToolProvider |

## Programmatic Control

```python
from src.runtime.mcp.adapters import get_tool_provider

# Auto-detect from environment
provider = get_tool_provider(registry)

# Force governed mode
provider = get_tool_provider(registry, governed=True)

# Force ungoverned mode
provider = get_tool_provider(registry, governed=False)
```

## Troubleshooting

### "Governance bridge error"

Ensure Node.js 20+ is installed and governance kernel exists:

```bash
node --version  # Should be 20+
node src/runtime/mcp/governance_bridge.mjs  # Should wait for input
```

### "CrewAI not installed"

Install optional dependency:

```bash
pip install crewai==1.7.0
```

### Traces not generated

Check `.liye/traces/` directory exists and is writable:

```bash
mkdir -p .liye/traces
ls -la .liye/traces/
```

## Version History

- v1.0.0 (2026-01-24): Initial release with Gate → Execute → Verdict → Replay
```

**Step 2: Commit**

```bash
git add docs/integrations/CREWAI_GOVERNANCE_INTEGRATION_V1.md
git commit -m "docs(crewai): add governance integration guide v1"
```

---

## Task 8: Final Verification

**Step 1: Run all tests**

Run:
```bash
cd /Users/liye/github/liye_os

# Federation smoke test (existing)
node .claude/scripts/federation_smoke_test.mjs

# CrewAI governance smoke test (new)
python .claude/scripts/crewai_governance_smoke_test.py

# Demo
python examples/crewai/governed-tool-call/run_demo.py
```

**Step 2: Verify evidence packages**

Run:
```bash
ls -la .liye/traces/ | tail -5
```

**Step 3: Create final commit**

```bash
git add -A
git status
git commit -m "feat(crewai): complete governance kernel integration v1

- Add GovernedMCPToolProvider with Gate → Execute → Verdict → Replay
- Add governance_bridge.mjs for JS-Python interop
- Add feature flag LIYE_GOVERNANCE_ENABLED
- Add demo and smoke tests
- Add integration documentation

DoD:
✓ Demo runs (ALLOW + BLOCK cases)
✓ Evidence packages generated
✓ Fail Closed enforced
✓ Old Provider unchanged

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Files | Purpose |
|------|-------|---------|
| 1 | `governance_bridge.mjs` | JS-Python interop |
| 2 | `governed_tool_provider.py` | Governed provider |
| 3 | `adapters/__init__.py` | Export new classes |
| 4 | `requirements.crewai.txt` | Dependency declaration |
| 5 | `examples/crewai/` | Demo |
| 6 | `crewai_governance_smoke_test.py` | Smoke test |
| 7 | `CREWAI_GOVERNANCE_INTEGRATION_V1.md` | Documentation |
| 8 | All | Final verification |

**Total estimated files:** 8 new, 1 modified
