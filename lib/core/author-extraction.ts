/**
 * Author Extraction Module
 *
 * This module handles the extraction and deduplication of authors from research papers.
 * It ensures each unique author is represented only once, associated with their
 * highest-scoring paper.
 *
 * @module lib/core/author-extraction
 */

import type { PaperWithEmbedding, AuthorCandidate } from '@/lib/types';

/**
 * Normalizes an author name for deduplication purposes.
 *
 * Converts the name to lowercase and normalizes whitespace to handle
 * variations like "Alice Smith", "alice smith", "  Alice   Smith  " as
 * the same person.
 *
 * @param name - The author name to normalize
 * @returns The normalized name (lowercase, trimmed, single spaces)
 *
 * @example
 * ```typescript
 * normalizeAuthorName('  Alice   Smith  ') // Returns: 'alice smith'
 * normalizeAuthorName('ALICE SMITH')      // Returns: 'alice smith'
 * ```
 */
function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

/**
 * Extracts unique authors from a collection of papers.
 *
 * For authors appearing in multiple papers, this function keeps the association
 * with their highest-scoring paper. Author names are normalized to handle case
 * and whitespace variations, but the original casing from the highest-scoring
 * paper is preserved in the output.
 *
 * The function uses a Map for efficient O(1) lookups during deduplication,
 * making it performant even with large paper sets (100+ papers with multiple
 * authors each).
 *
 * @param papers - Array of papers with embeddings and similarity scores
 * @returns Array of unique author candidates with their best papers
 *
 * @example
 * ```typescript
 * const papers = [
 *   { id: '1', authors: ['Alice Smith'], similarityScore: 0.85, ... },
 *   { id: '2', authors: ['alice smith'], similarityScore: 0.92, ... },
 *   { id: '3', authors: ['Bob Jones'], similarityScore: 0.75, ... }
 * ];
 *
 * const authors = extractAuthors(papers);
 * // Returns:
 * // [
 * //   { name: 'alice smith', paper: {...id: '2'...}, similarityScore: 0.92 },
 * //   { name: 'Bob Jones', paper: {...id: '3'...}, similarityScore: 0.75 }
 * // ]
 * ```
 *
 * @remarks
 * - Time complexity: O(n × m) where n = number of papers, m = average authors per paper
 * - Space complexity: O(k) where k = number of unique authors
 * - Papers without similarity scores are treated as having a score of 0
 * - Empty author names are skipped
 * - When scores are equal, the first paper encountered wins
 */
export function extractAuthors(papers: PaperWithEmbedding[]): AuthorCandidate[] {
  // Handle edge case: empty input
  if (!papers || papers.length === 0) {
    return [];
  }

  // Map to track best paper per author (normalized name -> candidate)
  // Using Map for O(1) lookups during deduplication
  const authorMap = new Map<string, AuthorCandidate>();

  // Process each paper
  for (const paper of papers) {
    // Skip papers with no authors
    if (!paper.authors || paper.authors.length === 0) {
      continue;
    }

    // Get similarity score, defaulting to 0 if not present
    const paperScore = paper.similarityScore ?? 0;

    // Process each author in the paper
    for (const authorName of paper.authors) {
      // Skip empty author names
      if (!authorName || authorName.trim() === '') {
        continue;
      }

      // Normalize name for comparison
      const normalizedName = normalizeAuthorName(authorName);

      // Get existing candidate for this author (if any)
      const existingCandidate = authorMap.get(normalizedName);

      // Keep this paper if:
      // 1. Author not seen before, OR
      // 2. This paper has higher similarity than existing best
      if (!existingCandidate || paperScore > existingCandidate.similarityScore) {
        authorMap.set(normalizedName, {
          name: authorName, // Keep original casing from this paper
          paper: paper,
          similarityScore: paperScore,
        });
      }
    }
  }

  // Convert Map values to array and return
  return Array.from(authorMap.values());
}
