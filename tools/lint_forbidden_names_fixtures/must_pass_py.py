# MUST PASS fixtures (Phase 0f / EV2-B-01)
# These declarations are GHL-compliant and MUST NOT trigger the lint.

# 1. Compound names
candidate_write_enabled = True
policy_trial_evaluator_fn = lambda x: x
candidate_path = "/some/path"
my_evaluator_helper = None

# 1b. 'trial' compound forms
policy_trial = {}
trial_id = "abc"
trial_history = []

# 2. String literals
status = "candidate"
note = "trust me"
sql_query = "SELECT * WHERE trust_score > 0.5"
tag = "trial"

# 3. Attribute assignments (not top-level identifiers)
class Holder:
    pass

obj = Holder()
obj.candidate = 1
obj.trust_level = 0.5
obj.trial = "x"

# 4. English-word identifiers (not trust-system declarations)
trusted_reviewer = "alice"

def get_candidate_policy(policy_id):
    return policy_id

class PolicyCandidate:
    pass

class TrustedSource:
    """'Trusted' is single English word, not Trust* system identifier."""
    pass

class TrialOutcome:
    pass

# 5. Function parameters with COMPOUND names
def process(policy_trial_id, candidate_path):
    return policy_trial_id

def handle(trial_id, candidate_write_enabled):
    return [trial_id, candidate_write_enabled]

def with_compound_default(my_evaluator=None, my_candidate=None):
    return [my_evaluator, my_candidate]

async def async_compound(policy_trial: int, trial_count: int):
    return policy_trial + trial_count
