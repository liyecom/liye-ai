"""Regression test for the shared build_args_schema helper (cut ④ §7 helper merge).

Proves the extracted shared builder reproduces — byte-for-byte in behavior — the
field-mapping logic formerly inlined in crewai_adapter.create_crewai_tool and
governed_tool_provider.create_governed_crewai_tool. The reference `_oracle` below is
a verbatim transcription of that old inlined logic; the test asserts the live helper
produces structurally identical pydantic models across every schema branch.

Runnable (matches this dir's existing non-pytest convention), pydantic required:
    python3 src/runtime/mcp/tests/test_build_args_schema.py
Not CI-wired (repo has no python test harness for src/runtime/mcp/**); local evidence.
"""
import os
import sys

# Self-contained: put repo root on sys.path so `src...` imports resolve when run directly.
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from src.runtime.mcp.adapters.crewai_adapter import build_args_schema
from src.runtime.mcp.adapters import governed_tool_provider as _gtp

# Both adapters must import cleanly (no crewai required at module load) and share the symbol.
assert _gtp.build_args_schema is build_args_schema, "governed_tool_provider must re-import the shared helper"


def _oracle(input_schema, schema_name):
    """Verbatim transcription of the OLD inlined field-builder (both former call sites)."""
    from typing import Optional
    from pydantic import Field, create_model
    args_schema_class = None
    if input_schema and input_schema.get('properties'):
        fields = {}
        properties = input_schema.get('properties', {})
        required = input_schema.get('required', [])
        for prop_name, prop_def in properties.items():
            prop_type = prop_def.get('type', 'string')
            prop_desc = prop_def.get('description', '')
            prop_default = prop_def.get('default')
            type_mapping = {
                'string': str, 'integer': int, 'number': float,
                'boolean': bool, 'array': list, 'object': dict,
            }
            python_type = type_mapping.get(prop_type, str)
            if prop_name in required:
                if prop_default is not None:
                    fields[prop_name] = (python_type, Field(default=prop_default, description=prop_desc))
                else:
                    fields[prop_name] = (python_type, Field(..., description=prop_desc))
            else:
                fields[prop_name] = (Optional[python_type], Field(default=prop_default, description=prop_desc))
        if fields:
            args_schema_class = create_model(schema_name, **fields)
    return args_schema_class


def _fingerprint(model):
    if model is None:
        return None
    out = {'__name__': model.__name__, 'fields': {}}
    for name, fi in model.model_fields.items():
        out['fields'][name] = (str(fi.annotation), fi.is_required(), repr(fi.default), fi.description)
    return out


SCHEMAS = [
    ("none", None),
    ("empty_dict", {}),
    ("no_properties", {"required": ["x"]}),
    ("empty_properties", {"properties": {}}),
    ("req_no_default", {"properties": {"q": {"type": "string", "description": "the query"}}, "required": ["q"]}),
    ("req_with_default", {"properties": {"n": {"type": "integer", "description": "count", "default": 5}}, "required": ["n"]}),
    ("optional_no_default", {"properties": {"flag": {"type": "boolean", "description": "f"}}}),
    ("optional_with_default", {"properties": {"flag": {"type": "boolean", "default": False}}}),
    ("unknown_type_fallback", {"properties": {"weird": {"type": "uuid"}}, "required": ["weird"]}),
    ("no_type_key", {"properties": {"bare": {"description": "no type -> string"}}, "required": ["bare"]}),
    ("all_types", {"properties": {
        "s": {"type": "string"}, "i": {"type": "integer"}, "f": {"type": "number"},
        "b": {"type": "boolean"}, "a": {"type": "array"}, "o": {"type": "object"},
    }, "required": ["s", "i", "f"]}),
    ("mixed", {"properties": {
        "rq": {"type": "string", "description": "req"},
        "rd": {"type": "number", "default": 1.5, "description": "req+default"},
        "op": {"type": "array", "description": "opt"},
    }, "required": ["rq", "rd"]}),
]


def main():
    failures = 0
    for label, schema in SCHEMAS:
        new_fp = _fingerprint(build_args_schema(schema, f"X_{label}Schema"))
        old_fp = _fingerprint(_oracle(schema, f"X_{label}Schema"))
        ok = new_fp == old_fp
        print(f"  {'PASS' if ok else 'FAIL'} {label:24s} {'(None)' if new_fp is None else str(len(new_fp['fields'])) + ' fields'}")
        if not ok:
            failures += 1
            print(f"      NEW: {new_fp}")
            print(f"      OLD: {old_fp}")

    one_field = {"properties": {"q": {"type": "string"}}, "required": ["q"]}
    m1 = build_args_schema(one_field, "foo_barSchema")
    m2 = build_args_schema(one_field, "foo_barGovernedSchema")
    suffix_ok = m1.__name__ == "foo_barSchema" and m2.__name__ == "foo_barGovernedSchema"
    print(f"  {'PASS' if suffix_ok else 'FAIL'} schema_name suffix carried (Schema / GovernedSchema)")
    if not suffix_ok:
        failures += 1

    print()
    if failures:
        print(f"FAILED: {failures} mismatch(es) — build_args_schema diverged from old inline logic")
        return 1
    print(f"OK: {len(SCHEMAS)} schemas + suffix — build_args_schema == verbatim-old-inline")
    return 0


if __name__ == "__main__":
    sys.exit(main())
