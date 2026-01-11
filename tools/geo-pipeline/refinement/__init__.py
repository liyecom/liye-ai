"""
GEO OS Refinement Pipeline
T2 → T1 Knowledge Refinement with Constitutional Gates
"""

from .truth_delta_gate import TruthDeltaGate, validate_truth_delta

__all__ = ['TruthDeltaGate', 'validate_truth_delta']
