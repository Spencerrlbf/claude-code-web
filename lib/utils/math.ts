/**
 * Mathematical utility functions for vector operations
 * @module lib/utils/math
 */

/**
 * Calculate the cosine similarity between two vectors.
 *
 * Cosine similarity measures the cosine of the angle between two vectors,
 * ranging from -1 (opposite direction) to 1 (same direction), with 0 indicating
 * orthogonality (perpendicular vectors).
 *
 * This is commonly used to measure similarity between embedding vectors in
 * machine learning applications, particularly for semantic similarity between
 * text embeddings.
 *
 * Formula: similarity = (A · B) / (||A|| × ||B||)
 * - A · B is the dot product of vectors A and B
 * - ||A|| is the magnitude (L2 norm) of vector A
 * - ||B|| is the magnitude (L2 norm) of vector B
 *
 * @param vecA - First vector (array of numbers)
 * @param vecB - Second vector (array of numbers)
 * @returns Cosine similarity score between -1 and 1
 * @throws {Error} If vectors have different lengths
 *
 * @example
 * ```typescript
 * // Calculate similarity between two vectors
 * const similarity = cosineSimilarity([1, 2, 3], [4, 5, 6]);
 * console.log(similarity); // ~0.9746 (high similarity, same direction)
 *
 * // Identical vectors have perfect similarity
 * const identical = cosineSimilarity([1, 0], [1, 0]);
 * console.log(identical); // 1.0
 *
 * // Orthogonal (perpendicular) vectors have zero similarity
 * const orthogonal = cosineSimilarity([1, 0], [0, 1]);
 * console.log(orthogonal); // 0.0
 *
 * // Opposite direction vectors have negative similarity
 * const opposite = cosineSimilarity([1, 2], [-1, -2]);
 * console.log(opposite); // -1.0
 * ```
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  // Validate that vectors have the same length
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  // Handle empty vectors edge case
  // Empty vectors have no direction, so similarity is undefined (return 0)
  if (vecA.length === 0) {
    return 0;
  }

  // Calculate dot product and norms in a single pass for efficiency
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  // Calculate magnitudes (L2 norms)
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  // Handle zero vectors
  // If either vector is zero (magnitude = 0), similarity is undefined (return 0)
  if (normA === 0 || normB === 0) {
    return 0;
  }

  // Return cosine similarity: cos(θ) = (A · B) / (||A|| × ||B||)
  return dotProduct / (normA * normB);
}
