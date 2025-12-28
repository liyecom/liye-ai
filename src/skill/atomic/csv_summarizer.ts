/**
 * LiYe AI Atomic Skill - CSV Summarizer
 * Location: src/skill/atomic/csv_summarizer.ts
 *
 * L2 Executable Layer for automatic CSV data analysis and insight generation
 * Provides: auto-profiling, statistics, anomaly detection, visualization suggestions
 *
 * @source Adapted from awesome-claude-skills/csv-summarizer
 * @domain 07_Data_Science
 */

import { Skill, SkillInput, SkillOutput } from '../types';

// === Type Definitions ===
interface ColumnProfile {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'text' | 'boolean';
  count: number;
  nullCount: number;
  nullPercent: number;
  uniqueCount: number;
  uniquePercent: number;

  // Numeric stats
  mean?: number;
  median?: number;
  std?: number;
  min?: number;
  max?: number;
  q25?: number;
  q75?: number;
  skewness?: number;

  // Categorical stats
  topValues?: { value: string; count: number; percent: number }[];

  // Datetime stats
  minDate?: string;
  maxDate?: string;
  dateRange?: number; // in days
}

interface DataQualityIssue {
  type: 'missing' | 'outlier' | 'duplicate' | 'inconsistent';
  column?: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedRows?: number;
}

interface Insight {
  type: 'trend' | 'correlation' | 'anomaly' | 'distribution' | 'pattern';
  title: string;
  description: string;
  confidence: number;
  columns: string[];
  visualization?: 'line' | 'bar' | 'scatter' | 'histogram' | 'heatmap' | 'box';
}

interface SummaryReport {
  overview: {
    rowCount: number;
    columnCount: number;
    memorySize: string;
    missingCells: number;
    missingPercent: number;
    duplicateRows: number;
  };
  columns: ColumnProfile[];
  qualityIssues: DataQualityIssue[];
  insights: Insight[];
  recommendations: string[];
}

