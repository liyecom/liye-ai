#!/usr/bin/env python3
"""Cross-language golden fixture generator (Phase 1b, SPEC §4).

Imports AGE `emit_fact` (the CODE-SSOT for the hash algorithms) and drives it
through the LIVE+tmp seam to (re)generate the committed ground-truth fixtures:

  tests/fixtures/golden_sidecar.json     — a real emit_fact sidecar + declared
                                           event_identity_key / event_content_hash
                                           / canonical_record_hash
  tests/fixtures/divergence_vectors.json — Python json.dumps over the §1.7.X
                                           number/escaping divergence domain

ZERO AGE mutation: emit_fact runs in LIVE mode with `output_base` pointed at a
throwaway tmp dir and a synthetic active+open manifest + fixed source_provenance
+ emitted_at_override (test seams). Only emit_fact.py is read/imported; nothing
is written under the AGE repo.

The committed fixtures are the Python ground truth; the Node golden test
(golden.test.mjs) recomputes identity/content/record hashes with import_facts.mjs
and asserts BYTE-equality — that is the cross-language guarantee (SPEC DoD §3.5).

Usage:
  python3 golden_harness.py [--age-repo DIR]   # regenerate committed fixtures
  python3 golden_harness.py --check            # FAIL (exit 1) if regen != committed
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
DEFAULT_AGE_REPO = HERE.parents[3].parent / "amazon-growth-engine"  # sibling of liye_os

# Deterministic inputs (kept in sync with the committed golden_sidecar.json).
BUSINESS_CONTEXT = dict(
    trace_id="20260520T020735Z",
    artifact_type="verification_json",
    artifact_path="out/facts/golden/verification.json",
    playbook_ref="bid_recommend",
    step_id="step-01",
    raw_payload_ref="out/facts/golden/raw_payload.json",
    raw_payload_hash="sha256:" + "a" * 64,
    raw_payload_summary={
        "acos": "0.42",
        "cvr": "0.1305",
        "clicks": "1200",
        "metric_formatting_hint": {"acos": "percent"},
        "note_unicode": "café-é",
    },
    redaction_status="no_sensitive_fields_detected",
    emitted_at_override="2026-05-20T02:07:35+00:00",
)
SOURCE_PROVENANCE = dict(
    source_commit_sha="0123456789abcdef0123456789abcdef01234567",
    source_branch="main",
    source_worktree_id="amazon-growth-engine",
    source_dirty=False,
)

SYNTHETIC_MANIFEST = (
    "schema_version: '2.0'\n"
    "engine_id: amazon-growth-engine\n"
    "runtime_gates:\n"
    "  - id: emit_fact_enabled\n"
    "    default_state: open\n"
    "capabilities:\n"
    "  - id: emit_fact\n"
    "    runtime_gate_refs: [emit_fact_enabled]\n"
    "    status: active\n"
)

DIVERGENCE_DOMAIN = [
    ("float_1_0", 1.0),
    ("float_1e16", 1e16),
    ("float_1e-7", 1e-7),
    ("float_neg0", -0.0),
    ("bigint_lossless", 99999999999999999999),
    ("int_1", 1),
    # NOTE: U+2028/U+2029 are deliberately NOT committed as raw bytes here — the
    # repo's no-bidi security gate (Trojan-Source defense) forbids them in tracked
    # files. Both Python and Node emit them RAW (they AGREE — not a divergence), and
    # that round-trip is covered by a RUNTIME-CONSTRUCTED case in canonical_json.test.mjs.
    ("control_escaped", "a" + chr(0x01) + "b"),
    ("tab", "a\tb"),
    ("newline", "a\nb"),
    ("quote", 'a"b'),
    ("backslash", "a\\b"),
    ("unicode_raw_utf8", "café-é"),
    ("bool_true", True),
    ("bool_false", False),
    ("null", None),
]


def _pj(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def build_golden(age_repo: pathlib.Path) -> dict:
    sys.path.insert(0, str(age_repo))
    try:
        from scripts.learning import emit_fact as ef
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(f"cannot import AGE emit_fact from {age_repo}: {exc}")

    tmpdir = pathlib.Path(tempfile.mkdtemp(prefix="ghl_golden_"))
    manifest_path = tmpdir / "engine_manifest.yaml"
    manifest_path.write_text(SYNTHETIC_MANIFEST, encoding="utf-8")

    result = ef.emit_fact(
        ef.BusinessContext(**BUSINESS_CONTEXT),
        mode=ef.EmitMode.LIVE,
        output_base=tmpdir / "facts_out",
        manifest_path=manifest_path,
        allow_emitted_at_override=True,
        source_provenance=SOURCE_PROVENANCE,
    )
    if result.status != "emitted":
        raise SystemExit(f"expected emitted, got {result.status}: {result.error_detail}")

    sidecar_bytes = pathlib.Path(result.sidecar_path).read_bytes()
    canonical_record_hash = "sha256:" + hashlib.sha256(sidecar_bytes).hexdigest()
    return {
        "description": (
            "Golden fixture from REAL AGE emit_fact.py (LIVE+tmp seam, zero AGE "
            "mutation). Regenerate via golden_harness.py. Node import_facts recompute "
            "MUST byte-equal declared_* below."
        ),
        "source_provenance": SOURCE_PROVENANCE,
        "emitted_at_override": BUSINESS_CONTEXT["emitted_at_override"],
        "sidecar_text": sidecar_bytes.decode("utf-8"),
        "declared_identity": result.event_identity_key,
        "declared_content": result.event_content_hash,
        "declared_canonical_record_hash": canonical_record_hash,
    }


def build_divergence() -> dict:
    return {
        "description": (
            "Ground-truth Python json.dumps(sort_keys=True, separators=(',',':'), "
            "ensure_ascii=False) outputs for the SPEC §1.7.X divergence domain. "
            "Node canonical_json.emitCanonical(parseCanonical(python)) MUST byte-equal "
            "the 'python' field. Regenerate via golden_harness.py --divergence."
        ),
        "vectors": [{"label": label, "python": _pj(value)} for label, value in DIVERGENCE_DOMAIN],
        "composite_python": _pj({label: value for label, value in DIVERGENCE_DOMAIN}),
    }


def _dump(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Phase 1b cross-language golden fixture generator")
    ap.add_argument("--age-repo", type=pathlib.Path, default=DEFAULT_AGE_REPO)
    ap.add_argument("--check", action="store_true", help="fail if regen differs from committed")
    args = ap.parse_args()

    golden = build_golden(args.age_repo)
    divergence = build_divergence()
    golden_path = FIXTURES / "golden_sidecar.json"
    divergence_path = FIXTURES / "divergence_vectors.json"

    if args.check:
        drift = []
        if golden_path.read_text(encoding="utf-8") != _dump(golden):
            drift.append("golden_sidecar.json")
        if divergence_path.read_text(encoding="utf-8") != _dump(divergence):
            drift.append("divergence_vectors.json")
        if drift:
            print(f"❌ fixture drift vs emit_fact ground truth: {drift}")
            return 1
        print("✅ committed fixtures match emit_fact ground truth")
        print(f"   identity={golden['declared_identity']}")
        print(f"   content ={golden['declared_content']}")
        print(f"   record  ={golden['declared_canonical_record_hash']}")
        return 0

    golden_path.write_text(_dump(golden), encoding="utf-8")
    divergence_path.write_text(_dump(divergence), encoding="utf-8")
    print(f"wrote {golden_path}")
    print(f"wrote {divergence_path}")
    print(f"   identity={golden['declared_identity']}")
    print(f"   content ={golden['declared_content']}")
    print(f"   record  ={golden['declared_canonical_record_hash']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
