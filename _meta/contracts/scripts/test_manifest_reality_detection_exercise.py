#!/usr/bin/env python3
"""C12 fixture-only detection exercise for manifest reality R1-R6.

All mutations live in Python objects or TemporaryDirectory files. The harness
does not import manifest_reality_clock, call --append, resolve an AGE checkout,
or read/write the Band B ledger.
"""
from __future__ import annotations

import copy
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import yaml


SCRIPT_DIR = Path(__file__).resolve().parent
BASE_MANIFEST = (
    SCRIPT_DIR
    / "validate_manifest_reality_fixtures"
    / "must_pass"
    / "manifest_pilot1_proper.yaml"
)
BASE_ENGINE_REPO = BASE_MANIFEST.parent / "manifest_pilot1_proper_repo"

_SPEC = importlib.util.spec_from_file_location(
    "validate_manifest_reality_c12",
    SCRIPT_DIR / "validate_manifest_reality.py",
)
vmr = importlib.util.module_from_spec(_SPEC)
sys.modules["validate_manifest_reality_c12"] = vmr
_SPEC.loader.exec_module(vmr)


class ManifestRealityDetectionExerciseTests(unittest.TestCase):
    maxDiff = None

    def setUp(self) -> None:
        self.baseline = yaml.safe_load(BASE_MANIFEST.read_text(encoding="utf-8"))

    def _run(
        self,
        manifest: dict,
        *,
        schema_id_override: str | None = None,
        allow_data_source_path: bool = False,
    ) -> tuple[int, dict, str]:
        """Run the production validation path against isolated temp artifacts."""
        with tempfile.TemporaryDirectory(prefix="c12-manifest-drift-") as td:
            temp_root = Path(td)
            manifest_path = temp_root / "engine_manifest.yaml"
            manifest_path.write_text(
                yaml.safe_dump(manifest, sort_keys=False),
                encoding="utf-8",
            )

            original_schema_path = vmr.V2_SCHEMA_PATH
            if schema_id_override is not None or allow_data_source_path:
                isolated_schema = yaml.safe_load(original_schema_path.read_text(encoding="utf-8"))
                if schema_id_override is not None:
                    isolated_schema["$id"] = schema_id_override
                if allow_data_source_path:
                    data_source_properties = isolated_schema["properties"]["data_sources"][
                        "items"
                    ]["properties"]
                    data_source_properties["path"] = {"type": "string", "minLength": 1}
                isolated_schema_path = temp_root / "engine_manifest.schema.v2.yaml"
                isolated_schema_path.write_text(
                    yaml.safe_dump(isolated_schema, sort_keys=False),
                    encoding="utf-8",
                )
                vmr.V2_SCHEMA_PATH = isolated_schema_path

            stdout = io.StringIO()
            stderr = io.StringIO()
            try:
                with redirect_stdout(stdout), redirect_stderr(stderr):
                    exit_code = vmr.validate_one(
                        manifest_path,
                        BASE_ENGINE_REPO,
                        json_mode=True,
                    )
            finally:
                vmr.V2_SCHEMA_PATH = original_schema_path

            return exit_code, json.loads(stdout.getvalue()), stderr.getvalue()

    @staticmethod
    def _failed_checks(report: dict) -> list[str]:
        return [
            check["check"]
            for check in report.get("checks", [])
            if check.get("status") == "FAIL"
        ]

    def _assert_isolated_failure(
        self,
        manifest: dict,
        expected_check: str,
        *,
        schema_id_override: str | None = None,
        allow_data_source_path: bool = False,
    ) -> None:
        exit_code, report, stderr = self._run(
            manifest,
            schema_id_override=schema_id_override,
            allow_data_source_path=allow_data_source_path,
        )
        self.assertEqual(exit_code, 1, report)
        self.assertEqual(report["overall"], "FAIL")
        self.assertEqual(self._failed_checks(report), [expected_check])
        self.assertEqual(stderr, "")

    def test_clean_fixture_passes_all_six_checks(self) -> None:
        exit_code, report, stderr = self._run(copy.deepcopy(self.baseline))

        self.assertEqual(exit_code, 0, report)
        self.assertEqual(report["overall"], "PASS")
        self.assertEqual(len(report["checks"]), 6)
        self.assertTrue(all(check["status"] == "PASS" for check in report["checks"]))
        self.assertEqual(stderr, "")

    def test_r1_missing_playbook_entrypoint_is_detected(self) -> None:
        manifest = copy.deepcopy(self.baseline)
        manifest["playbooks"][0]["entrypoint"] = "src/playbooks/c12_missing.py"
        self._assert_isolated_failure(manifest, "R1_playbook_entrypoints")

    def test_r2_path_is_unreachable_through_current_v2_schema(self) -> None:
        manifest = copy.deepcopy(self.baseline)
        manifest["data_sources"][0]["path"] = "data/c12_missing_source"
        exit_code, report, stderr = self._run(manifest)

        self.assertEqual(exit_code, 2, report)
        self.assertEqual(report["overall"], "SCHEMA_FAIL")
        self.assertTrue(
            any("'path' was unexpected" in error for error in report["schema_errors"]),
            report,
        )
        self.assertEqual(stderr, "")

    def test_r2_detector_fires_with_isolated_schema_path_extension(self) -> None:
        manifest = copy.deepcopy(self.baseline)
        manifest["data_sources"][0]["path"] = "data/c12_missing_source"
        self._assert_isolated_failure(
            manifest,
            "R2_data_source_paths",
            allow_data_source_path=True,
        )

    def test_r3_dangling_runtime_gate_ref_is_detected(self) -> None:
        manifest = copy.deepcopy(self.baseline)
        manifest["capabilities"][0]["runtime_gate_refs"] = ["c12_missing_gate"]
        self._assert_isolated_failure(manifest, "R3_capability_gate_refs")

    def test_r4_effective_capability_exceeding_declared_is_detected(self) -> None:
        manifest = copy.deepcopy(self.baseline)
        manifest["engine_id"] = "c12-non-pilot-fixture"
        manifest["write_capability_declared"] = "limited"
        manifest["write_capability_effective"] = "full"
        self._assert_isolated_failure(manifest, "R4_effective_within_declared")

    def test_r5_schema_route_id_drift_is_detected(self) -> None:
        manifest = copy.deepcopy(self.baseline)
        self._assert_isolated_failure(
            manifest,
            "R5_schema_version_routing",
            schema_id_override="https://liye.com/contracts/engine/c12-drifted-schema",
        )

    def test_r6_pilot1_effective_write_is_detected(self) -> None:
        manifest = copy.deepcopy(self.baseline)
        manifest["write_capability_declared"] = "limited"
        manifest["write_capability_effective"] = "limited"
        self._assert_isolated_failure(manifest, "R6_pilot1_invariant")


if __name__ == "__main__":
    unittest.main(verbosity=2)
