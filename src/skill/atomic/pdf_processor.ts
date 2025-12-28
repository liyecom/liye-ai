/**
 * LiYe AI Atomic Skill - PDF Processor
 * Location: src/skill/atomic/pdf_processor.ts
 *
 * L2 Executable Layer for PDF document processing
 * Supports: text extraction, table extraction, metadata, merge/split, form processing
 *
 * @source Adapted from awesome-claude-skills/pdf
 * @domain 05_Medical_Intelligence
 */

import { Skill, SkillInput, SkillOutput } from '../types';

// === Type Definitions ===
interface PageContent {
  pageNumber: number;
  text: string;
  tables: Table[];
  images: ImageInfo[];
}

interface Table {
  id: string;
  pageNumber: number;
  rows: string[][];
  headers?: string[];
}

interface ImageInfo {
  id: string;
  pageNumber: number;
  width: number;
  height: number;
  format: string;
}

interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pageCount: number;
  fileSize: number;
  isEncrypted: boolean;
  hasForm: boolean;
}

interface Section {
  title: string;
  level: number;
  pageStart: number;
  pageEnd?: number;
  content: string;
}

interface ExtractionOptions {
  pages?: number[] | string; // e.g., [1,2,3] or "1-5,7,10-15"
  extractTables?: boolean;
  extractImages?: boolean;
  extractMetadata?: boolean;
  preserveLayout?: boolean;
  ocrEnabled?: boolean;
}

