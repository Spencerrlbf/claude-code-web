/**
 * Tests for Location Enrichment Module
 *
 * Tests cover:
 * - Single author enrichment with various scenarios
 * - Batch enrichment with parallel processing
 * - Error handling and partial failures
 * - Rate limiting and concurrency control
 * - Statistics calculation
 *
 * @group unit
 * @group core
 */

import {
  enrichWithLocation,
  enrichSingleAuthor,
  type EnrichedAuthor,
  type LocationEnrichmentResult,
  type LocationEnrichmentOptions,
} from '@/lib/core/location-enrichment';
import { SemanticScholarService } from '@/lib/services/semantic-scholar-service';
import type { AuthorCandidate } from '@/lib/types';
import type { AuthorLocationData } from '@/lib/services/semantic-scholar-service';

// Mock the Semantic Scholar Service
jest.mock('@/lib/services/semantic-scholar-service');

describe('Location Enrichment Module', () => {
  let mockSemanticScholarService: jest.Mocked<SemanticScholarService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create a mock instance
    mockSemanticScholarService =
      new SemanticScholarService() as jest.Mocked<SemanticScholarService>;

    // Get the mocked class
    const MockedSemanticScholarService =
      SemanticScholarService as jest.MockedClass<
        typeof SemanticScholarService
      >;

    // Ensure the mocked constructor returns our mock instance
    MockedSemanticScholarService.mockImplementation(
      () => mockSemanticScholarService
    );
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  const createMockAuthor = (
    name: string,
    similarityScore = 0.85
  ): AuthorCandidate => ({
    name,
    similarityScore,
    paper: {
      id: `arxiv-${name.replace(/\s+/g, '-').toLowerCase()}`,
      title: `Sample Paper by ${name}`,
      authors: [name],
      summary: `Abstract for paper by ${name}`,
      published: '2024-01-01',
      link: 'https://arxiv.org/abs/1234.5678',
    },
  });

  const createMockLocationData = (
    name: string,
    location: 'USA' | 'International' | 'Unknown',
    affiliations: string[] = []
  ): AuthorLocationData => ({
    name,
    location,
    affiliations,
    authorId: location !== 'Unknown' ? `author-${name}` : undefined,
  });

  // ==========================================================================
  // enrichSingleAuthor() Tests
  // ==========================================================================

  describe('enrichSingleAuthor', () => {
    test('should enrich author with USA location when affiliations contain USA keywords', async () => {
      const author = createMockAuthor('John Doe');
      const locationData = createMockLocationData('John Doe', 'USA', [
        'MIT',
        'Cambridge, MA',
      ]);

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(locationData);

      const result = await enrichSingleAuthor(author);

      expect(result.name).toBe('John Doe');
      expect(result.location).toBe('USA');
      expect(result.affiliations).toEqual(['MIT', 'Cambridge, MA']);
      expect(result.similarityScore).toBe(0.85);
      expect(result.paper).toEqual(author.paper);
      expect(mockSemanticScholarService.getAuthorLocation).toHaveBeenCalledWith(
        'John Doe'
      );
    });

    test('should enrich author with International location when affiliations are non-USA', async () => {
      const author = createMockAuthor('Jane Smith');
      const locationData = createMockLocationData(
        'Jane Smith',
        'International',
        ['Oxford University', 'UK']
      );

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(locationData);

      const result = await enrichSingleAuthor(author);

      expect(result.location).toBe('International');
      expect(result.affiliations).toEqual(['Oxford University', 'UK']);
    });

    test('should enrich author with Unknown location when author not found', async () => {
      const author = createMockAuthor('Unknown Person');
      const locationData = createMockLocationData('Unknown Person', 'Unknown');

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(locationData);

      const result = await enrichSingleAuthor(author);

      expect(result.location).toBe('Unknown');
      expect(result.affiliations).toEqual([]);
    });

    test('should enrich author with Unknown location when API fails', async () => {
      const author = createMockAuthor('Error Author');

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockRejectedValue(new Error('API Error'));

      const result = await enrichSingleAuthor(author);

      expect(result.location).toBe('Unknown');
      expect(result.affiliations).toEqual([]);
      expect(result.locationCheckError).toContain('API Error');
    });

    test('should preserve original author data while adding location', async () => {
      const author = createMockAuthor('Bob Johnson', 0.92);
      const locationData = createMockLocationData('Bob Johnson', 'USA', [
        'Stanford',
      ]);

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(locationData);

      const result = await enrichSingleAuthor(author);

      // Verify all original fields are preserved
      expect(result.name).toBe(author.name);
      expect(result.similarityScore).toBe(0.92);
      expect(result.paper).toEqual(author.paper);

      // Verify new fields are added
      expect(result.location).toBe('USA');
      expect(result.affiliations).toEqual(['Stanford']);
    });

    test('should handle timeout gracefully', async () => {
      const author = createMockAuthor('Timeout Author');

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockImplementation(
          () =>
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 100)
            )
        );

      const result = await enrichSingleAuthor(author);

      expect(result.location).toBe('Unknown');
      expect(result.locationCheckError).toBeDefined();
    });
  });

  // ==========================================================================
  // enrichWithLocation() - Success Cases
  // ==========================================================================

  describe('enrichWithLocation - success cases', () => {
    test('should successfully enrich all authors when all lookups succeed', async () => {
      const authors = [
        createMockAuthor('Alice'),
        createMockAuthor('Bob'),
        createMockAuthor('Charlie'),
      ];

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockImplementation(async (name: string) => {
          if (name === 'Alice')
            return createMockLocationData('Alice', 'USA', ['MIT']);
          if (name === 'Bob')
            return createMockLocationData('Bob', 'International', ['Oxford']);
          if (name === 'Charlie')
            return createMockLocationData('Charlie', 'Unknown');
          return createMockLocationData(name, 'Unknown');
        });

      const result = await enrichWithLocation(authors);

      expect(result.enrichedAuthors).toHaveLength(3);
      expect(result.stats.total).toBe(3);
      expect(result.stats.enriched).toBe(3);
      expect(result.stats.failed).toBe(0);
      expect(result.stats.usa).toBe(1);
      expect(result.stats.international).toBe(1);
      expect(result.stats.unknown).toBe(1);
    });

    test('should process authors in parallel up to maxConcurrent limit', async () => {
      const authors = Array.from({ length: 10 }, (_, i) =>
        createMockAuthor(`Author ${i}`)
      );

      let concurrentCalls = 0;
      let maxConcurrent = 0;

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockImplementation(async (name: string) => {
          concurrentCalls++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCalls);

          // Simulate some work
          await new Promise((resolve) => setTimeout(resolve, 50));

          concurrentCalls--;
          return createMockLocationData(name, 'USA', ['MIT']);
        });

      await enrichWithLocation(authors, { maxConcurrent: 3 });

      // Should never exceed maxConcurrent
      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(maxConcurrent).toBeGreaterThan(1); // Should have some parallelism
    });

    test('should return correct statistics in result', async () => {
      const authors = Array.from({ length: 10 }, (_, i) =>
        createMockAuthor(`Author ${i}`)
      );

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockImplementation(async (name: string) => {
          const num = parseInt(name.split(' ')[1]);
          if (num < 4) return createMockLocationData(name, 'USA', ['MIT']);
          if (num < 7)
            return createMockLocationData(name, 'International', ['Oxford']);
          return createMockLocationData(name, 'Unknown');
        });

      const result = await enrichWithLocation(authors);

      expect(result.stats).toEqual({
        total: 10,
        enriched: 10,
        failed: 0,
        usa: 4,
        international: 3,
        unknown: 3,
      });
    });

    test('should handle empty author array', async () => {
      const result = await enrichWithLocation([]);

      expect(result.enrichedAuthors).toEqual([]);
      expect(result.stats).toEqual({
        total: 0,
        enriched: 0,
        failed: 0,
        usa: 0,
        international: 0,
        unknown: 0,
      });
    });

    test('should handle single author', async () => {
      const authors = [createMockAuthor('Solo Author')];

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(createMockLocationData('Solo Author', 'USA', ['MIT']));

      const result = await enrichWithLocation(authors);

      expect(result.enrichedAuthors).toHaveLength(1);
      expect(result.enrichedAuthors[0].location).toBe('USA');
      expect(result.stats.total).toBe(1);
    });

    test('should use default options when not specified', async () => {
      const authors = [createMockAuthor('Test Author')];

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(
          createMockLocationData('Test Author', 'USA', ['MIT'])
        );

      const result = await enrichWithLocation(authors);

      expect(result.enrichedAuthors).toHaveLength(1);
      expect(mockSemanticScholarService.getAuthorLocation).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // enrichWithLocation() - Failure Handling
  // ==========================================================================

  describe('enrichWithLocation - failure handling', () => {
    test('should continue enriching when some author lookups fail', async () => {
      const authors = Array.from({ length: 5 }, (_, i) =>
        createMockAuthor(`Author ${i}`)
      );

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockImplementation(async (name: string) => {
          const num = parseInt(name.split(' ')[1]);
          if (num === 1 || num === 3) {
            throw new Error('Lookup failed');
          }
          return createMockLocationData(name, 'USA', ['MIT']);
        });

      const result = await enrichWithLocation(authors, {
        continueOnError: true,
      });

      expect(result.stats.total).toBe(5);
      expect(result.stats.enriched).toBe(3);
      expect(result.stats.failed).toBe(2);
      expect(result.stats.usa).toBe(3);

      // Failed authors should be marked as Unknown
      const failedAuthors = result.enrichedAuthors.filter(
        (a) => a.locationCheckError
      );
      expect(failedAuthors).toHaveLength(2);
      failedAuthors.forEach((author) => {
        expect(author.location).toBe('Unknown');
      });
    });

    test('should handle all author lookups failing gracefully', async () => {
      const authors = Array.from({ length: 3 }, (_, i) =>
        createMockAuthor(`Author ${i}`)
      );

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockRejectedValue(new Error('Service unavailable'));

      const result = await enrichWithLocation(authors);

      expect(result.stats.total).toBe(3);
      expect(result.stats.enriched).toBe(0);
      expect(result.stats.failed).toBe(3);
      expect(result.stats.unknown).toBe(3);

      // All should be marked as Unknown with error
      result.enrichedAuthors.forEach((author) => {
        expect(author.location).toBe('Unknown');
        expect(author.locationCheckError).toBeDefined();
      });
    });

    test('should respect timeout for slow API calls', async () => {
      const authors = [createMockAuthor('Slow Author')];

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve(createMockLocationData('Slow Author', 'USA', ['MIT'])),
                10000
              )
            )
        );

      const result = await enrichWithLocation(authors, { timeoutMs: 100 });

      expect(result.stats.failed).toBe(1);
      expect(result.enrichedAuthors[0].location).toBe('Unknown');
      expect(result.enrichedAuthors[0].locationCheckError).toContain(
        'Timeout'
      );
    });

    test('should throw error when continueOnError is false and lookup fails', async () => {
      const authors = [
        createMockAuthor('Good Author'),
        createMockAuthor('Bad Author'),
      ];

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockImplementation(async (name: string) => {
          if (name === 'Bad Author') {
            throw new Error('Lookup failed');
          }
          return createMockLocationData(name, 'USA', ['MIT']);
        });

      await expect(
        enrichWithLocation(authors, { continueOnError: false })
      ).rejects.toThrow('Lookup failed');
    });
  });

  // ==========================================================================
  // enrichWithLocation() - Rate Limiting
  // ==========================================================================

  describe('enrichWithLocation - rate limiting', () => {
    test('should respect maxConcurrent setting', async () => {
      const authors = Array.from({ length: 20 }, (_, i) =>
        createMockAuthor(`Author ${i}`)
      );

      let currentConcurrent = 0;
      let peakConcurrent = 0;

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockImplementation(async (name: string) => {
          currentConcurrent++;
          peakConcurrent = Math.max(peakConcurrent, currentConcurrent);

          await new Promise((resolve) => setTimeout(resolve, 10));

          currentConcurrent--;
          return createMockLocationData(name, 'USA', ['MIT']);
        });

      await enrichWithLocation(authors, { maxConcurrent: 5 });

      expect(peakConcurrent).toBeLessThanOrEqual(5);
    });

    test('should handle default maxConcurrent when not specified', async () => {
      const authors = Array.from({ length: 10 }, (_, i) =>
        createMockAuthor(`Author ${i}`)
      );

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(createMockLocationData('test', 'USA', ['MIT']));

      await enrichWithLocation(authors);

      // Should complete without errors
      expect(mockSemanticScholarService.getAuthorLocation).toHaveBeenCalledTimes(
        10
      );
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('integration scenarios', () => {
    test('should handle mixed results: USA, International, Unknown', async () => {
      const authors = [
        createMockAuthor('USA Author'),
        createMockAuthor('International Author'),
        createMockAuthor('Unknown Author'),
      ];

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockImplementation(async (name: string) => {
          if (name === 'USA Author')
            return createMockLocationData('USA Author', 'USA', ['MIT']);
          if (name === 'International Author')
            return createMockLocationData('International Author', 'International', [
              'Oxford',
            ]);
          return createMockLocationData('Unknown Author', 'Unknown');
        });

      const result = await enrichWithLocation(authors);

      expect(result.stats.usa).toBe(1);
      expect(result.stats.international).toBe(1);
      expect(result.stats.unknown).toBe(1);

      const usaAuthor = result.enrichedAuthors.find(
        (a) => a.name === 'USA Author'
      );
      const intlAuthor = result.enrichedAuthors.find(
        (a) => a.name === 'International Author'
      );
      const unknownAuthor = result.enrichedAuthors.find(
        (a) => a.name === 'Unknown Author'
      );

      expect(usaAuthor?.location).toBe('USA');
      expect(intlAuthor?.location).toBe('International');
      expect(unknownAuthor?.location).toBe('Unknown');
    });

    test('should preserve author order in results', async () => {
      const authors = [
        createMockAuthor('Author A'),
        createMockAuthor('Author B'),
        createMockAuthor('Author C'),
      ];

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(createMockLocationData('test', 'USA', ['MIT']));

      const result = await enrichWithLocation(authors);

      expect(result.enrichedAuthors[0].name).toBe('Author A');
      expect(result.enrichedAuthors[1].name).toBe('Author B');
      expect(result.enrichedAuthors[2].name).toBe('Author C');
    });

    test('should handle authors with same similarity scores', async () => {
      const authors = [
        createMockAuthor('Author 1', 0.85),
        createMockAuthor('Author 2', 0.85),
        createMockAuthor('Author 3', 0.85),
      ];

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(createMockLocationData('test', 'USA', ['MIT']));

      const result = await enrichWithLocation(authors);

      expect(result.enrichedAuthors).toHaveLength(3);
      result.enrichedAuthors.forEach((author) => {
        expect(author.similarityScore).toBe(0.85);
      });
    });

    test('should handle large batch of authors efficiently', async () => {
      const authors = Array.from({ length: 50 }, (_, i) =>
        createMockAuthor(`Author ${i}`)
      );

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(createMockLocationData('test', 'USA', ['MIT']));

      const startTime = Date.now();
      const result = await enrichWithLocation(authors, { maxConcurrent: 10 });
      const duration = Date.now() - startTime;

      expect(result.enrichedAuthors).toHaveLength(50);
      expect(result.stats.total).toBe(50);

      // With parallelism, should be faster than sequential
      // (This is a rough check - timing tests can be flaky)
      expect(duration).toBeLessThan(5000);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    test('should handle author with empty name', async () => {
      const author = createMockAuthor('');

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(createMockLocationData('', 'Unknown'));

      const result = await enrichSingleAuthor(author);

      expect(result.location).toBe('Unknown');
    });

    test('should handle author with special characters in name', async () => {
      const author = createMockAuthor("O'Brien-Smith");

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(
          createMockLocationData("O'Brien-Smith", 'USA', ['MIT'])
        );

      const result = await enrichSingleAuthor(author);

      expect(result.name).toBe("O'Brien-Smith");
      expect(result.location).toBe('USA');
    });

    test('should handle very long affiliation lists', async () => {
      const author = createMockAuthor('Prolific Author');
      const longAffiliations = Array.from(
        { length: 50 },
        (_, i) => `Institution ${i}`
      );

      mockSemanticScholarService.getAuthorLocation = jest
        .fn()
        .mockResolvedValue(
          createMockLocationData('Prolific Author', 'USA', longAffiliations)
        );

      const result = await enrichSingleAuthor(author);

      expect(result.affiliations).toHaveLength(50);
      expect(result.location).toBe('USA');
    });
  });
});
