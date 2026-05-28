"""F10 — schema envelope tests per PHASE-0B-SPEC.md §8 + §7 line 330."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from phase_0b_parser.envelope import (
    ENVELOPES,
    EnvelopeResult,
    SchemaMissingError,
    SchemaTooOldError,
    UnknownSchemaError,
    classify_envelope_compat,
)


# ---- F10: target_classes envelope (min=3, target=4) ----
# Per SPEC §8.2 line 371: target_classes min_compatible=3 target_compatible=4.

def _load_yaml_version(path: Path) -> int | None:
    data = yaml.safe_load(path.read_text())
    if not isinstance(data, dict):
        return None
    v = data.get("schema_version")
    return v if isinstance(v, int) else None


def test_F10_v3_passes(fixtures_dir):
    """F10 — target-classes.yaml v3 must be accepted (envelope min=3)."""
    fixture = fixtures_dir / "F10_target_classes_v3.yaml"
    version = _load_yaml_version(fixture)
    assert version == 3
    assert classify_envelope_compat("target_classes", version) is EnvelopeResult.OK


def test_F10_v4_passes():
    """v4 == current portfolio target; must be silent OK."""
    assert classify_envelope_compat("target_classes", 4) is EnvelopeResult.OK


def test_F10_v2_aborts():
    """v2 < min_compatible(3) → SchemaTooOldError per §8.3 line 383."""
    with pytest.raises(SchemaTooOldError):
        classify_envelope_compat("target_classes", 2)


def test_F10_v5_warns(capsys):
    """v5 > target(4) and strict=False → WARN, return WARN."""
    result = classify_envelope_compat("target_classes", 5, strict=False)
    assert result is EnvelopeResult.WARN
    captured = capsys.readouterr()
    assert "WARN" in captured.err


def test_F10_v5_strict_errors(capsys):
    """v5 > target(4) and strict=True → ERROR per §8.6 line 411."""
    result = classify_envelope_compat("target_classes", 5, strict=True)
    assert result is EnvelopeResult.ERROR
    captured = capsys.readouterr()
    assert "ERROR" in captured.err


def test_F10_missing_aborts():
    """No schema_version field → SchemaMissingError per §8.3 line 382."""
    with pytest.raises(SchemaMissingError):
        classify_envelope_compat("target_classes", None)


# ---- Coverage for the remaining 4 schemas in §8.2 ----

def test_envelopes_registered():
    """All 5 schemas from SPEC §8.2 line 369-376 must be registered."""
    assert set(ENVELOPES.keys()) == {
        "target_classes",
        "automation_governance",
        "automation_trust",
        "sealed_registry",
        "audit_event",
    }


def test_envelope_values_match_spec():
    """ENVELOPES values match SPEC §8.2 line 371-376 (and portfolio reality)."""
    assert ENVELOPES["target_classes"].min_compatible == 3
    assert ENVELOPES["target_classes"].target_compatible == 4
    assert ENVELOPES["automation_governance"].min_compatible == 4
    assert ENVELOPES["automation_governance"].target_compatible == 4
    assert ENVELOPES["automation_trust"].min_compatible == 3
    assert ENVELOPES["automation_trust"].target_compatible == 3
    assert ENVELOPES["sealed_registry"].min_compatible == 1
    assert ENVELOPES["sealed_registry"].target_compatible == 1
    assert ENVELOPES["audit_event"].min_compatible == 1
    assert ENVELOPES["audit_event"].target_compatible == 1


def test_unknown_schema_raises():
    """Unregistered schema name → UnknownSchemaError (parser bug guard)."""
    with pytest.raises(UnknownSchemaError):
        classify_envelope_compat("not_a_real_schema", 1)
