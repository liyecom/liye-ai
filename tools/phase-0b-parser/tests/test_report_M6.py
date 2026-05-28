"""M6 fixture tests — report_sealed_registry envelope, strict mode, output
path whitelist, atomic write, collision flag, is_sealed real impl.

Per PHASE-0B-SPEC.md §11.1 M6 line 459:
    M6 deliverable — report_sealed_registry + summary + --strict mode +
    output path whitelist assert. Acceptance: sealed-registry.json output
    + schema envelope full verification + write boundary守门.

Fixture coverage:
  - round_trip — serialize → deserialize → semantic equivalence
  - strict mode happy / sad-db-unknown / sad-human-review / sad-collision-stub
  - output path violation (banned ~/.claude, .git, _meta, .env*, source dirs)
  - output path whitelist accept (build, var, tmp, .cache, dist)
  - collision flag always False + Phase 0B-2 docstring keyword
  - atomic write semantics (tmp file then os.replace)
  - is_sealed orthogonal to ghost/orphan/live mutex
"""

from __future__ import annotations

import dataclasses
import json
from pathlib import Path

import pytest

from phase_0b_parser import report_sealed_registry as report_mod
from phase_0b_parser.models import DbMetadata, DiskSource, FingerprintRecord
from phase_0b_parser.report_sealed_registry import (
    OutputPathViolation,
    StrictModeViolation,
    _assert_output_path_whitelist,
    _check_strict_warnings,
    _summarize,
    report_sealed_registry,
)
from phase_0b_parser.verbs import is_ghost, is_live, is_orphan, is_sealed


# ---------------------------------------------------------------------------
# Helper builders
# ---------------------------------------------------------------------------
def _live_record(fp: str, *, db_validity: str = "present") -> FingerprintRecord:
    return FingerprintRecord(
        fingerprint_sha256_12=fp,
        key_type="sk_",
        redacted=f"sk_{fp[:3]}***xyz",
        disk_sources=[DiskSource(path="storefronts/sf-mock/.env.local", line=11,
                                 env_var="MEDUSA_ADMIN_TOKEN")],
        db_validity=db_validity,
        db_metadata=DbMetadata(id=f"apk_{fp}", title="admin token",
                               created_at="2026-05-19T12:46:15Z"),
        consumer_paths=["storefronts/sf-mock/.env.local:11"],
        source_origins={"disk", "db", "consumer"},
        classification="live",
        recommended_disposition="keep+rotate-when-ready",
    )


def _ghost_record(fp: str) -> FingerprintRecord:
    return FingerprintRecord(
        fingerprint_sha256_12=fp,
        key_type="sk_",
        redacted=f"sk_{fp[:3]}***xyz",
        disk_sources=[DiskSource(path="storefronts/sf-stale/.env.local.bak",
                                 line=3, env_var="OLD_TOKEN")],
        db_validity="absent",
        db_metadata=None,
        consumer_paths=[],
        source_origins={"disk"},
        classification="ghost",
        recommended_disposition="archive",
    )


def _orphan_seed_record(fp: str) -> FingerprintRecord:
    return FingerprintRecord(
        fingerprint_sha256_12=fp,
        key_type="sk_",
        redacted=f"sk_{fp[:3]}***xyz",
        disk_sources=[],
        db_validity="present",
        db_metadata=DbMetadata(id=f"apk_{fp}", title="Default Admin Token",
                               created_at="2026-05-19T12:46:15Z"),
        consumer_paths=[],
        source_origins={"db"},
        classification="orphan",
        sub_classification="system-seed-suspected",
        title_signal_score=1,
        requires_human_confirmation=True,
        recommended_disposition="human-review",
    )


def _db_unknown_record(fp: str) -> FingerprintRecord:
    return FingerprintRecord(
        fingerprint_sha256_12=fp,
        key_type="sk_",
        redacted=f"sk_{fp[:3]}***xyz",
        disk_sources=[DiskSource(path="storefronts/sf-mock/.env.local",
                                 line=11, env_var="MEDUSA_ADMIN_TOKEN")],
        db_validity="unknown",
        db_metadata=None,
        consumer_paths=["storefronts/sf-mock/.env.local:11"],
        source_origins={"disk", "consumer"},
        classification="live",
        requires_human_confirmation=True,
        recommended_disposition="keep+rotate-when-ready+verify-db-when-reachable",
    )


