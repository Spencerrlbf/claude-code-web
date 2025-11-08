/**
 * Paper Matching Module
 *
 * Handles semantic similarity calculation and filtering of research papers
 * based on job description embeddings.
 *
 * This module provides:
 * - Similarity calculation between JD and papers
 * - Adaptive and fixed threshold filtering
 * - Statistical analysis of similarity scores
 * - Configurable min/max paper constraints
 *
 * @module lib/core/paper-matching
 */

import { cosineSimilarity } from '../utils/math';
import { PaperWithEmbedding, SimilarityStats } from '../types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Options for the matchPapers function
 */
export interface MatchPapersOptions {
  /** Whether to use adaptive threshold (default: true) */
  useAdaptive?: boolean;
  /** Fixed threshold to use when useAdaptive is false (default: 0.6) */
  threshold?: number;
  /** Minimum number of papers to return (will lower threshold if needed) */
  minPapers?: number;
  /** Maximum number of papers to return */
  maxPapers?: number;
  /** Include debug information in result */
  includeDebug?: boolean;
}

/**
 * Result from the matchPapers function
 */
export interface MatchPapersResult {
  /** Papers that passed the threshold filter */
  filteredPapers: PaperWithEmbedding[];
  /** All papers with their similarity scores (sorted by score) */
  allPapersWithScores: PaperWithEmbedding[];
  /** Statistics about all similarity scores */
  stats: SimilarityStats;
  /** The threshold that was used for filtering */
  threshold: number;
  /** Optional debug information */
  debug?: {
    totalPapers: number;
    papersAboveThreshold: number;
    papersReturned: number;
    thresholdUsed: 'adaptive' | 'fixed';
    adaptiveCalculation?: {
      median: number;
      stddev: number;
      calculated: number;
      capped: number;
    };
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Calculate similarity scores between a job description embedding and paper embeddings.
 * Returns papers sorted by similarity score in descending order.
 *
 * @param jdEmbedding - Job description embedding vector
 * @param papers - Array of papers with embeddings
 * @returns Array of papers with similarity scores, sorted descending by score
 *
 * @example
 * ```typescript
 * const jdEmbedding = [0.1, 0.2, 0.3, ...];
 * const papers = [...]; // Papers with embeddings
 * const scored = calculateSimilarities(jdEmbedding, papers);
 * console.log(scored[0].similarityScore); // Highest similarity
 * ```
 */
export function calculateSimilarities(
  jdEmbedding: number[],
  papers: PaperWithEmbedding[]
): PaperWithEmbedding[] {
  if (papers.length === 0) {
    return [];
  }

  // Calculate similarity for each paper
  const papersWithScores = papers.map((paper) => ({
    ...paper,
    similarityScore: cosineSimilarity(jdEmbedding, paper.embedding),
  }));

  // Sort by similarity score in descending order
  papersWithScores.sort((a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0));

  return papersWithScores;
}

/**
 * Filter papers by a similarity threshold.
 * Returns only papers with similarity score >= threshold.
 *
 * @param papers - Papers with similarity scores
 * @param threshold - Minimum similarity score (0-1)
 * @returns Filtered papers above threshold
 *
 * @example
 * ```typescript
 * const filtered = filterByThreshold(papers, 0.7);
 * // Returns only papers with score >= 0.7
 * ```
 */
export function filterByThreshold(
  papers: PaperWithEmbedding[],
  threshold: number
): PaperWithEmbedding[] {
  return papers.filter((paper) => (paper.similarityScore ?? 0) >= threshold);
}

/**
 * Calculate an adaptive threshold based on the distribution of similarity scores.
 * Uses the formula: median + 0.5 * standard deviation
 * Capped between 0.45 (min) and 0.95 (max).
 *
 * @param scores - Array of similarity scores
 * @returns Calculated adaptive threshold
 *
 * @example
 * ```typescript
 * const scores = [0.5, 0.6, 0.7, 0.8, 0.9];
 * const threshold = calculateAdaptiveThreshold(scores);
 * // Returns ~0.77 (median=0.7, stddev=0.14)
 * ```
 */
export function calculateAdaptiveThreshold(scores: number[]): number {
  if (scores.length === 0) {
    return 0.45; // Minimum threshold as fallback
  }

  if (scores.length === 1) {
    // Single score: return the score itself, capped
    return Math.max(0.45, Math.min(0.95, scores[0]));
  }

  // Calculate median
  const sortedScores = [...scores].sort((a, b) => a - b);
  const median = calculateMedian(sortedScores);

  // Calculate standard deviation
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance =
    scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stddev = Math.sqrt(variance);

  // Adaptive threshold: median + 0.5 * stddev
  const adaptiveThreshold = median + 0.5 * stddev;

  // Cap between 0.45 and 0.95
  return Math.max(0.45, Math.min(0.95, adaptiveThreshold));
}

/**
 * Compute statistics for an array of similarity scores.
 *
 * @param scores - Array of similarity scores
 * @returns Statistics object with min, max, avg, median
 *
 * @example
 * ```typescript
 * const stats = computeSimilarityStats([0.5, 0.6, 0.7, 0.8, 0.9]);
 * // { min: 0.5, max: 0.9, avg: 0.7, median: 0.7 }
 * ```
 */
export function computeSimilarityStats(scores: number[]): SimilarityStats {
  if (scores.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0 };
  }

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const median = calculateMedian([...scores].sort((a, b) => a - b));

  return { min, max, avg, median };
}

/**
 * Helper function to calculate median of a sorted array
 * @param sortedScores - Array of scores sorted in ascending order
 * @returns Median value
 */
function calculateMedian(sortedScores: number[]): number {
  if (sortedScores.length === 0) {
    return 0;
  }

  const mid = Math.floor(sortedScores.length / 2);

  if (sortedScores.length % 2 === 0) {
    // Even number of elements: average of middle two
    return (sortedScores[mid - 1] + sortedScores[mid]) / 2;
  } else {
    // Odd number of elements: middle element
    return sortedScores[mid];
  }
}

// ============================================================================
// Main Matching Function
// ============================================================================

/**
 * Main paper matching function that orchestrates the entire matching pipeline.
 *
 * Process:
 * 1. Calculate similarity scores for all papers
 * 2. Determine threshold (adaptive or fixed)
 * 3. Filter papers by threshold
 * 4. Enforce min/max paper constraints
 * 5. Compute statistics
 *
 * @param jdEmbedding - Job description embedding vector
 * @param papers - Array of papers with embeddings
 * @param options - Optional configuration
 * @returns Match result with filtered papers, stats, and debug info
 *
 * @example
 * ```typescript
 * // Use adaptive threshold (default)
 * const result = matchPapers(jdEmbedding, papers);
 *
 * // Use fixed threshold
 * const result = matchPapers(jdEmbedding, papers, {
 *   useAdaptive: false,
 *   threshold: 0.7
 * });
 *
 * // Enforce constraints
 * const result = matchPapers(jdEmbedding, papers, {
 *   minPapers: 10,
 *   maxPapers: 60
 * });
 * ```
 */
export function matchPapers(
  jdEmbedding: number[],
  papers: PaperWithEmbedding[],
  options: MatchPapersOptions = {}
): MatchPapersResult {
  // Default options
  // If threshold is explicitly provided but useAdaptive is not, default to fixed threshold
  const hasCustomThreshold = options.threshold !== undefined;
  const {
    useAdaptive = hasCustomThreshold ? false : true,
    threshold: fixedThreshold = 0.6,
    minPapers,
    maxPapers,
    includeDebug = false,
  } = options;

  // Handle empty papers array
  if (papers.length === 0) {
    return {
      filteredPapers: [],
      allPapersWithScores: [],
      stats: { min: 0, max: 0, avg: 0, median: 0 },
      threshold: useAdaptive ? 0.45 : fixedThreshold,
      debug: includeDebug
        ? {
            totalPapers: 0,
            papersAboveThreshold: 0,
            papersReturned: 0,
            thresholdUsed: useAdaptive ? 'adaptive' : 'fixed',
          }
        : undefined,
    };
  }

  // Step 1: Calculate similarities
  const allPapersWithScores = calculateSimilarities(jdEmbedding, papers);

  // Step 2: Compute statistics
  const scores = allPapersWithScores.map((p) => p.similarityScore ?? 0);
  const stats = computeSimilarityStats(scores);

  // Step 3: Determine threshold
  let threshold: number;
  let adaptiveDebugInfo:
    | {
        median: number;
        stddev: number;
        calculated: number;
        capped: number;
      }
    | undefined;

  if (useAdaptive) {
    const calculated = calculateAdaptiveThreshold(scores);
    threshold = calculated;

    if (includeDebug) {
      const sortedScores = [...scores].sort((a, b) => a - b);
      const median = calculateMedian(sortedScores);
      const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const variance =
        scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
      const stddev = Math.sqrt(variance);

      adaptiveDebugInfo = {
        median,
        stddev,
        calculated: median + 0.5 * stddev,
        capped: threshold,
      };
    }
  } else {
    threshold = fixedThreshold;
  }

  // Step 4: Filter by threshold
  let filteredPapers = filterByThreshold(allPapersWithScores, threshold);

  // Step 5: Enforce minPapers constraint (lower threshold if needed)
  if (minPapers !== undefined && filteredPapers.length < minPapers) {
    // Take top N papers even if below threshold
    filteredPapers = allPapersWithScores.slice(0, Math.min(minPapers, papers.length));
  }

  // Step 6: Enforce maxPapers constraint
  if (maxPapers !== undefined && filteredPapers.length > maxPapers) {
    filteredPapers = filteredPapers.slice(0, maxPapers);
  }

  // Step 7: Build result
  const result: MatchPapersResult = {
    filteredPapers,
    allPapersWithScores,
    stats,
    threshold,
  };

  // Add debug info if requested
  if (includeDebug) {
    const papersAboveThreshold = filterByThreshold(allPapersWithScores, threshold).length;

    result.debug = {
      totalPapers: papers.length,
      papersAboveThreshold,
      papersReturned: filteredPapers.length,
      thresholdUsed: useAdaptive ? 'adaptive' : 'fixed',
      adaptiveCalculation: adaptiveDebugInfo,
    };
  }

  return result;
}
