/**
 * Auto-Summary Generator
 * Generates deterministic summary.md from answer.md (≤10 lines)
 */

const fs = require('fs');
const path = require('path');

// Keywords that indicate conclusion/summary sections
const SUMMARY_KEYWORDS = [
  '结论',
  '总结',
  '建议',
  '决策',
  '下一步',
  'conclusion',
  'summary',
  'recommendation',
  'decision',
  'next step',
  'takeaway',
  'key point',
  'action item',
];

/**
 * Check if a line is a header containing summary keywords
 */
function isSummaryHeader(line) {
  const lowerLine = line.toLowerCase();
  // Check if it's a markdown header
  if (!line.trim().startsWith('#')) return false;

  return SUMMARY_KEYWORDS.some(keyword =>
    lowerLine.includes(keyword.toLowerCase())
  );
}

/**
 * Extract lines from summary sections
 */
function extractSummarySections(lines) {
  const summaryLines = [];
  let inSummarySection = false;
  let sectionDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for summary header
    if (isSummaryHeader(line)) {
      inSummarySection = true;
      sectionDepth = (line.match(/^#+/) || [''])[0].length;
      continue; // Skip the header itself
    }

    // Check if we're exiting the summary section (new same-level header)
    if (inSummarySection && trimmed.startsWith('#')) {
      const newDepth = (line.match(/^#+/) || [''])[0].length;
      if (newDepth <= sectionDepth) {
        inSummarySection = false;
      }
    }

    // Add lines from summary sections
    if (inSummarySection && trimmed) {
      summaryLines.push(line);
    }
  }

  return summaryLines;
}

/**
 * Clean and format a line for summary
 */
function cleanLine(line, maxLength = 120) {
  // Remove markdown headers
  let cleaned = line.replace(/^#+\s*/, '');
  // Remove leading list markers but keep structure
  cleaned = cleaned.replace(/^[-*]\s*/, '• ');
  // Remove numbered lists
  cleaned = cleaned.replace(/^\d+\.\s*/, '• ');
  // Trim whitespace
  cleaned = cleaned.trim();

  // Truncate if too long
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength - 1) + '…';
  }

  return cleaned;
}

/**
 * Generate summary from answer.md content
 * @param {string} content - Content of answer.md
 * @param {number} maxLines - Maximum lines in summary (default: 10)
 * @returns {string[]} Summary lines
 */
function generateSummaryLines(content, maxLines = 10) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const lines = content.split('\n');
  const allLines = [];

  // First, try to extract from summary sections
  const summaryLines = extractSummarySections(lines);

  if (summaryLines.length > 0) {
    // Use summary section content
    for (const line of summaryLines) {
      const cleaned = cleanLine(line);
      if (cleaned) {
        allLines.push(cleaned);
        if (allLines.length >= maxLines) break;
      }
    }
  }

  // If we didn't get enough from summary sections, take from beginning
  if (allLines.length < maxLines) {
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines, headers, and code blocks
      if (!trimmed) continue;
      if (trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('```')) continue;
      if (trimmed.startsWith('<!--')) continue;

      const cleaned = cleanLine(line);
      if (cleaned && !allLines.includes(cleaned)) {
        allLines.push(cleaned);
        if (allLines.length >= maxLines) break;
      }
    }
  }

  return allLines.slice(0, maxLines);
}

/**
 * Generate summary.md content
 */
function generateSummaryContent(answerContent) {
  const summaryLines = generateSummaryLines(answerContent);

  if (summaryLines.length === 0) {
    return null; // No meaningful content to summarize
  }

  const header = `> Auto-summary (deterministic) · Generated at ${new Date().toISOString()}`;
  const content = summaryLines.join('\n');

  return `${header}\n\n${content}\n`;
}

/**
 * Generate summary.md for a mission
 * @param {string} missionDir - Mission directory path
 * @returns {Object} { generated: boolean, path: string|null, reason: string }
 */
function generateMissionSummary(missionDir) {
  const outputsDir = path.join(missionDir, 'outputs');
  const answerPath = path.join(outputsDir, 'answer.md');
  const summaryPath = path.join(outputsDir, 'summary.md');

  // Check if answer.md exists
  if (!fs.existsSync(answerPath)) {
    return {
      generated: false,
      path: null,
      reason: 'answer.md not found',
    };
  }

  // Read answer.md
  const answerContent = fs.readFileSync(answerPath, 'utf8');

  // Generate summary content
  const summaryContent = generateSummaryContent(answerContent);

  if (!summaryContent) {
    return {
      generated: false,
      path: null,
      reason: 'No meaningful content to summarize',
    };
  }

  // Write summary.md
  fs.writeFileSync(summaryPath, summaryContent);

  return {
    generated: true,
    path: summaryPath,
    reason: 'Summary generated successfully',
  };
}

module.exports = {
  generateMissionSummary,
  generateSummaryLines,
  generateSummaryContent,
  isSummaryHeader,
  extractSummarySections,
  SUMMARY_KEYWORDS,
};