# ===========================================================================
# Round-trip (serialize → deserialize → semantic equivalence)
# ===========================================================================
class TestRoundTrip:
    def test_round_trip_envelope_shape(self, tmp_path):
        records = {
            _live_record("a1b2c3d4e5f6"),
            _ghost_record("b1b2c3d4e5f6"),
            _orphan_seed_record("c1b2c3d4e5f6"),
        }
        out = tmp_path / "var" / "sealed-registry.json"
        summary = report_sealed_registry(records, out)

        # Envelope reads back as valid JSON
        payload = json.loads(out.read_text(encoding="utf-8"))
        assert payload["schema_version"] == 1
        assert payload["schema"] == "sealed_registry"
        assert payload["generated_at"].endswith("Z")
        assert "T" in payload["generated_at"]  # ISO 8601

        # Group 0 conformance — SPEC §5.1 required envelope fields
        assert payload["parser_version"] == "0B-1.0.1"
        assert payload["scope_covered"] == [
            "user_claude_json",
            "repo_claude_json",
            "envstar",
            "envrc",
            "medusa_db_api_key",
            "admin_credential_registry_framework",
            "ghost_orphan_live_classification",
            "multi_consumer_sync",
            "disk_duplicate_detection",
        ]

        # Summary matches return value
        assert payload["summary"] == summary
        assert summary["total_records"] == 3
        assert summary["by_classification"] == {"ghost": 1, "orphan": 1, "live": 1}
        assert summary["collision_detected"] is False
        assert summary["system_seed_suspected_count"] == 1
        assert summary["requires_human_confirmation_count"] == 1
        assert summary["unknown_db_validity_count"] == 0

        # Records lex-sorted by fingerprint_sha256_12
        fps = [r["fingerprint_sha256_12"] for r in payload["records"]]
        assert fps == sorted(fps)

        # All record `sealed` flags True
        assert all(r["sealed"] is True for r in payload["records"])

        # snake_case keys everywhere (no PascalCase / camelCase)
        for rec in payload["records"]:
            for key in rec:
                assert "_" in key or key.islower(), f"non-snake_case key: {key}"

    def test_round_trip_set_field_serialized_as_sorted_list(self, tmp_path):
        rec = _live_record("a1b2c3d4e5f6")
        out = tmp_path / "var" / "sealed-registry.json"
        report_sealed_registry({rec}, out)
        payload = json.loads(out.read_text(encoding="utf-8"))
        # source_origins set → sorted list
        assert payload["records"][0]["source_origins"] == ["consumer", "db", "disk"]

    def test_round_trip_explicit_generated_at_passthrough(self, tmp_path):
        out = tmp_path / "var" / "sealed-registry.json"
        report_sealed_registry(set(), out, generated_at="2026-05-21T14:30:00Z")
        payload = json.loads(out.read_text(encoding="utf-8"))
        assert payload["generated_at"] == "2026-05-21T14:30:00Z"

    def test_round_trip_input_records_not_mutated(self, tmp_path):
        """`record.sealed` flip uses dataclasses.replace; input set survives untouched."""
        original = _live_record("a1b2c3d4e5f6")
        records = {original}
        out = tmp_path / "var" / "sealed-registry.json"
        report_sealed_registry(records, out)
        # The original record remains in the input set with sealed=False
        for rec in records:
            assert rec.sealed is False


