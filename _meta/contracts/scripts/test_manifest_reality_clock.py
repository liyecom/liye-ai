#!/usr/bin/env python3
"""Self-contained tests for manifest_reality_clock continuity hardening."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "manifest_reality_clock",
    Path(__file__).resolve().parent / "manifest_reality_clock.py",
)
clk = importlib.util.module_from_spec(_SPEC)
sys.modules["manifest_reality_clock"] = clk
_SPEC.loader.exec_module(clk)


def E(day: str, ok: bool = True) -> dict:
    return {"utc_date": day, "clock_eligible_day": ok}


class ManifestRealityClockContinuityTests(unittest.TestCase):
    def test_consecutive_days_keep_streak(self):
        cont = clk.analyze_continuity(
            [E("2026-06-26"), E("2026-06-27")],
            E("2026-06-28"),
        )

        self.assertFalse(cont["continuity_break"])
        self.assertFalse(cont["streak_reset"])
        self.assertEqual(cont["gap_days"], [])
        self.assertEqual(cont["current_streak_len"], 3)
        self.assertEqual(cont["streak_start_utc_date"], "2026-06-26")
        self.assertEqual(cont["prev_entry_utc_date"], "2026-06-27")

    def test_2026_06_28_gap_repro_resets_to_today_only(self):
        cont = clk.analyze_continuity(
            [E("2026-06-22"), E("2026-06-23")],
            E("2026-06-28"),
        )

        self.assertTrue(cont["continuity_break"])
        self.assertTrue(cont["streak_reset"])
        self.assertEqual(
            cont["gap_days"],
            ["2026-06-24", "2026-06-25", "2026-06-26", "2026-06-27"],
        )
        self.assertEqual(cont["current_streak_len"], 1)
        self.assertEqual(cont["streak_start_utc_date"], "2026-06-28")
        self.assertEqual(cont["prev_entry_utc_date"], "2026-06-23")

    def test_prior_day_fail_resets_without_calendar_gap(self):
        cont = clk.analyze_continuity(
            [E("2026-06-27", ok=False)],
            E("2026-06-28"),
        )

        self.assertEqual(cont["gap_days"], [])
        self.assertFalse(cont["continuity_break"])
        self.assertTrue(cont["streak_reset"])
        self.assertEqual(cont["current_streak_len"], 1)

    def test_genesis_has_no_reset(self):
        cont = clk.analyze_continuity([], E("2026-06-28"))

        self.assertIsNone(cont["prev_entry_utc_date"])
        self.assertEqual(cont["gap_days"], [])
        self.assertFalse(cont["continuity_break"])
        self.assertFalse(cont["streak_reset"])
        self.assertEqual(cont["current_streak_len"], 1)
        self.assertEqual(cont["streak_start_utc_date"], "2026-06-28")

    def test_today_ineligible_has_zero_current_streak(self):
        cont = clk.analyze_continuity(
            [E("2026-06-27")],
            E("2026-06-28", ok=False),
        )

        self.assertEqual(cont["current_streak_len"], 0)
        self.assertIsNone(cont["streak_start_utc_date"])

    def test_multi_day_clean_streak(self):
        cont = clk.analyze_continuity(
            [
                E("2026-06-24"),
                E("2026-06-25"),
                E("2026-06-26"),
                E("2026-06-27"),
            ],
            E("2026-06-28"),
        )

        self.assertFalse(cont["continuity_break"])
        self.assertFalse(cont["streak_reset"])
        self.assertEqual(cont["current_streak_len"], 5)
        self.assertEqual(cont["streak_start_utc_date"], "2026-06-24")

    def test_duplicate_day_is_fail_closed(self):
        cont = clk.analyze_continuity(
            [E("2026-06-27", ok=True), E("2026-06-27", ok=False)],
            E("2026-06-28"),
        )

        self.assertTrue(cont["streak_reset"])
        self.assertEqual(cont["current_streak_len"], 1)

    def test_append_records_gap_metadata_without_backfill_lines(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = Path(td) / "ledger.jsonl"
            ledger.write_text(json.dumps(E("2026-06-23")) + "\n", encoding="utf-8")
            entry = E("2026-06-28")

            entry["continuity"] = clk.analyze_continuity(clk.read_ledger(ledger), entry)
            clk.append_entry(ledger, entry)

            lines = ledger.read_text(encoding="utf-8").splitlines()
            self.assertEqual(len(lines), 2)
            appended = json.loads(lines[-1])
            self.assertEqual(
                appended["continuity"]["gap_days"],
                ["2026-06-24", "2026-06-25", "2026-06-26", "2026-06-27"],
            )

    def test_read_ledger_skips_blank_and_malformed_lines(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = Path(td) / "ledger.jsonl"
            valid = E("2026-06-28")
            ledger.write_text(
                "\nnot json\n" + json.dumps(valid) + "\n",
                encoding="utf-8",
            )

            self.assertEqual(clk.read_ledger(ledger), [valid])


if __name__ == "__main__":
    unittest.main()
