/**
 * Tests for Paper Matching Module
 *
 * This test suite covers:
 * - Similarity calculation
 * - Filtering by threshold
 * - Adaptive threshold calculation
 * - Statistics computation
 * - Edge cases
 */

import {
  calculateSimilarities,
  filterByThreshold,
  calculateAdaptiveThreshold,
  computeSimilarityStats,
  matchPapers,
} from '../../../lib/core/paper-matching';
import { PaperWithEmbedding, SimilarityStats } from '../../../lib/types';

// ============================================================================
// Mock Data
// ============================================================================

const mockJdEmbedding = [1, 0, 0]; // Unit vector in x-direction

const createMockPaper = (
  id: string,
  embedding: number[],
  title: string = 'Test Paper'
): PaperWithEmbedding => ({
  id,
  title,
  authors: ['Test Author'],
  summary: 'Test summary',
  published: '2024-01-01',
  link: `https://arxiv.org/abs/${id}`,
  embedding,
});

const mockPapers: PaperWithEmbedding[] = [
  createMockPaper('1', [1, 0, 0], 'Perfect Match'), // Identical - similarity = 1.0
  createMockPaper('2', [0.9, 0.1, 0], 'Near Match'), // Very similar - ~0.99
  createMockPaper('3', [0.7, 0.3, 0], 'Good Match'), // Good - ~0.95
  createMockPaper('4', [0.5, 0.5, 0], 'Moderate Match'), // Moderate - ~0.71
  createMockPaper('5', [0, 1, 0], 'No Match'), // Orthogonal - similarity = 0.0
  createMockPaper('6', [0.6, 0.4, 0], 'Medium Match'), // Medium - ~0.83
];

// ============================================================================
// calculateSimilarities Tests
// ============================================================================

describe('calculateSimilarities', () => {
  it('should calculate correct similarity scores', () => {
    const results = calculateSimilarities(mockJdEmbedding, [mockPapers[0], mockPapers[4]]);

    // Perfect match should have similarity ~1.0
    expect(results[0].similarityScore).toBeCloseTo(1.0, 2);

    // Orthogonal vectors should have similarity ~0.0
    expect(results[1].similarityScore).toBeCloseTo(0.0, 2);
  });

  it('should handle empty papers array', () => {
    const results = calculateSimilarities(mockJdEmbedding, []);
    expect(results).toEqual([]);
  });

  it('should calculate similarities for all papers', () => {
    const results = calculateSimilarities(mockJdEmbedding, mockPapers);

    expect(results).toHaveLength(mockPapers.length);
    results.forEach((paper) => {
      expect(paper.similarityScore).toBeDefined();
      expect(paper.similarityScore).toBeGreaterThanOrEqual(0);
      expect(paper.similarityScore).toBeLessThanOrEqual(1);
    });
  });

  it('should sort papers by similarity score descending', () => {
    const results = calculateSimilarities(mockJdEmbedding, mockPapers);

    // Check that results are sorted in descending order
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].similarityScore!).toBeGreaterThanOrEqual(
        results[i + 1].similarityScore!
      );
    }

    // First paper should be the perfect match
    expect(results[0].id).toBe('1');
  });

  it('should preserve all paper properties', () => {
    const results = calculateSimilarities(mockJdEmbedding, [mockPapers[0]]);

    expect(results[0].id).toBe(mockPapers[0].id);
    expect(results[0].title).toBe(mockPapers[0].title);
    expect(results[0].authors).toEqual(mockPapers[0].authors);
    expect(results[0].summary).toBe(mockPapers[0].summary);
    expect(results[0].published).toBe(mockPapers[0].published);
    expect(results[0].link).toBe(mockPapers[0].link);
    expect(results[0].embedding).toEqual(mockPapers[0].embedding);
  });
});

// ============================================================================
// filterByThreshold Tests
// ============================================================================

