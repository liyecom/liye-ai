"""phase_0b_parser — Phase 0B-1 parser per PHASE-0B-SPEC.md v3.

Read-only credential scanner / classifier / sealed-registry emitter.

Per SPEC §1, §10: zero mutation. scan + classify + report only.
Mutation (audit append / DB revoke / consumer sync / hook install) is Phase 0C scope.
"""

__version__ = "0B-1.0.1"