// === Main Skill Definition ===
export const pdf_processor: Skill = {
  // === Metadata ===
  id: 'pdf_processor',
  name: 'PDF Processor',
  version: '1.0.0',
  description: 'Process PDF documents: extract text, tables, images, metadata; merge/split; handle forms',
  category: 'document-processing',

  // === Input Schema ===
  input: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        required: true,
        enum: ['extract', 'analyze', 'merge', 'split', 'metadata', 'form', 'search'],
        description: 'Operation to perform on PDF'
      },
      filePath: {
        type: 'string',
        required: true,
        description: 'Path to the PDF file (or array of paths for merge)'
      },
      options: {
        type: 'object',
        properties: {
          pages: { type: 'string', description: 'Page range (e.g., "1-5,7,10-15")' },
          extractTables: { type: 'boolean', default: true },
          extractImages: { type: 'boolean', default: false },
          extractMetadata: { type: 'boolean', default: true },
          preserveLayout: { type: 'boolean', default: false },
          ocrEnabled: { type: 'boolean', default: false }
        }
      },
      outputPath: {
        type: 'string',
        description: 'Output file path (for merge/split operations)'
      },
      searchQuery: {
        type: 'string',
        description: 'Search query (for search operation)'
      },
      formData: {
        type: 'object',
        description: 'Form field values (for form fill operation)'
      }
    }
  },

  // === Output Schema ===
  output: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      content: {
        type: 'object',
        properties: {
          fullText: { type: 'string' },
          pages: { type: 'array', items: { type: 'object' } },
          sections: { type: 'array', items: { type: 'object' } }
        }
      },
      tables: {
        type: 'array',
        items: { type: 'object' }
      },
      metadata: {
        type: 'object'
      },
      searchResults: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            context: { type: 'string' },
            position: { type: 'number' }
          }
        }
      },
      outputPath: { type: 'string' },
      error: { type: 'string' }
    }
  },

  // === Execution ===
  async execute(input: SkillInput): Promise<SkillOutput> {
    const { operation, filePath, options = {}, outputPath, searchQuery, formData } = input;

    try {
      switch (operation) {
        case 'extract':
          return await this.extractContent(filePath, options as ExtractionOptions);

        case 'analyze':
          return await this.analyzeDocument(filePath, options as ExtractionOptions);

        case 'merge':
          return await this.mergeDocuments(
            Array.isArray(filePath) ? filePath : [filePath],
            outputPath
          );

        case 'split':
          return await this.splitDocument(filePath, options.pages, outputPath);

        case 'metadata':
          return await this.extractMetadata(filePath);

        case 'form':
          return await this.processForm(filePath, formData, outputPath);

        case 'search':
          return await this.searchDocument(filePath, searchQuery);

        default:
          return { success: false, error: `Unknown operation: ${operation}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  // === Validation ===
  validate(input: SkillInput): boolean {
    const validOperations = ['extract', 'analyze', 'merge', 'split', 'metadata', 'form', 'search'];

    if (!input.operation || !validOperations.includes(input.operation)) {
      return false;
    }

    if (!input.filePath) {
      return false;
    }

    if (input.operation === 'search' && !input.searchQuery) {
      return false;
    }

    if ((input.operation === 'merge' || input.operation === 'split') && !input.outputPath) {
      return false;
    }

    return true;
  },

  // === Private Methods ===

  async extractContent(filePath: string, options: ExtractionOptions): Promise<SkillOutput> {
    // Implementation would use pdf-parse, pdfjs-dist, or similar
    // This is a placeholder for the actual implementation

    const pages = await this.extractPages(filePath, options);
    const tables = options.extractTables ? await this.extractTables(filePath, options) : [];
    const metadata = options.extractMetadata ? await this.getMetadata(filePath) : undefined;

    const fullText = pages.map(p => p.text).join('\n\n');
    const sections = this.identifySections(fullText);

    return {
      success: true,
      content: {
        fullText,
        pages,
        sections
      },
      tables,
      metadata
    };
  },

  async analyzeDocument(filePath: string, options: ExtractionOptions): Promise<SkillOutput> {
    const extractResult = await this.extractContent(filePath, { ...options, extractMetadata: true });

    if (!extractResult.success) {
      return extractResult;
    }

    // Perform additional analysis
    const analysis = {
      wordCount: this.countWords(extractResult.content?.fullText || ''),
      avgWordsPerPage: 0,
      tableCount: extractResult.tables?.length || 0,
      sectionCount: extractResult.content?.sections?.length || 0,
      documentType: this.inferDocumentType(extractResult.content?.fullText || ''),
      language: this.detectLanguage(extractResult.content?.fullText || ''),
      readingTime: 0 // minutes
    };

    if (extractResult.content?.pages) {
      analysis.avgWordsPerPage = Math.round(analysis.wordCount / extractResult.content.pages.length);
      analysis.readingTime = Math.ceil(analysis.wordCount / 200); // ~200 wpm average
    }

    return {
      ...extractResult,
      analysis
    };
  },

  async mergeDocuments(filePaths: string[], outputPath: string): Promise<SkillOutput> {
    // Implementation would use pdf-lib or similar
    // This is a placeholder

    return {
      success: true,
      outputPath,
      metadata: {
        sourceFiles: filePaths.length,
        pageCount: 0 // Would be calculated
      }
    };
  },

  async splitDocument(
    filePath: string,
    pageRanges: string | number[] | undefined,
    outputPath: string
  ): Promise<SkillOutput> {
    // Implementation would use pdf-lib or similar
    // This is a placeholder

    const ranges = this.parsePageRanges(pageRanges);

    return {
      success: true,
      outputPath,
      metadata: {
        outputFiles: ranges.length,
        pageRanges: ranges
      }
    };
  },

  async extractMetadata(filePath: string): Promise<SkillOutput> {
    const metadata = await this.getMetadata(filePath);

    return {
      success: true,
      metadata
    };
  },

  async processForm(
    filePath: string,
    formData: Record<string, any> | undefined,
    outputPath?: string
  ): Promise<SkillOutput> {
    // Read form fields
    const formFields = await this.getFormFields(filePath);

    if (formData && outputPath) {
      // Fill and save form
      await this.fillForm(filePath, formData, outputPath);

      return {
        success: true,
        outputPath,
        formFields
      };
    }

    return {
      success: true,
      formFields
    };
  },

  async searchDocument(filePath: string, query: string): Promise<SkillOutput> {
    const content = await this.extractContent(filePath, { extractTables: false });

    if (!content.success || !content.content?.pages) {
      return { success: false, error: 'Failed to extract content for search' };
    }

    const searchResults: { page: number; context: string; position: number }[] = [];
    const queryLower = query.toLowerCase();

    for (const page of content.content.pages) {
      const textLower = page.text.toLowerCase();
      let position = textLower.indexOf(queryLower);

      while (position !== -1) {
        const contextStart = Math.max(0, position - 50);
        const contextEnd = Math.min(page.text.length, position + query.length + 50);
        const context = page.text.substring(contextStart, contextEnd);

        searchResults.push({
          page: page.pageNumber,
          context: `...${context}...`,
          position
        });

        position = textLower.indexOf(queryLower, position + 1);
      }
    }

    return {
      success: true,
      searchResults,
      metadata: {
        totalMatches: searchResults.length,
        pagesWithMatches: new Set(searchResults.map(r => r.page)).size
      }
    };
  },

  // === Helper Methods ===

  async extractPages(filePath: string, options: ExtractionOptions): Promise<PageContent[]> {
    // Placeholder - would use pdf library
    return [];
  },

  async extractTables(filePath: string, options: ExtractionOptions): Promise<Table[]> {
    // Placeholder - would use tabula-js or camelot equivalent
    return [];
  },

  async getMetadata(filePath: string): Promise<PDFMetadata> {
    // Placeholder - would use pdf library
    return {
      pageCount: 0,
      fileSize: 0,
      isEncrypted: false,
      hasForm: false
    };
  },

  async getFormFields(filePath: string): Promise<any[]> {
    // Placeholder - would use pdf-lib
    return [];
  },

  async fillForm(filePath: string, formData: Record<string, any>, outputPath: string): Promise<void> {
    // Placeholder - would use pdf-lib
  },

  identifySections(text: string): Section[] {
    const sections: Section[] = [];
    const lines = text.split('\n');

    // Simple heuristic: lines that are all caps or numbered headings
    const headingPatterns = [
      /^(?:\d+\.)+\s+[A-Z]/,           // 1. HEADING or 1.1 HEADING
      /^[A-Z][A-Z\s]{10,}$/,            // ALL CAPS HEADING
      /^(?:ABSTRACT|INTRODUCTION|METHODS|RESULTS|DISCUSSION|CONCLUSION|REFERENCES)/i
    ];

    let currentSection: Section | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      for (const pattern of headingPatterns) {
        if (pattern.test(line)) {
          if (currentSection) {
            sections.push(currentSection);
          }
          currentSection = {
            title: line,
            level: this.inferHeadingLevel(line),
            pageStart: Math.floor(i / 50) + 1, // Rough page estimate
            content: ''
          };
          break;
        }
      }

      if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  },

  inferHeadingLevel(heading: string): number {
    // Count numbered levels: "1.2.3" = level 3
    const match = heading.match(/^((?:\d+\.)+)/);
    if (match) {
      return match[1].split('.').filter(Boolean).length;
    }
    // IMRAD sections are level 1
    if (/^(?:ABSTRACT|INTRODUCTION|METHODS|RESULTS|DISCUSSION|CONCLUSION|REFERENCES)/i.test(heading)) {
      return 1;
    }
    return 2;
  },

  parsePageRanges(input: string | number[] | undefined): number[][] {
    if (!input) return [[1]]; // Default to first page

    if (Array.isArray(input)) {
      return input.map(p => [p]);
    }

    // Parse string like "1-5,7,10-15"
    const ranges: number[][] = [];
    const parts = input.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(Number);
        const range: number[] = [];
        for (let i = start; i <= end; i++) {
          range.push(i);
        }
        ranges.push(range);
      } else {
        ranges.push([Number(trimmed)]);
      }
    }

    return ranges;
  },

  countWords(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  },

  inferDocumentType(text: string): string {
    const lower = text.toLowerCase();

    if (/abstract.*introduction.*methods.*results.*discussion/s.test(lower)) {
      return 'research_paper';
    }
    if (/clinical\s+practice\s+guideline|recommendation\s+grade/i.test(lower)) {
      return 'clinical_guideline';
    }
    if (/table\s+of\s+contents|chapter\s+\d/i.test(lower)) {
      return 'book_or_report';
    }
    if (/invoice|bill\s+to|total\s+due/i.test(lower)) {
      return 'invoice';
    }
    if (/contract|agreement|parties/i.test(lower)) {
      return 'contract';
    }

    return 'general_document';
  },

  detectLanguage(text: string): string {
    // Very simple detection based on common words
    const sample = text.substring(0, 1000).toLowerCase();

    if (/\b(the|and|is|are|have|has)\b/.test(sample)) return 'en';
    if (/\b(的|是|在|了|和)\b/.test(sample)) return 'zh';
    if (/\b(der|die|das|und|ist)\b/.test(sample)) return 'de';
    if (/\b(le|la|les|de|et)\b/.test(sample)) return 'fr';
    if (/\b(el|la|los|de|y)\b/.test(sample)) return 'es';

    return 'unknown';
  }
};

export default pdf_processor;