# ===========================================================================
# Group 0 — SPEC §5.1 / §5.4 envelope conformance fields (2026-05-23)
# ===========================================================================
class TestEnvelopeConformance:
    """Verify M6 envelope satisfies SPEC v3 §5.1 + §5.4 required fields.

    Group 0 fix closes the impl-side gap surfaced during v4 ceremony prep:
    parser_version + scope_covered (envelope) + disk_duplicate_records_count
    (summary) are SPEC-required but were missing in the original M6 emit.
    """

    def test_envelope_parser_version_matches_module_version(self, tmp_path):
        from phase_0b_parser import __version__

        out = tmp_path / "var" / "sealed-registry.json"
        report_sealed_registry(set(), out)
        payload = json.loads(out.read_text(encoding="utf-8"))
        assert payload["parser_version"] == __version__
        assert payload["parser_version"] == "0B-1.0.1"

    def test_envelope_scope_covered_is_spec_9_item_list(self, tmp_path):
        out = tmp_path / "var" / "sealed-registry.json"
        report_sealed_registry(set(), out)
        payload = json.loads(out.read_text(encoding="utf-8"))
        # Per SPEC §5.1 lines 123-133 — exact list, exact order.
        assert payload["scope_covered"] == [
            "user_claude_json",
            "repo_claude_json",
            "envstar",
            "envrc",
            "medusa_db_api_key",
            "admin_credential_registry_framework",
            "ghost_orphan_live_classification",
            "multi_consumer_sync",
            "disk_duplicate_detection",
        ]

    def test_summary_disk_duplicate_records_count_zero_when_no_duplicates(self, tmp_path):
        records = {_live_record("a" * 12), _ghost_record("b" * 12)}
        out = tmp_path / "var" / "sealed-registry.json"
        summary = report_sealed_registry(records, out)
        assert summary["disk_duplicate_records_count"] == 0

    def test_summary_disk_duplicate_records_count_counts_records_with_duplicates(self, tmp_path):
        # Build a record with non-empty disk_duplicate_paths (>= 2 disk sources).
        rec = _live_record("a" * 12)
        rec = dataclasses.replace(
            rec,
            disk_sources=[
                DiskSource(path="storefronts/sf-a/.env.local", line=1, env_var="X"),
                DiskSource(path="storefronts/sf-b/.env.local", line=1, env_var="X"),
            ],
            disk_duplicate_paths=[
                "storefronts/sf-a/.env.local",
                "storefronts/sf-b/.env.local",
            ],
        )
        out = tmp_path / "var" / "sealed-registry.json"
        summary = report_sealed_registry({rec}, out)
        assert summary["disk_duplicate_records_count"] == 1

    def test_summary_disk_duplicate_records_count_multi_records(self, tmp_path):
        dup_paths = [
            "storefronts/sf-x/.env.local",
            "storefronts/sf-y/.env.local",
        ]
        dup_sources = [DiskSource(path=p, line=1, env_var="X") for p in dup_paths]
        rec1 = dataclasses.replace(
            _live_record("a" * 12),
            disk_sources=dup_sources,
            disk_duplicate_paths=dup_paths,
        )
        rec2 = dataclasses.replace(
            _ghost_record("b" * 12),
            disk_sources=dup_sources,
            disk_duplicate_paths=dup_paths,
        )
        # rec3 has no duplicates — should not count.
        rec3 = _live_record("c" * 12)
        out = tmp_path / "var" / "sealed-registry.json"
        summary = report_sealed_registry({rec1, rec2, rec3}, out)
        assert summary["disk_duplicate_records_count"] == 2


# ===========================================================================
# Strict mode (§8.6)
# ===========================================================================
class TestStrictMode:
    def test_strict_happy_path_all_live(self, tmp_path):
        records = {_live_record("a" * 12), _live_record("b" * 12)}
        out = tmp_path / "var" / "sealed-registry.json"
        summary = report_sealed_registry(records, out, strict=True)
        assert summary["unknown_db_validity_count"] == 0
        assert summary["requires_human_confirmation_count"] == 0
        assert out.exists()

    def test_strict_sad_db_unknown_raises(self, tmp_path):
        records = {_db_unknown_record("a" * 12)}
        out = tmp_path / "var" / "sealed-registry.json"
        with pytest.raises(StrictModeViolation) as exc_info:
            report_sealed_registry(records, out, strict=True)
        assert any("db_validity=unknown" in w for w in exc_info.value.warnings)
        # No file written in strict-raise case
        assert not out.exists()

    def test_strict_sad_db_unknown_non_strict_proceeds(self, tmp_path):
        """Same input + strict=False → writes happily (log warn only)."""
        records = {_db_unknown_record("a" * 12)}
        out = tmp_path / "var" / "sealed-registry.json"
        summary = report_sealed_registry(records, out, strict=False)
        assert summary["unknown_db_validity_count"] == 1
        assert out.exists()

    def test_strict_sad_human_review_raises(self, tmp_path):
        records = {_orphan_seed_record("a" * 12)}
        out = tmp_path / "var" / "sealed-registry.json"
        with pytest.raises(StrictModeViolation) as exc_info:
            report_sealed_registry(records, out, strict=True)
        assert any("human_confirmation_required" in w for w in exc_info.value.warnings)
        assert not out.exists()

    def test_strict_sad_human_review_non_strict_proceeds(self, tmp_path):
        records = {_orphan_seed_record("a" * 12)}
        out = tmp_path / "var" / "sealed-registry.json"
        summary = report_sealed_registry(records, out, strict=False)
        assert summary["requires_human_confirmation_count"] == 1
        assert out.exists()

    def test_check_strict_warnings_collision_path(self):
        """If collision_detected were True, strict would escalate.

        We cannot trigger collision via real input (M6 always returns False),
        but the predicate level test covers the future-activation contract.
        """
        synthetic_summary = {
            "unknown_db_validity_count": 0,
            "collision_detected": True,
            "requires_human_confirmation_count": 0,
        }
        warns = _check_strict_warnings(synthetic_summary)
        assert any("fp_collision_detected" in w for w in warns)