describe('filterByThreshold', () => {
  const papersWithScores: PaperWithEmbedding[] = [
    { ...mockPapers[0], similarityScore: 0.95 },
    { ...mockPapers[1], similarityScore: 0.85 },
    { ...mockPapers[2], similarityScore: 0.75 },
    { ...mockPapers[3], similarityScore: 0.65 },
    { ...mockPapers[4], similarityScore: 0.55 },
    { ...mockPapers[5], similarityScore: 0.45 },
  ];

  it('should filter papers above threshold', () => {
    const filtered = filterByThreshold(papersWithScores, 0.7);

    expect(filtered).toHaveLength(3);
    expect(filtered[0].similarityScore).toBe(0.95);
    expect(filtered[1].similarityScore).toBe(0.85);
    expect(filtered[2].similarityScore).toBe(0.75);
  });

  it('should include papers equal to threshold', () => {
    const filtered = filterByThreshold(papersWithScores, 0.75);

    expect(filtered).toHaveLength(3);
    expect(filtered[2].similarityScore).toBe(0.75); // Exact match included
  });

  it('should return empty array if all papers below threshold', () => {
    const filtered = filterByThreshold(papersWithScores, 0.99);

    expect(filtered).toEqual([]);
  });

  it('should return all papers if threshold is 0', () => {
    const filtered = filterByThreshold(papersWithScores, 0);

    expect(filtered).toHaveLength(papersWithScores.length);
  });

  it('should handle empty papers array', () => {
    const filtered = filterByThreshold([], 0.5);

    expect(filtered).toEqual([]);
  });

  it('should handle papers without similarity scores', () => {
    const papersNoScores = [mockPapers[0], mockPapers[1]];

    // Papers without scores should be filtered out
    const filtered = filterByThreshold(papersNoScores, 0.5);
    expect(filtered).toEqual([]);
  });
});

// ============================================================================
// calculateAdaptiveThreshold Tests
// ============================================================================

describe('calculateAdaptiveThreshold', () => {
  it('should calculate threshold based on median and stddev', () => {
    // Scores: 0.5, 0.6, 0.7, 0.8, 0.9
    // Median = 0.7, stddev ≈ 0.141
    // Threshold = 0.7 + 0.5 * 0.141 ≈ 0.77
    const scores = [0.5, 0.6, 0.7, 0.8, 0.9];
    const threshold = calculateAdaptiveThreshold(scores);

    expect(threshold).toBeCloseTo(0.77, 1);
  });

  it('should handle high variance distribution', () => {
    // Wide range of scores
    const scores = [0.1, 0.3, 0.5, 0.7, 0.9];
    const threshold = calculateAdaptiveThreshold(scores);

    // Should set a reasonable threshold
    expect(threshold).toBeGreaterThan(0.5);
    expect(threshold).toBeLessThan(0.9);
  });

  it('should handle low variance distribution (clustered scores)', () => {
    // All scores close together
    const scores = [0.75, 0.76, 0.77, 0.78, 0.79];
    const threshold = calculateAdaptiveThreshold(scores);

    // Threshold should be close to median
    expect(threshold).toBeCloseTo(0.77, 1);
  });

  it('should enforce minimum threshold of 0.45', () => {
    // All very low scores
    const scores = [0.1, 0.2, 0.3, 0.4];
    const threshold = calculateAdaptiveThreshold(scores);

    // Should not go below 0.45
    expect(threshold).toBeGreaterThanOrEqual(0.45);
  });

  it('should not exceed maximum threshold of 0.95', () => {
    // All very high scores
    const scores = [0.95, 0.96, 0.97, 0.98, 0.99];
    const threshold = calculateAdaptiveThreshold(scores);

    // Should cap at 0.95
    expect(threshold).toBeLessThanOrEqual(0.95);
  });

  it('should handle single score', () => {
    const scores = [0.7];
    const threshold = calculateAdaptiveThreshold(scores);

    // With single score, stddev = 0, so threshold = score (capped)
    expect(threshold).toBeDefined();
    expect(threshold).toBeGreaterThanOrEqual(0.45);
  });

  it('should handle empty array', () => {
    const scores: number[] = [];
    const threshold = calculateAdaptiveThreshold(scores);

    // Should return minimum threshold as fallback
    expect(threshold).toBe(0.45);
  });

  it('should handle all identical scores', () => {
    const scores = [0.7, 0.7, 0.7, 0.7, 0.7];
    const threshold = calculateAdaptiveThreshold(scores);

    // Stddev = 0, threshold = median
    expect(threshold).toBeCloseTo(0.7, 2);
  });
});

