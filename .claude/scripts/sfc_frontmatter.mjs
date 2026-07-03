import YAML from "yaml";

export const REQUIRED_GOVERNANCE_KEYS = [
  "skeleton",
  "triggers",
  "inputs",
  "outputs",
  "failure_modes",
  "verification",
];

export const ALLOWED_SKELETONS = new Set([
  "workflow",
  "task",
  "reference",
  "capabilities",
]);

const REQUIRED_TOP_LEVEL_KEYS = ["name", "description"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwnKey(obj, key) {
  return isRecord(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

function liyeMetadata(obj) {
  const metadata = isRecord(obj) ? obj.metadata : null;
  const liye = isRecord(metadata) ? metadata.liye : null;
  return isRecord(liye) ? liye : {};
}

export function extractFrontmatterBlock(md) {
  if (typeof md !== "string") return null;

  const trimmed = md.trimStart();
  if (!trimmed.startsWith("---")) return null;

  const lines = trimmed.split("\n");
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      return lines.slice(1, i).join("\n");
    }
  }

  return null;
}

export function parseFrontmatter(md) {
  const block = extractFrontmatterBlock(md);
  if (block === null) return null;

  try {
    const parsed = YAML.parse(block);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function checkCompliance(obj) {
  const safeObj = isRecord(obj) ? obj : {};
  const liye = liyeMetadata(safeObj);

  const topLevelPresent = REQUIRED_TOP_LEVEL_KEYS.every((key) => hasOwnKey(safeObj, key));
  const governanceAtTop = REQUIRED_GOVERNANCE_KEYS.every((key) => hasOwnKey(safeObj, key));
  const governanceInMetadata = REQUIRED_GOVERNANCE_KEYS.every((key) => hasOwnKey(liye, key));

  let shape = "none";
  if (topLevelPresent && governanceAtTop) {
    shape = "v0.1";
  } else if (topLevelPresent && governanceInMetadata) {
    shape = "v0.2";
  }

  const missing = [];
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!hasOwnKey(safeObj, key)) missing.push(key);
  }
  for (const key of REQUIRED_GOVERNANCE_KEYS) {
    if (!hasOwnKey(safeObj, key) && !hasOwnKey(liye, key)) missing.push(key);
  }

  const rawSkeleton = shape === "v0.2" ? liye.skeleton : safeObj.skeleton ?? liye.skeleton;
  const skeleton = rawSkeleton === undefined || rawSkeleton === null
    ? null
    : String(rawSkeleton).toLowerCase();

  return {
    shape,
    compliant: shape === "v0.1" || shape === "v0.2",
    missing,
    skeleton,
    skeletonValid: skeleton !== null && ALLOWED_SKELETONS.has(skeleton),
    versionMisplaced: hasOwnKey(liye, "version"),
  };
}