// === Main Skill Definition ===
export const csv_summarizer: Skill = {
  // === Metadata ===
  id: 'csv_summarizer',
  name: 'CSV Summarizer',
  version: '1.0.0',
  description: 'Automatically analyze CSV files and generate comprehensive insights without manual prompting',
  category: 'data-analysis',

  // === Input Schema ===
  input: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        required: true,
        description: 'Path to the CSV file'
      },
      options: {
        type: 'object',
        properties: {
          delimiter: { type: 'string', default: ',' },
          encoding: { type: 'string', default: 'utf-8' },
          hasHeader: { type: 'boolean', default: true },
          sampleSize: { type: 'number', description: 'Number of rows to sample for large files' },
          focusColumns: { type: 'array', items: { type: 'string' }, description: 'Specific columns to analyze' }
        }
      },
      analysisDepth: {
        type: 'string',
        enum: ['quick', 'standard', 'deep'],
        default: 'standard',
        description: 'Depth of analysis to perform'
      }
    }
  },

  // === Output Schema ===
  output: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      report: {
        type: 'object',
        description: 'Complete summary report',
        properties: {
          overview: { type: 'object' },
          columns: { type: 'array', items: { type: 'object' } },
          qualityIssues: { type: 'array', items: { type: 'object' } },
          insights: { type: 'array', items: { type: 'object' } },
          recommendations: { type: 'array', items: { type: 'string' } }
        }
      },
      visualizations: {
        type: 'array',
        description: 'Suggested visualizations',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            columns: { type: 'array', items: { type: 'string' } },
            title: { type: 'string' }
          }
        }
      },
      error: { type: 'string' }
    }
  },

  // === Execution ===
  async execute(input: SkillInput): Promise<SkillOutput> {
    const { filePath, options = {}, analysisDepth = 'standard' } = input;

    try {
      // Step 1: Load and parse data
      const data = await this.loadCSV(filePath, options);

      if (!data || data.length === 0) {
        return { success: false, error: 'No data found in file' };
      }

      // Step 2: Generate overview
      const overview = this.generateOverview(data);

      // Step 3: Profile columns
      const columns = this.profileColumns(data, options.focusColumns);

      // Step 4: Detect quality issues
      const qualityIssues = this.detectQualityIssues(data, columns);

      // Step 5: Generate insights (depth-dependent)
      const insights = this.generateInsights(data, columns, analysisDepth);

      // Step 6: Generate recommendations
      const recommendations = this.generateRecommendations(qualityIssues, insights);

      // Step 7: Suggest visualizations
      const visualizations = this.suggestVisualizations(columns, insights);

      const report: SummaryReport = {
        overview,
        columns,
        qualityIssues,
        insights,
        recommendations
      };

      return {
        success: true,
        report,
        visualizations
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  // === Validation ===
  validate(input: SkillInput): boolean {
    if (!input.filePath) return false;

    const validDepths = ['quick', 'standard', 'deep'];
    if (input.analysisDepth && !validDepths.includes(input.analysisDepth)) {
      return false;
    }

    return true;
  },

  // === Private Methods ===

  async loadCSV(filePath: string, options: any): Promise<Record<string, any>[]> {
    // Implementation would use csv-parse or similar library
    // This is a placeholder
    return [];
  },

  generateOverview(data: Record<string, any>[]): SummaryReport['overview'] {
    const rowCount = data.length;
    const columnCount = data.length > 0 ? Object.keys(data[0]).length : 0;

    let missingCells = 0;
    const seenRows = new Set<string>();
    let duplicateRows = 0;

    for (const row of data) {
      const rowKey = JSON.stringify(row);
      if (seenRows.has(rowKey)) {
        duplicateRows++;
      } else {
        seenRows.add(rowKey);
      }

      for (const value of Object.values(row)) {
        if (value == null || value === '') {
          missingCells++;
        }
      }
    }

    const totalCells = rowCount * columnCount;
    const missingPercent = totalCells > 0 ? (missingCells / totalCells) * 100 : 0;

    return {
      rowCount,
      columnCount,
      memorySize: this.estimateMemorySize(data),
      missingCells,
      missingPercent: Math.round(missingPercent * 100) / 100,
      duplicateRows
    };
  },

  profileColumns(data: Record<string, any>[], focusColumns?: string[]): ColumnProfile[] {
    if (data.length === 0) return [];

    const columnNames = focusColumns || Object.keys(data[0]);
    const profiles: ColumnProfile[] = [];

    for (const colName of columnNames) {
      const values = data.map(row => row[colName]);
      const nonNullValues = values.filter(v => v != null && v !== '');
      const profile = this.profileSingleColumn(colName, values, nonNullValues);
      profiles.push(profile);
    }

    return profiles;
  },

  profileSingleColumn(name: string, values: any[], nonNullValues: any[]): ColumnProfile {
    const count = values.length;
    const nullCount = count - nonNullValues.length;
    const uniqueValues = new Set(nonNullValues.map(String));

    const profile: ColumnProfile = {
      name,
      type: this.inferColumnType(nonNullValues),
      count,
      nullCount,
      nullPercent: Math.round((nullCount / count) * 10000) / 100,
      uniqueCount: uniqueValues.size,
      uniquePercent: Math.round((uniqueValues.size / (nonNullValues.length || 1)) * 10000) / 100
    };

    if (profile.type === 'numeric') {
      const numericValues = nonNullValues.map(Number).filter(n => !isNaN(n));
      if (numericValues.length > 0) {
        numericValues.sort((a, b) => a - b);
        profile.min = numericValues[0];
        profile.max = numericValues[numericValues.length - 1];
        profile.mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
        profile.median = this.calculateMedian(numericValues);
        profile.q25 = this.calculatePercentile(numericValues, 25);
        profile.q75 = this.calculatePercentile(numericValues, 75);
        profile.std = this.calculateStd(numericValues, profile.mean);
        profile.skewness = this.calculateSkewness(numericValues, profile.mean, profile.std);
      }
    } else if (profile.type === 'categorical') {
      profile.topValues = this.getTopValues(nonNullValues, 5);
    }

    return profile;
  },

  inferColumnType(values: any[]): ColumnProfile['type'] {
    if (values.length === 0) return 'text';

    let numericCount = 0;
    let dateCount = 0;
    let boolCount = 0;

    for (const v of values.slice(0, 100)) { // Sample first 100
      if (typeof v === 'number' || !isNaN(Number(v))) numericCount++;
      if (typeof v === 'boolean' || ['true', 'false', '0', '1'].includes(String(v).toLowerCase())) boolCount++;
      if (this.isDateLike(v)) dateCount++;
    }

    const sampleSize = Math.min(values.length, 100);
    if (numericCount / sampleSize > 0.8) return 'numeric';
    if (dateCount / sampleSize > 0.8) return 'datetime';
    if (boolCount / sampleSize > 0.8) return 'boolean';

    const uniqueRatio = new Set(values.map(String)).size / values.length;
    return uniqueRatio < 0.5 ? 'categorical' : 'text';
  },

  detectQualityIssues(data: Record<string, any>[], columns: ColumnProfile[]): DataQualityIssue[] {
    const issues: DataQualityIssue[] = [];

    for (const col of columns) {
      // Missing values
      if (col.nullPercent > 5) {
        issues.push({
          type: 'missing',
          column: col.name,
          severity: col.nullPercent > 20 ? 'high' : col.nullPercent > 10 ? 'medium' : 'low',
          description: `Column "${col.name}" has ${col.nullPercent}% missing values`,
          affectedRows: col.nullCount
        });
      }

      // Outliers (for numeric columns)
      if (col.type === 'numeric' && col.q25 !== undefined && col.q75 !== undefined) {
        const iqr = col.q75 - col.q25;
        const lowerBound = col.q25 - 1.5 * iqr;
        const upperBound = col.q75 + 1.5 * iqr;

        if (col.min !== undefined && col.max !== undefined) {
          if (col.min < lowerBound || col.max > upperBound) {
            issues.push({
              type: 'outlier',
              column: col.name,
              severity: 'medium',
              description: `Column "${col.name}" contains potential outliers (outside IQR bounds)`
            });
          }
        }
      }
    }

    return issues;
  },

  generateInsights(
    data: Record<string, any>[],
    columns: ColumnProfile[],
    depth: string
  ): Insight[] {
    const insights: Insight[] = [];

    // Distribution insights
    for (const col of columns) {
      if (col.type === 'numeric' && col.skewness !== undefined) {
        if (Math.abs(col.skewness) > 1) {
          insights.push({
            type: 'distribution',
            title: `Skewed distribution in ${col.name}`,
            description: `Column "${col.name}" shows ${col.skewness > 0 ? 'positive' : 'negative'} skewness (${col.skewness.toFixed(2)})`,
            confidence: 0.9,
            columns: [col.name],
            visualization: 'histogram'
          });
        }
      }
    }

    // Correlation insights (for standard and deep analysis)
    if (depth !== 'quick') {
      const numericCols = columns.filter(c => c.type === 'numeric');
      if (numericCols.length >= 2) {
        insights.push({
          type: 'correlation',
          title: 'Numeric column correlations available',
          description: `${numericCols.length} numeric columns can be analyzed for correlations`,
          confidence: 0.8,
          columns: numericCols.map(c => c.name),
          visualization: 'heatmap'
        });
      }
    }

    return insights;
  },

  generateRecommendations(issues: DataQualityIssue[], insights: Insight[]): string[] {
    const recommendations: string[] = [];

    // Based on quality issues
    const highMissingCols = issues.filter(i => i.type === 'missing' && i.severity === 'high');
    if (highMissingCols.length > 0) {
      recommendations.push(
        `Consider handling missing values in columns: ${highMissingCols.map(i => i.column).join(', ')}`
      );
    }

    const outlierCols = issues.filter(i => i.type === 'outlier');
    if (outlierCols.length > 0) {
      recommendations.push(
        `Review potential outliers in columns: ${outlierCols.map(i => i.column).join(', ')}`
      );
    }

    // Based on insights
    if (insights.some(i => i.type === 'correlation')) {
      recommendations.push('Perform correlation analysis to identify relationships between numeric variables');
    }

    return recommendations;
  },

  suggestVisualizations(columns: ColumnProfile[], insights: Insight[]): any[] {
    const visualizations: any[] = [];

    // Histogram for numeric columns
    for (const col of columns.filter(c => c.type === 'numeric')) {
      visualizations.push({
        type: 'histogram',
        columns: [col.name],
        title: `Distribution of ${col.name}`
      });
    }

    // Bar chart for categorical columns
    for (const col of columns.filter(c => c.type === 'categorical')) {
      visualizations.push({
        type: 'bar',
        columns: [col.name],
        title: `Frequency of ${col.name}`
      });
    }

    return visualizations.slice(0, 5); // Limit to top 5
  },

  // === Utility Methods ===

  estimateMemorySize(data: any[]): string {
    const bytes = JSON.stringify(data).length;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  calculateMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 !== 0
      ? sortedValues[mid]
      : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  },

  calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sortedValues[lower];
    return sortedValues[lower] * (upper - index) + sortedValues[upper] * (index - lower);
  },

  calculateStd(values: number[], mean: number): number {
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  },

  calculateSkewness(values: number[], mean: number, std: number): number {
    if (std === 0) return 0;
    const n = values.length;
    const cubedDiffs = values.map(v => Math.pow((v - mean) / std, 3));
    return (n / ((n - 1) * (n - 2))) * cubedDiffs.reduce((a, b) => a + b, 0);
  },

  getTopValues(values: any[], limit: number): { value: string; count: number; percent: number }[] {
    const counts = new Map<string, number>();
    for (const v of values) {
      const key = String(v);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({
        value,
        count,
        percent: Math.round((count / values.length) * 10000) / 100
      }));
  },

  isDateLike(value: any): boolean {
    if (value instanceof Date) return true;
    if (typeof value !== 'string') return false;
    // Simple date pattern check
    return /^\d{4}[-/]\d{2}[-/]\d{2}/.test(value) || /^\d{2}[-/]\d{2}[-/]\d{4}/.test(value);
  }
};

export default csv_summarizer;