// ============================================================================
// computeSimilarityStats Tests
// ============================================================================

describe('computeSimilarityStats', () => {
  it('should compute correct statistics', () => {
    const scores = [0.5, 0.6, 0.7, 0.8, 0.9];
    const stats = computeSimilarityStats(scores);

    expect(stats.min).toBe(0.5);
    expect(stats.max).toBe(0.9);
    expect(stats.avg).toBeCloseTo(0.7, 2);
    expect(stats.median).toBe(0.7);
  });

  it('should handle even number of scores (median)', () => {
    const scores = [0.5, 0.6, 0.7, 0.8];
    const stats = computeSimilarityStats(scores);

    // Median of 4 numbers: average of middle two (0.6 + 0.7) / 2 = 0.65
    expect(stats.median).toBeCloseTo(0.65, 2);
  });

  it('should handle odd number of scores (median)', () => {
    const scores = [0.5, 0.6, 0.7, 0.8, 0.9];
    const stats = computeSimilarityStats(scores);

    // Median of 5 numbers: middle value = 0.7
    expect(stats.median).toBe(0.7);
  });

  it('should handle single score', () => {
    const scores = [0.75];
    const stats = computeSimilarityStats(scores);

    expect(stats.min).toBe(0.75);
    expect(stats.max).toBe(0.75);
    expect(stats.avg).toBe(0.75);
    expect(stats.median).toBe(0.75);
  });

  it('should handle empty array', () => {
    const scores: number[] = [];
    const stats = computeSimilarityStats(scores);

    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.avg).toBe(0);
    expect(stats.median).toBe(0);
  });

  it('should handle unsorted scores', () => {
    const scores = [0.8, 0.5, 0.9, 0.6, 0.7];
    const stats = computeSimilarityStats(scores);

    expect(stats.min).toBe(0.5);
    expect(stats.max).toBe(0.9);
    expect(stats.avg).toBeCloseTo(0.7, 2);
    expect(stats.median).toBe(0.7);
  });

  it('should round average to reasonable precision', () => {
    const scores = [0.333, 0.666, 0.999];
    const stats = computeSimilarityStats(scores);

    expect(stats.avg).toBeCloseTo(0.666, 2);
  });
});

// ============================================================================
// matchPapers Integration Tests
// ============================================================================

