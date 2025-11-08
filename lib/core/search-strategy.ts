/**
 * Search Strategy Module
 *
 * Orchestrates the generation and execution of intelligent search strategies
 * for finding relevant research papers. This module is responsible for:
 * - Generating search strategies from job descriptions using AI
 * - Executing multiple search strategies in parallel
 * - Deduplicating papers across strategies
 *
 * @module lib/core/search-strategy
 */

import type { SearchStrategy, ArxivPaper } from '@/lib/types';
import type { createOpenAIService } from '@/lib/services/openai-service';
import type { createArxivService } from '@/lib/services/arxiv-service';
import { config } from '@/lib/utils/config';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Metadata about a search strategy's execution
 */
export interface StrategyMetadata {
  /** Strategy name */
  name: string;
  /** Strategy rationale */
  rationale: string;
  /** Number of papers found by this strategy */
  papersFound: number;
  /** Number of queries executed in this strategy */
  queriesExecuted: number;
}

/**
 * Result of executing search strategies
 */
export interface StrategyExecutionResult {
  /** All unique papers found across strategies */
  papers: ArxivPaper[];
  /** Metadata about each strategy's performance */
  strategiesUsed: StrategyMetadata[];
  /** Total papers before deduplication */
  totalPapersFound: number;
  /** Number of duplicate papers removed */
  duplicatesRemoved: number;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate intelligent search strategies from a job description
 *
 * Uses AI to analyze the JD and create 3-5 diverse search strategies,
 * each with multiple arXiv search queries.
 *
 * @param jobDescription - The job description to analyze
 * @param openaiService - OpenAI service instance for strategy generation
 * @returns Array of search strategies
 *
 * @example
 * ```typescript
 * const strategies = await generateSearchStrategies(
 *   'Looking for ML engineer with NLP experience',
 *   openaiService
 * );
 * // Returns: [
 * //   { name: 'Core Skills', rationale: '...', queries: ['NLP', 'machine learning'] },
 * //   { name: 'Adjacent Areas', rationale: '...', queries: ['transformers', 'BERT'] }
 * // ]
 * ```
 */
export async function generateSearchStrategies(
  jobDescription: string,
  openaiService: ReturnType<typeof createOpenAIService>
): Promise<SearchStrategy[]> {
  // Call OpenAI service to generate strategies
  const strategies = await openaiService.generateSearchStrategies(jobDescription);

  return strategies;
}

/**
 * Execute multiple search strategies in parallel
 *
 * For each strategy, runs all queries and aggregates results.
 * Deduplicates papers across all strategies by paper ID.
 * Handles errors gracefully - continues execution even if some queries fail.
 *
 * @param strategies - Array of search strategies to execute
 * @param arxivService - arXiv service instance for paper search
 * @returns Execution results with papers and metadata
 *
 * @example
 * ```typescript
 * const result = await executeSearchStrategies(strategies, arxivService);
 * console.log(`Found ${result.papers.length} unique papers`);
 * console.log(`Removed ${result.duplicatesRemoved} duplicates`);
 * ```
 */
export async function executeSearchStrategies(
  strategies: SearchStrategy[],
  arxivService: ReturnType<typeof createArxivService>
): Promise<StrategyExecutionResult> {
  // Handle empty strategies array
  if (strategies.length === 0) {
    return {
      papers: [],
      strategiesUsed: [],
      totalPapersFound: 0,
      duplicatesRemoved: 0,
    };
  }

  console.log(`Executing ${strategies.length} search strategies...`);

  const allPapers: ArxivPaper[] = [];
  const strategiesUsed: StrategyMetadata[] = [];

  // Execute all strategies
  for (const strategy of strategies) {
    console.log(`Strategy: ${strategy.name} - ${strategy.queries.length} queries`);
    let strategyPapers: ArxivPaper[] = [];

    // Execute all queries for this strategy
    for (const query of strategy.queries) {
      try {
        console.log(`  Searching: ${query}`);
        const papers = await arxivService.searchPapers(
          query,
          config.arxiv.maxResultsPerQuery
        );
        strategyPapers.push(...papers);
        console.log(`    Found ${papers.length} papers`);
      } catch (error) {
        console.error(
          `  Error executing query "${query}":`,
          error instanceof Error ? error.message : error
        );
        // Continue to next query even if this one fails
      }
    }

    allPapers.push(...strategyPapers);
    strategiesUsed.push({
      name: strategy.name,
      rationale: strategy.rationale,
      papersFound: strategyPapers.length,
      queriesExecuted: strategy.queries.length,
    });
  }

  // Track total before deduplication
  const totalPapersFound = allPapers.length;

  // Deduplicate papers by ID
  const uniquePapers = deduplicatePapers(allPapers);

  const duplicatesRemoved = totalPapersFound - uniquePapers.length;

  console.log(`Total papers before deduplication: ${totalPapersFound}`);
  console.log(`Unique papers after deduplication: ${uniquePapers.length}`);
  console.log(`Duplicates removed: ${duplicatesRemoved}`);

  return {
    papers: uniquePapers,
    strategiesUsed,
    totalPapersFound,
    duplicatesRemoved,
  };
}

/**
 * Deduplicate papers by ID
 *
 * Takes an array of papers and removes duplicates, keeping only the
 * first occurrence of each paper ID. Uses a Map for O(1) lookups.
 *
 * @param papers - Array of papers (may contain duplicates)
 * @returns Array of unique papers
 *
 * @example
 * ```typescript
 * const papers = [
 *   { id: 'paper1', title: 'Paper 1', ... },
 *   { id: 'paper2', title: 'Paper 2', ... },
 *   { id: 'paper1', title: 'Paper 1 (duplicate)', ... }
 * ];
 * const unique = deduplicatePapers(papers);
 * // Returns: 2 papers (paper1 and paper2)
 * ```
 */
export function deduplicatePapers(papers: ArxivPaper[]): ArxivPaper[] {
  // Use Map for O(1) lookups and to preserve insertion order
  const uniquePapersMap = new Map<string, ArxivPaper>();

  papers.forEach((paper) => {
    // Only keep first occurrence
    if (!uniquePapersMap.has(paper.id)) {
      uniquePapersMap.set(paper.id, paper);
    }
  });

  return Array.from(uniquePapersMap.values());
}
