// MUST FAIL fixtures (Phase 0f / EV2-B-01)
// These declarations MUST trigger the lint and block the commit.

// 1. Bare 'candidate' declaration — too generic, conflicts with lifecycle status
const candidate = {};

// 2. Bare 'evaluator' declaration — too generic
function evaluator() {}

// 3. trust* identifiers (Hard Gate 1: no new Trust system)
const trust_score = 0.5;
const trustMatrix = {};
class TrustToken {}
let TrustLevel = 1;

// 4. Bare 'trial' declaration — too generic
const trial = {};

// 5. async function with bare forbidden name
async function candidate() {}
async function evaluator() {}
async function trial() {}

// 6. JS function parameter as bare forbidden
function processOne(candidate) { return candidate; }
function handleMulti(x, trial, y) { return [x, trial, y]; }
function fnAsync(evaluator) { return evaluator(); }