# ===========================================================================
# Output-path whitelist (§6.4)
# ===========================================================================
class TestOutputPathWhitelist:
    def test_banned_dotclaude_raises_before_write(self, tmp_path, monkeypatch):
        """Path with `.claude` part rejects BEFORE any filesystem activity."""
        # Use a path inside tmp but with a .claude segment — assert raises
        banned = tmp_path / ".claude" / "sealed.json"
        with pytest.raises(OutputPathViolation) as exc:
            report_sealed_registry(set(), banned)
        assert ".claude" in exc.value.reason
        # Verify file (and parent dir) were not created
        assert not banned.exists()
        assert not banned.parent.exists()

    def test_banned_git_raises(self, tmp_path):
        banned = tmp_path / ".git" / "sealed.json"
        with pytest.raises(OutputPathViolation):
            report_sealed_registry(set(), banned)
        assert not banned.exists()

    def test_banned_meta_raises(self, tmp_path):
        banned = tmp_path / "_meta" / "sealed.json"
        with pytest.raises(OutputPathViolation):
            report_sealed_registry(set(), banned)

    def test_banned_env_filename_raises(self, tmp_path):
        """Filename starting with .env (consumer file pattern) hard-blocked."""
        # Place inside tmp so the path itself is whitelisted; only filename triggers
        banned = tmp_path / ".env.localkeys"
        with pytest.raises(OutputPathViolation) as exc:
            report_sealed_registry(set(), banned)
        assert ".env" in exc.value.reason
        assert not banned.exists()

    def test_banned_src_dir_raises(self):
        """Path with `src` segment outside tmp tree is banned."""
        # Use an absolute path NOT under tmp/var/private
        banned = Path("/Users/nobody/proj/src/sealed.json")
        with pytest.raises(OutputPathViolation) as exc:
            _assert_output_path_whitelist(banned)
        assert "src" in exc.value.reason

    def test_banned_tests_dir_raises(self):
        banned = Path("/Users/nobody/proj/tests/sealed.json")
        with pytest.raises(OutputPathViolation):
            _assert_output_path_whitelist(banned)

    def test_default_reject_no_whitelist_match(self):
        """Path with NO whitelist dir name in any part is default-rejected."""
        banned = Path("/Users/nobody/random/dir/sealed.json")
        with pytest.raises(OutputPathViolation) as exc:
            _assert_output_path_whitelist(banned)
        assert "whitelist" in exc.value.reason.lower()

    def test_whitelist_build_accepts(self, tmp_path):
        out = tmp_path / "build" / "sealed.json"
        # Should not raise; uses tmp tree shortcut, but also build whitelist match
        report_sealed_registry(set(), out)
        assert out.exists()

    def test_whitelist_var_accepts(self, tmp_path):
        out = tmp_path / "var" / "sealed.json"
        report_sealed_registry(set(), out)
        assert out.exists()

    def test_whitelist_cache_accepts(self, tmp_path):
        out = tmp_path / ".cache" / "sealed.json"
        report_sealed_registry(set(), out)
        assert out.exists()

    def test_whitelist_dist_accepts(self, tmp_path):
        out = tmp_path / "dist" / "sealed.json"
        report_sealed_registry(set(), out)
        assert out.exists()


# ===========================================================================
# Collision flag (§5.3 — M6 always False; Phase 0B-2 activates)
# ===========================================================================
class TestCollisionDetection:
    def test_collision_always_false_empty(self, tmp_path):
        out = tmp_path / "var" / "sealed-registry.json"
        summary = report_sealed_registry(set(), out)
        assert summary["collision_detected"] is False

    def test_collision_always_false_with_records(self, tmp_path):
        records = {
            _live_record("a1b2c3d4e5f6"),
            _ghost_record("b1b2c3d4e5f6"),
            _orphan_seed_record("c1b2c3d4e5f6"),
        }
        out = tmp_path / "var" / "sealed-registry.json"
        summary = report_sealed_registry(records, out)
        assert summary["collision_detected"] is False

    def test_module_docstring_mentions_phase_0b_2(self):
        """Module docstring must contain Phase 0B-2 marker so consumers
        find the upgrade path."""
        assert "Phase 0B-2" in (report_mod.__doc__ or "")


