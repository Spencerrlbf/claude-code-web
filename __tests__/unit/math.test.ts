/**
 * Unit tests for math utility functions
 * Following TDD approach - tests written before implementation
 */

import { cosineSimilarity } from '@/lib/utils/math';

describe('cosineSimilarity', () => {
  describe('Normal Cases', () => {
    it('should calculate similarity for valid vectors', () => {
      const result = cosineSimilarity([1, 2, 3], [4, 5, 6]);
      // Expected calculation:
      // dot product = 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
      // ||A|| = sqrt(1 + 4 + 9) = sqrt(14) ≈ 3.742
      // ||B|| = sqrt(16 + 25 + 36) = sqrt(77) ≈ 8.775
      // similarity = 32 / (3.742 * 8.775) ≈ 0.9746
      expect(result).toBeCloseTo(0.9746, 4);
    });

    it('should return 1.0 for identical vectors', () => {
      const result = cosineSimilarity([1, 2, 3], [1, 2, 3]);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for proportional vectors (same direction)', () => {
      const result = cosineSimilarity([1, 2, 3], [2, 4, 6]);
      expect(result).toBeCloseTo(1.0, 10);
    });

    it('should return 0.0 for orthogonal vectors', () => {
      const result = cosineSimilarity([1, 0, 0], [0, 1, 0]);
      expect(result).toBe(0.0);
    });

    it('should handle another orthogonal case', () => {
      const result = cosineSimilarity([1, 1, 0], [0, 0, 1]);
      expect(result).toBe(0.0);
    });
  });

  describe('Edge Cases - Zero Vectors', () => {
    it('should return 0 for zero vector compared to non-zero vector', () => {
      const result = cosineSimilarity([0, 0, 0], [1, 2, 3]);
      expect(result).toBe(0);
    });

    it('should return 0 for non-zero vector compared to zero vector', () => {
      const result = cosineSimilarity([1, 2, 3], [0, 0, 0]);
      expect(result).toBe(0);
    });

    it('should return 0 for both vectors being zero', () => {
      const result = cosineSimilarity([0, 0, 0], [0, 0, 0]);
      expect(result).toBe(0);
    });

    it('should return 0 for partial zero vector', () => {
      const result = cosineSimilarity([1, 0, 0], [0, 0, 0]);
      expect(result).toBe(0);
    });
  });

  describe('Edge Cases - Empty Vectors', () => {
    it('should handle empty vectors', () => {
      const result = cosineSimilarity([], []);
      expect(result).toBe(0);
    });
  });

  describe('Edge Cases - Mismatched Lengths', () => {
    it('should throw error for vectors of different lengths', () => {
      expect(() => {
        cosineSimilarity([1, 2], [1, 2, 3]);
      }).toThrow('Vectors must have the same length');
    });

    it('should throw error for empty vector vs non-empty vector', () => {
      expect(() => {
        cosineSimilarity([], [1, 2, 3]);
      }).toThrow('Vectors must have the same length');
    });

    it('should throw error for different length vectors (reverse)', () => {
      expect(() => {
        cosineSimilarity([1, 2, 3, 4], [1, 2]);
      }).toThrow('Vectors must have the same length');
    });
  });

  describe('Special Cases - Negative Values', () => {
    it('should return -1.0 for opposite direction vectors', () => {
      const result = cosineSimilarity([1, 2, 3], [-1, -2, -3]);
      expect(result).toBeCloseTo(-1.0, 10);
    });

    it('should handle mixed positive and negative values', () => {
      const result = cosineSimilarity([1, -2, 3], [-1, 2, -3]);
      // dot product = -1 + -4 + -9 = -14
      // ||A|| = sqrt(1 + 4 + 9) = sqrt(14)
      // ||B|| = sqrt(1 + 4 + 9) = sqrt(14)
      // similarity = -14 / 14 = -1.0
      expect(result).toBeCloseTo(-1.0, 10);
    });

    it('should handle all negative values', () => {
      const result = cosineSimilarity([-1, -2, -3], [-4, -5, -6]);
      // Same as positive version, should be positive similarity
      expect(result).toBeCloseTo(0.9746, 4);
    });
  });

  describe('Special Cases - Single Element', () => {
    it('should handle single element vectors (same direction)', () => {
      const result = cosineSimilarity([5], [10]);
      expect(result).toBe(1.0);
    });

    it('should handle single element vectors (opposite direction)', () => {
      const result = cosineSimilarity([5], [-10]);
      expect(result).toBe(-1.0);
    });

    it('should handle single zero element', () => {
      const result = cosineSimilarity([0], [5]);
      expect(result).toBe(0);
    });
  });

  describe('Special Cases - Large Vectors', () => {
    it('should handle large vectors efficiently', () => {
      const size = 1000;
      const vecA = Array(size).fill(1);
      const vecB = Array(size).fill(1);

      const result = cosineSimilarity(vecA, vecB);
      expect(result).toBe(1.0);
    });

    it('should handle large orthogonal vectors', () => {
      const size = 500;
      const vecA = [...Array(size).fill(1), ...Array(size).fill(0)];
      const vecB = [...Array(size).fill(0), ...Array(size).fill(1)];

      const result = cosineSimilarity(vecA, vecB);
      expect(result).toBe(0.0);
    });
  });

  describe('Special Cases - Floating Point Precision', () => {
    it('should handle very small numbers', () => {
      const result = cosineSimilarity([0.0001, 0.0002, 0.0003], [0.0004, 0.0005, 0.0006]);
      expect(result).toBeCloseTo(0.9746, 4);
    });

    it('should handle very large numbers', () => {
      const result = cosineSimilarity([1000000, 2000000, 3000000], [4000000, 5000000, 6000000]);
      expect(result).toBeCloseTo(0.9746, 4);
    });

    it('should handle mixed magnitude vectors', () => {
      const result = cosineSimilarity([0.0001, 0.0002], [1000000, 2000000]);
      expect(result).toBeCloseTo(1.0, 4);
    });
  });

  describe('Real-World Use Cases', () => {
    it('should match typical embedding vectors (dimension 1536)', () => {
      // Simulate OpenAI text-embedding-3-small dimensions
      const vecA = Array(1536).fill(0).map(() => Math.random() - 0.5);
      const vecB = vecA.map(v => v * 0.9 + (Math.random() - 0.5) * 0.1);

      const result = cosineSimilarity(vecA, vecB);
      expect(result).toBeGreaterThan(0.8);
      expect(result).toBeLessThanOrEqual(1.0);
    });

    it('should calculate correct similarity for known embedding case', () => {
      // Example: Two similar but not identical embeddings
      const vecA = [0.5, 0.3, -0.2, 0.8];
      const vecB = [0.6, 0.4, -0.1, 0.7];

      const result = cosineSimilarity(vecA, vecB);
      expect(result).toBeGreaterThan(0.9);
      expect(result).toBeLessThan(1.0);
    });
  });
});
