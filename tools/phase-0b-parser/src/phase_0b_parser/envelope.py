"""Schema compatibility envelope — per PHASE-0B-SPEC.md §8.

Two-threshold model (§8.1 line 360-365):
    - min_compatible: hard floor; below → ERROR + abort
    - target_compatible: soft target; above → WARN + proceed

Behavior (§8.3 line 381-386):
    version absent       → SchemaMissingError, abort
    version < min        → SchemaTooOldError, abort
    version > target     → WARN (strict=True → ERROR)
    min <= v <= target   → OK silent
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from enum import Enum
from typing import Mapping


class EnvelopeResult(Enum):
    OK = "ok"
    WARN = "warn"
    ERROR = "error"


@dataclass(frozen=True)
class SchemaEnvelope:
    name: str
    min_compatible: int
    target_compatible: int


class SchemaMissingError(Exception):
    """Raised when an observed schema_version is None / absent.

    Per SPEC §8.3 line 382: 'version absent → SchemaMissingError, abort'.
    """


class SchemaTooOldError(Exception):
    """Raised when an observed schema_version < min_compatible.

    Per SPEC §8.3 line 383: 'version < min → SchemaTooOldError, abort'.
    """


class UnknownSchemaError(Exception):
    """Raised when caller references a schema name not registered in ENVELOPES.

    SPEC §8 enumerates the 5 known schemas; anything outside that set is a
    parser bug (or a not-yet-registered schema). Fail loudly rather than
    silently passing.
    """


# Per SPEC §8.2 line 369-376 — verified against portfolio files 2026-05-20:
#   target-classes.yaml         schema_version: 4  (file line 4)
#   AUTOMATION_GOVERNANCE.md    Schema version: 4  (file line 8)
#   automation-trust.yaml       schema_version: 3  (file line 6)
#   sealed_registry             v1  (parser own output, SPEC §5.1 line 120)
#   audit_event                 v1  (per-record, R1 refinement SPEC §8.2)
ENVELOPES: Mapping[str, SchemaEnvelope] = {
    "target_classes":        SchemaEnvelope("target_classes",        min_compatible=3, target_compatible=4),
    "automation_governance": SchemaEnvelope("automation_governance", min_compatible=4, target_compatible=4),
    "automation_trust":      SchemaEnvelope("automation_trust",      min_compatible=3, target_compatible=3),
    "sealed_registry":       SchemaEnvelope("sealed_registry",       min_compatible=1, target_compatible=1),
    "audit_event":           SchemaEnvelope("audit_event",           min_compatible=1, target_compatible=1),
}


def classify_envelope_compat(
    schema_name: str,
    observed_version: int | None,
    *,
    strict: bool = False,
) -> EnvelopeResult:
    """Verify a schema's observed_version against its registered envelope.

    Per SPEC §8.3 line 381-386 and §8.6 (strict mode) line 410-411.

    Verb prefix `classify_*` per SPEC §6.1 line 241 (v2 Gap A) — this function
    returns an enum (`EnvelopeResult`), which is exactly the classify_* slot.

    Args:
        schema_name: One of the keys in ENVELOPES.
        observed_version: The schema_version value read from the file
            (None if the file did not declare one).
        strict: When True, WARN (v > target) is escalated to ERROR.
            CI callers should pass strict=True per SPEC §8.6 line 411.

    Returns:
        EnvelopeResult.OK   — version within [min, target]
        EnvelopeResult.WARN — version > target and strict=False
        EnvelopeResult.ERROR — version > target and strict=True

    Raises:
        UnknownSchemaError — schema_name not in ENVELOPES.
        SchemaMissingError — observed_version is None.
        SchemaTooOldError  — observed_version < min_compatible.
    """
    if schema_name not in ENVELOPES:
        raise UnknownSchemaError(
            f"schema {schema_name!r} not registered in ENVELOPES "
            f"(known: {sorted(ENVELOPES)})"
        )

    env = ENVELOPES[schema_name]

    if observed_version is None:
        raise SchemaMissingError(
            f"{schema_name}: schema_version field absent "
            f"(expected int in [{env.min_compatible}, {env.target_compatible}])"
        )

    if observed_version < env.min_compatible:
        raise SchemaTooOldError(
            f"{schema_name}: observed v{observed_version} < "
            f"min_compatible v{env.min_compatible} (parser cannot proceed)"
        )

    if observed_version > env.target_compatible:
        msg = (
            f"{schema_name}: observed v{observed_version} > "
            f"parser target v{env.target_compatible}, may miss new fields"
        )
        if strict:
            # In strict mode escalate to ERROR per §8.6 line 411.
            print(f"ERROR: {msg}", file=sys.stderr)
            return EnvelopeResult.ERROR
        print(f"WARN: {msg}", file=sys.stderr)
        return EnvelopeResult.WARN

    # min <= observed <= target — silent OK per §8.3 line 386.
    return EnvelopeResult.OK
