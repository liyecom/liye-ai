// MUST PASS fixtures (Phase 0f / EV2-B-01)
// These declarations are GHL-compliant and MUST NOT trigger the lint.

// 1. Compound names with forbidden prefix/suffix are allowed
const candidate_write_enabled = true;
const candidate_path = "/policies/candidate/";
const policy_trial_evaluator = function() {};
const myCandidateEvaluator = {};
function getCandidatePolicy(id) { return id; }
class PolicyCandidate {}

// 1b. 'trial' compound forms are allowed
const policy_trial = {};
const trial_id = "abc";
const trial_history = [];
function loadPolicyTrial() {}
class TrialOutcome {}

// 2. String literals containing forbidden words are not identifiers
const status = "candidate";
const note = "trust me here";
const sql = "SELECT * WHERE trust_score > 0.5";
const route = "/api/evaluator/v1";
const tag = "trial";

// 3. Property assignments do not declare new identifiers
let obj = {};
obj.candidate = "x";
this.trust_level = 0.5;
window.evaluator = function() {};
obj.trial = 1;

// 4. English-word identifiers with leading 'trust' that are NOT trust-system declarations
const trusted_reviewer = "alice";
class TrustedSource {}
function trustworthiness() { return 1.0; }

// 5. Function parameters with COMPOUND names (must pass)
function runEvaluator(policy_trial_id, candidate_path) { return policy_trial_id; }
function fetchAll(trial_id, candidate_write_enabled) { return [trial_id, candidate_write_enabled]; }
async function asyncSafe(my_evaluator, my_candidate) { return [my_evaluator, my_candidate]; }