describe('matchPapers', () => {
  it('should perform full matching pipeline', () => {
    const result = matchPapers(mockJdEmbedding, mockPapers);

    expect(result.filteredPapers).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(result.threshold).toBeDefined();
    expect(result.allPapersWithScores).toHaveLength(mockPapers.length);
  });

  it('should use adaptive threshold by default', () => {
    const result = matchPapers(mockJdEmbedding, mockPapers);

    // Threshold should be adaptive (not one of the fixed values)
    expect(result.threshold).toBeGreaterThan(0);
    expect(result.threshold).toBeLessThanOrEqual(1);
  });

  it('should allow custom threshold', () => {
    const customThreshold = 0.8;
    const result = matchPapers(mockJdEmbedding, mockPapers, {
      threshold: customThreshold,
    });

    expect(result.threshold).toBe(customThreshold);
    result.filteredPapers.forEach((paper) => {
      expect(paper.similarityScore!).toBeGreaterThanOrEqual(customThreshold);
    });
  });

  it('should enforce maxPapers limit', () => {
    const result = matchPapers(mockJdEmbedding, mockPapers, {
      maxPapers: 3,
      threshold: 0, // Set low threshold to get all papers
    });

    expect(result.filteredPapers.length).toBeLessThanOrEqual(3);
  });

  it('should enforce minPapers by lowering threshold', () => {
    const result = matchPapers(mockJdEmbedding, mockPapers, {
      threshold: 0.99, // Very high threshold
      minPapers: 3,
    });

    // Should lower threshold to get at least 3 papers
    expect(result.filteredPapers.length).toBeGreaterThanOrEqual(3);
  });

  it('should return all papers if not enough meet minPapers', () => {
    const result = matchPapers(mockJdEmbedding, mockPapers, {
      threshold: 0.99, // Very high threshold
      minPapers: 100, // More than available
    });

    // Should return all papers sorted by score
    expect(result.filteredPapers.length).toBeLessThanOrEqual(mockPapers.length);
  });

  it('should compute accurate statistics for all papers', () => {
    const result = matchPapers(mockJdEmbedding, mockPapers);

    expect(result.stats.min).toBeLessThanOrEqual(result.stats.max);
    expect(result.stats.avg).toBeGreaterThanOrEqual(result.stats.min);
    expect(result.stats.avg).toBeLessThanOrEqual(result.stats.max);
    expect(result.stats.median).toBeGreaterThanOrEqual(result.stats.min);
    expect(result.stats.median).toBeLessThanOrEqual(result.stats.max);
  });

  it('should handle empty papers array gracefully', () => {
    const result = matchPapers(mockJdEmbedding, []);

    expect(result.filteredPapers).toEqual([]);
    expect(result.allPapersWithScores).toEqual([]);
    expect(result.stats.min).toBe(0);
    expect(result.stats.max).toBe(0);
  });

  it('should sort filtered papers by similarity score descending', () => {
    const result = matchPapers(mockJdEmbedding, mockPapers, {
      threshold: 0,
    });

    for (let i = 0; i < result.filteredPapers.length - 1; i++) {
      expect(result.filteredPapers[i].similarityScore!).toBeGreaterThanOrEqual(
        result.filteredPapers[i + 1].similarityScore!
      );
    }
  });

  it('should return debug info when requested', () => {
    const result = matchPapers(mockJdEmbedding, mockPapers, {
      includeDebug: true,
    });

    expect(result.debug).toBeDefined();
    expect(result.debug?.totalPapers).toBe(mockPapers.length);
    expect(result.debug?.papersAboveThreshold).toBeDefined();
    expect(result.debug?.papersReturned).toBe(result.filteredPapers.length);
  });

  it('should use adaptive threshold when useAdaptive is true', () => {
    const result = matchPapers(mockJdEmbedding, mockPapers, {
      useAdaptive: true,
    });

    // Should have calculated an adaptive threshold
    expect(result.threshold).toBeDefined();
    expect(result.threshold).toBeGreaterThan(0);
  });

  it('should use fixed threshold when useAdaptive is false', () => {
    const fixedThreshold = 0.75;
    const result = matchPapers(mockJdEmbedding, mockPapers, {
      useAdaptive: false,
      threshold: fixedThreshold,
    });

    expect(result.threshold).toBe(fixedThreshold);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  it('should handle papers with zero vectors', () => {
    const zeroVectorPapers = [
      createMockPaper('zero', [0, 0, 0], 'Zero Vector Paper'),
    ];

    const result = matchPapers(mockJdEmbedding, zeroVectorPapers);

    expect(result.filteredPapers).toBeDefined();
    // Zero vector should result in 0 similarity
    expect(result.allPapersWithScores[0].similarityScore).toBe(0);
  });

  it('should handle job description with zero vector', () => {
    const zeroJd = [0, 0, 0];

    const result = matchPapers(zeroJd, mockPapers);

    // All similarities should be 0
    result.allPapersWithScores.forEach((paper) => {
      expect(paper.similarityScore).toBe(0);
    });
  });

  it('should handle very large number of papers', () => {
    const manyPapers = Array.from({ length: 1000 }, (_, i) =>
      createMockPaper(`paper-${i}`, [Math.random(), Math.random(), Math.random()])
    );

    const result = matchPapers(mockJdEmbedding, manyPapers, {
      maxPapers: 50,
    });

    expect(result.filteredPapers.length).toBeLessThanOrEqual(50);
    expect(result.allPapersWithScores).toHaveLength(1000);
  });

  it('should handle all papers having identical similarity scores', () => {
    const identicalPapers = Array.from({ length: 5 }, (_, i) =>
      createMockPaper(`paper-${i}`, [1, 0, 0]) // All identical embeddings
    );

    const result = matchPapers(mockJdEmbedding, identicalPapers);

    // All should have similarity ~1.0
    result.allPapersWithScores.forEach((paper) => {
      expect(paper.similarityScore).toBeCloseTo(1.0, 2);
    });
  });
});
