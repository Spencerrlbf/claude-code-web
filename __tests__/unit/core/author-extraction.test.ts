/**
 * Unit tests for author extraction module
 *
 * Tests the extraction and deduplication of authors from research papers,
 * including name normalization and keeping the highest-scoring paper per author.
 */

import { extractAuthors } from '@/lib/core/author-extraction';
import type { PaperWithEmbedding } from '@/lib/types';

describe('author-extraction', () => {
  describe('extractAuthors', () => {
    // Helper to create mock papers for testing
    const createMockPaper = (
      id: string,
      authors: string[],
      similarityScore: number,
      title = `Paper ${id}`
    ): PaperWithEmbedding => ({
      id,
      title,
      authors,
      summary: 'Test abstract',
      published: '2024-01-01',
      link: `https://arxiv.org/abs/${id}`,
      embedding: new Array(1536).fill(0),
      similarityScore,
    });

    /**
     * Test 1: Basic Functionality - Single Paper
     */
    it('should extract authors from a single paper', () => {
      const papers = [
        createMockPaper('1', ['Alice Smith', 'Bob Jones'], 0.85),
      ];

      const result = extractAuthors(papers);

      expect(result).toHaveLength(2);
      expect(result.map(a => a.name)).toContain('Alice Smith');
      expect(result.map(a => a.name)).toContain('Bob Jones');
      expect(result[0].similarityScore).toBe(0.85);
    });

    /**
     * Test 2: Multi-Paper Handling
     */
    it('should extract authors from multiple papers', () => {
      const papers = [
        createMockPaper('1', ['Alice Smith'], 0.85),
        createMockPaper('2', ['Bob Jones'], 0.75),
      ];

      const result = extractAuthors(papers);

      expect(result).toHaveLength(2);
      expect(result.map(a => a.name)).toContain('Alice Smith');
      expect(result.map(a => a.name)).toContain('Bob Jones');
    });

    /**
     * Test 3: Deduplication - Core Logic
     * Most important test: ensures we keep the highest score per author
     */
    it('should deduplicate authors and keep the highest score', () => {
      const papers = [
        createMockPaper('1', ['Alice Smith'], 0.75, 'Lower Score Paper'),
        createMockPaper('2', ['Alice Smith'], 0.92, 'Higher Score Paper'),
      ];

      const result = extractAuthors(papers);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice Smith');
      expect(result[0].paper.id).toBe('2'); // Higher score paper
      expect(result[0].paper.title).toBe('Higher Score Paper');
      expect(result[0].similarityScore).toBe(0.92);
    });

    /**
     * Test 4: Name Normalization - Case Insensitive
     */
    it('should normalize author names (case insensitive)', () => {
      const papers = [
        createMockPaper('1', ['Alice Smith'], 0.75),
        createMockPaper('2', ['alice smith'], 0.85),
        createMockPaper('3', ['ALICE SMITH'], 0.70),
      ];

      const result = extractAuthors(papers);

      expect(result).toHaveLength(1);
      expect(result[0].similarityScore).toBe(0.85); // Kept the highest
      expect(result[0].paper.id).toBe('2');
    });

    /**
     * Test 5: Name Normalization - Whitespace
     */
    it('should normalize whitespace in author names', () => {
      const papers = [
        createMockPaper('1', ['Alice Smith'], 0.75),
        createMockPaper('2', ['  Alice   Smith  '], 0.85),
        createMockPaper('3', ['Alice  Smith'], 0.70),
      ];

      const result = extractAuthors(papers);

      expect(result).toHaveLength(1);
      expect(result[0].similarityScore).toBe(0.85); // Kept the highest
    });

    /**
     * Test 6: Edge Case - Empty Papers Array
     */
    it('should return empty array for empty input', () => {
      const result = extractAuthors([]);

      expect(result).toEqual([]);
    });

    /**
     * Test 7: Edge Case - Papers with No Authors
     */
    it('should handle papers with empty authors array', () => {
      const papers = [
        createMockPaper('1', [], 0.85),
      ];

      const result = extractAuthors(papers);

      expect(result).toEqual([]);
    });

    /**
     * Test 8: Multiple Authors per Paper
     */
    it('should extract all authors from multi-author papers', () => {
      const papers = [
        createMockPaper('1', ['Alice Smith', 'Bob Jones', 'Carol White'], 0.85),
      ];

      const result = extractAuthors(papers);

      expect(result).toHaveLength(3);
      expect(result.map(a => a.name)).toContain('Alice Smith');
      expect(result.map(a => a.name)).toContain('Bob Jones');
      expect(result.map(a => a.name)).toContain('Carol White');
      // All should have the same similarity score (from the same paper)
      expect(result.every(a => a.similarityScore === 0.85)).toBe(true);
    });

    /**
     * Test 9: Complex Deduplication Scenario
     * Tests multiple overlapping authors across multiple papers
     */
    it('should handle complex deduplication across multiple papers', () => {
      const papers = [
        createMockPaper('1', ['Alice Smith', 'Bob Jones'], 0.80),
        createMockPaper('2', ['Bob Jones', 'Carol White'], 0.90),
        createMockPaper('3', ['Alice Smith', 'Carol White'], 0.70),
      ];

      const result = extractAuthors(papers);

      expect(result).toHaveLength(3);

      // Alice should have paper 1 (0.80, higher than paper 3's 0.70)
      const alice = result.find(a => a.name === 'Alice Smith');
      expect(alice).toBeDefined();
      expect(alice?.paper.id).toBe('1');
      expect(alice?.similarityScore).toBe(0.80);

      // Bob should have paper 2 (0.90, higher than paper 1's 0.80)
      const bob = result.find(a => a.name === 'Bob Jones');
      expect(bob).toBeDefined();
      expect(bob?.paper.id).toBe('2');
      expect(bob?.similarityScore).toBe(0.90);

      // Carol should have paper 2 (0.90, higher than paper 3's 0.70)
      const carol = result.find(a => a.name === 'Carol White');
      expect(carol).toBeDefined();
      expect(carol?.paper.id).toBe('2');
      expect(carol?.similarityScore).toBe(0.90);
    });

    /**
     * Test 10: Edge Case - Papers without similarity scores
     */
    it('should handle papers without similarity scores', () => {
      const papersWithoutScores: PaperWithEmbedding[] = [
        {
          id: '1',
          title: 'Paper 1',
          authors: ['Alice Smith'],
          summary: 'Test',
          published: '2024-01-01',
          link: 'https://arxiv.org/abs/1',
          embedding: new Array(1536).fill(0),
          // No similarityScore field
        },
      ];

      const result = extractAuthors(papersWithoutScores);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice Smith');
      expect(result[0].similarityScore).toBe(0); // Should default to 0
    });

    /**
     * Test 11: Preserves Original Name Casing
     * Even though we normalize for comparison, we should keep original casing
     */
    it('should preserve original name casing in results', () => {
      const papers = [
        createMockPaper('1', ['alice smith'], 0.75),
        createMockPaper('2', ['Alice Smith'], 0.85), // Higher score
        createMockPaper('3', ['ALICE SMITH'], 0.70),
      ];

      const result = extractAuthors(papers);

      expect(result).toHaveLength(1);
      // Should keep the casing from the highest-scoring paper
      expect(result[0].name).toBe('Alice Smith');
    });

    /**
     * Test 12: Large Dataset Performance
     * Ensures the algorithm scales reasonably
     */
    it('should handle large datasets efficiently', () => {
      const papers: PaperWithEmbedding[] = [];

      // Create 100 papers with 5 authors each, some overlapping
      for (let i = 0; i < 100; i++) {
        const authors = [
          `Author ${i % 20}`, // Creates overlap (20 unique authors)
          `Author ${(i + 1) % 20}`,
          `Author ${(i + 2) % 20}`,
          `Author ${(i + 3) % 20}`,
          `Author ${(i + 4) % 20}`,
        ];
        papers.push(createMockPaper(`${i}`, authors, Math.random()));
      }

      const startTime = Date.now();
      const result = extractAuthors(papers);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 100ms for 100 papers)
      expect(duration).toBeLessThan(100);
      // Should have exactly 20 unique authors
      expect(result).toHaveLength(20);
    });

    /**
     * Test 13: Empty String Author Names
     */
    it('should handle empty string author names', () => {
      const papers = [
        createMockPaper('1', ['Alice Smith', '', 'Bob Jones'], 0.85),
      ];

      const result = extractAuthors(papers);

      // Should skip empty string authors
      expect(result).toHaveLength(2);
      expect(result.map(a => a.name)).toContain('Alice Smith');
      expect(result.map(a => a.name)).toContain('Bob Jones');
      expect(result.map(a => a.name)).not.toContain('');
    });

    /**
     * Test 14: Equal Similarity Scores
     * When two papers have the same score, first one wins
     */
    it('should keep first paper when similarity scores are equal', () => {
      const papers = [
        createMockPaper('1', ['Alice Smith'], 0.85, 'First Paper'),
        createMockPaper('2', ['alice smith'], 0.85, 'Second Paper'),
      ];

      const result = extractAuthors(papers);

      expect(result).toHaveLength(1);
      expect(result[0].paper.id).toBe('1'); // First one wins
      expect(result[0].paper.title).toBe('First Paper');
    });
  });
});
