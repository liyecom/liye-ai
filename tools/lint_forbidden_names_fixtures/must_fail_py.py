# MUST FAIL fixtures (Phase 0f / EV2-B-01)
# These declarations MUST trigger the lint and block the commit.

# 1. Bare 'evaluator' function declaration
def evaluator():
    pass

# 2. Bare 'candidate' top-level assignment
candidate = []

# 3. trust* identifiers (Hard Gate 1: no new Trust system)
trust_level = 0.7
TrustService = None

class Trust:
    pass

class TrustMatrix:
    pass

# 4. Bare 'trial' (top-level + declaration)
trial = []

def trial():
    pass

# 5. async def with bare forbidden name
async def candidate():
    pass

async def evaluator():
    pass

async def trial():
    pass

# 6. Python function parameter (first / subsequent / with type annotation / default)
def process(candidate: dict):
    return candidate

def handle(trial):
    return trial

def multi(x, candidate, y):
    return [x, candidate, y]

def with_default(evaluator=None):
    return evaluator

async def async_param(trial: int):
    return trial
