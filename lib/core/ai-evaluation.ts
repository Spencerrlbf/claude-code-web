/**
 * AI Evaluation Module
 *
 * This module isolates all researcher fit evaluation logic, providing a clean,
 * testable interface for evaluating how well candidates match a job description.
 *
 * Features:
 * - Graceful error handling (individual failures don't stop the process)
 * - Sequential processing to respect API rate limits
 * - Default fallback scores for failed evaluations
 * - Structured results with success indicators
 *
 * @module lib/core/ai-evaluation
 */

import type { AuthorCandidate, SearchStrategy } from '@/lib/types';
import {
  createOpenAIService,
  type OpenAIServiceInterface,
} from '@/lib/services/openai-service';

/**
 * Result of evaluating a single researcher
 */
export interface EvaluationResult {
  /** Name of the author evaluated */
  authorName: string;
  /** AI-generated relevance score (0-100) */
  score: number;
  /** Explanation of why the researcher is a good/poor fit */
  reason: string;
  /** Whether the evaluation succeeded */
  success: boolean;
  /** Error message if evaluation failed */
  error?: string;
}

/**
 * Optional configuration for evaluation behavior
 */
export interface EvaluationOptions {
  /** Maximum number of retry attempts per evaluation (not yet implemented) */
  maxRetries?: number;
  /** Timeout in milliseconds for each evaluation (not yet implemented) */
  timeout?: number;
  /** Default score to use when evaluation fails (default: 50) */
  defaultScore?: number;
  /** OpenAI service instance (for dependency injection in tests) */
  openAIService?: OpenAIServiceInterface;
}

/**
 * Evaluates a single researcher candidate against the job description.
 *
 * This is an internal helper function that handles individual candidate evaluation
 * with error handling and fallback behavior.
 *
 * @param candidate - The author candidate to evaluate
 * @param jobDescription - The job description to evaluate against
 * @param strategies - Search strategies used to find the candidate
 * @param options - Optional configuration
 * @returns Evaluation result for this candidate
 */
async function evaluateSingleResearcher(
  candidate: AuthorCandidate,
  jobDescription: string,
  strategies: SearchStrategy[],
  options?: EvaluationOptions
): Promise<EvaluationResult> {
  const openAIService = options?.openAIService || createOpenAIService();

  try {
    // Call OpenAI service to evaluate fit
    const evaluation = await openAIService.evaluateResearcherFit(
      candidate,
      jobDescription,
      strategies
    );

    return {
      authorName: candidate.name,
      score: evaluation.score || 0,
      reason: evaluation.reason || '',
      success: true,
    };
  } catch (error) {
    // Graceful fallback - return default score with error info
    const defaultScore = options?.defaultScore ?? 50;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      authorName: candidate.name,
      score: defaultScore,
      reason: 'Unable to evaluate - using default score',
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Evaluates multiple researcher candidates sequentially against a job description.
 *
 * This function processes candidates one at a time to respect API rate limits.
 * If an individual evaluation fails, the process continues with remaining candidates,
 * and the failed candidate receives a default score.
 *
 * @param candidates - Array of author candidates to evaluate
 * @param jobDescription - The job description to evaluate against
 * @param strategies - Search strategies used to find the candidates
 * @param options - Optional configuration for evaluation behavior
 * @returns Array of evaluation results, one per candidate
 *
 * @example
 * ```typescript
 * const results = await evaluateResearchers(
 *   topCandidates,
 *   jobDescription,
 *   searchStrategies,
 *   { defaultScore: 40 }
 * );
 *
 * // Check for failures
 * const failures = results.filter(r => !r.success);
 * console.log(`${failures.length} evaluations failed`);
 *
 * // Get successful evaluations
 * const successful = results.filter(r => r.success);
 * ```
 */
export async function evaluateResearchers(
  candidates: AuthorCandidate[],
  jobDescription: string,
  strategies: SearchStrategy[],
  options?: EvaluationOptions
): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];

  // Process candidates sequentially to respect API rate limits
  for (const candidate of candidates) {
    const result = await evaluateSingleResearcher(
      candidate,
      jobDescription,
      strategies,
      options
    );
    results.push(result);
  }

  return results;
}