# ===========================================================================
# Atomic write semantics
# ===========================================================================
class TestAtomicWrite:
    def test_atomic_write_no_leftover_tmp(self, tmp_path):
        records = {_live_record("a1b2c3d4e5f6")}
        out = tmp_path / "var" / "sealed-registry.json"
        report_sealed_registry(records, out)
        # The .tmp staging file should be gone after os.replace
        tmp_file = out.with_suffix(out.suffix + ".tmp")
        assert not tmp_file.exists()
        assert out.exists()

    def test_atomic_write_overwrites_existing(self, tmp_path):
        out = tmp_path / "var" / "sealed-registry.json"
        out.parent.mkdir(parents=True)
        out.write_text('{"stale": true}\n', encoding="utf-8")
        report_sealed_registry(set(), out)
        payload = json.loads(out.read_text(encoding="utf-8"))
        assert "schema_version" in payload
        assert "stale" not in payload

    def test_strict_violation_leaves_existing_file_untouched(self, tmp_path):
        """When strict raises, no write happens — pre-existing file stays."""
        out = tmp_path / "var" / "sealed-registry.json"
        out.parent.mkdir(parents=True)
        out.write_text('{"pre_existing": true}\n', encoding="utf-8")
        records = {_db_unknown_record("a" * 12)}
        with pytest.raises(StrictModeViolation):
            report_sealed_registry(records, out, strict=True)
        # File untouched (still has pre-existing content)
        payload = json.loads(out.read_text(encoding="utf-8"))
        assert payload == {"pre_existing": True}


# ===========================================================================
# is_sealed real impl (§6.2 line 262)
# ===========================================================================
class TestIsSealed:
    def test_is_sealed_false_default(self):
        rec = _live_record("a" * 12)
        assert is_sealed(rec) is False

    def test_is_sealed_true_after_report(self, tmp_path):
        """After report_sealed_registry runs, the WRITTEN records carry
        sealed=True. Input records are not mutated; we verify via re-read."""
        rec = _live_record("a" * 12)
        out = tmp_path / "var" / "sealed-registry.json"
        report_sealed_registry({rec}, out)
        payload = json.loads(out.read_text(encoding="utf-8"))
        assert payload["records"][0]["sealed"] is True

    def test_is_sealed_orthogonal_to_ghost_orphan_live_mutex(self):
        """is_sealed predicate is independent of classification bucket."""
        for builder in (_live_record, _ghost_record, _orphan_seed_record):
            rec = builder("d" * 12)
            sealed = dataclasses.replace(rec, sealed=True)
            assert is_sealed(sealed) is True
            # And exactly one of ghost/orphan/live still holds
            bools = [is_ghost(sealed), is_orphan(sealed), is_live(sealed)]
            assert sum(bools) == 1


# ===========================================================================
# Summary aggregation invariants (§5.4)
# ===========================================================================
class TestSummaryAggregation:
    def test_empty_summary_shape(self):
        summary = _summarize(set())
        assert summary == {
            "total_records": 0,
            "by_classification": {"ghost": 0, "orphan": 0, "live": 0},
            "collision_detected": False,
            "system_seed_suspected_count": 0,
            "unknown_db_validity_count": 0,
            "requires_human_confirmation_count": 0,
            "disk_duplicate_records_count": 0,
        }

    def test_summary_counts_all_dimensions(self):
        records = {
            _live_record("a" * 12),
            _ghost_record("b" * 12),
            _orphan_seed_record("c" * 12),  # system-seed + requires_human
            _db_unknown_record("d" * 12),  # db_unknown + requires_human
        }
        summary = _summarize(records)
        assert summary["total_records"] == 4
        assert summary["by_classification"] == {"ghost": 1, "orphan": 1, "live": 2}
        assert summary["system_seed_suspected_count"] == 1
        assert summary["unknown_db_validity_count"] == 1
        assert summary["requires_human_confirmation_count"] == 2
        assert summary["collision_detected"] is False
