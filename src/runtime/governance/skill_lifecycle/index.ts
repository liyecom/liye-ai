/**
 * BGHS Skill Lifecycle — barrel
 * Location: src/runtime/governance/skill_lifecycle/index.ts
 *
 * See README.md in this directory for the hard boundary against
 * `src/skill/` (the skill execution face). Cross-imports between the
 * two trees are forbidden — this tree is governance state only.
 */

export {
  SkillLifecycleState,
  ALLOWED_TRANSITIONS,
  TrustSource,
  QuarantineReason,
} from './types';

export type {
  ScanVerdictLiteral,
  ScanResultRef,
  GeneratedBy,
  GeneratedByLayer,
  SkillCandidateRecord,
  ApproverKind,
  ApproverEvidence,
  PolicyEvalResult,
  RollbackPolicy,
  DecidedBy,
  DecidedByActorKind,
  PromotionDecision,
  QuarantineDecision,
  LifecycleDriver,
  LifecycleTransition,
  SubmitFailureCode,
  TransitionFailureCode,
  SubmitResult,
  TransitionResult,
  GuardedSubmitResult,
  CandidateSubmitFailureCode,
} from './types';

export { TransitionLog, canonicalJson, type AppendTransitionInput } from './transition_log';

export { SkillLifecycleRegistry } from './registry';

export { guardedSubmitCandidate, type GuardedSubmitOptions } from './candidate_submit';
