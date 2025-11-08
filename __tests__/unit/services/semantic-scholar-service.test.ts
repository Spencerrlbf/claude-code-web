/**
 * Tests for Semantic Scholar Service
 *
 * Tests cover:
 * - Author search with various API responses
 * - Location determination from affiliations
 * - Caching behavior
 * - Error handling and retry logic
 * - Integration scenarios
 *
 * @group unit
 * @group services
 */

import { SemanticScholarService } from '@/lib/services/semantic-scholar-service';
import type {
  AuthorLocation,
  SemanticScholarAuthor,
  AuthorLocationData,
} from '@/lib/services/semantic-scholar-service';

// Mock fetch globally
global.fetch = jest.fn();

describe('SemanticScholarService', () => {
  let service: SemanticScholarService;

  beforeEach(() => {
    // Create fresh service instance for each test
    service = new SemanticScholarService();
    // Clear all mocks
    jest.clearAllMocks();
  });

  // ==========================================================================
  // searchAuthor() Tests
  // ==========================================================================

  describe('searchAuthor', () => {
    test('should return author data when found', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            affiliations: ['MIT', 'Google Research'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.searchAuthor('John Doe');

      expect(result).not.toBeNull();
      expect(result?.authorId).toBe('12345');
      expect(result?.name).toBe('John Doe');
      expect(result?.affiliations).toEqual(['MIT', 'Google Research']);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should return null when author not found (404)', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await service.searchAuthor('Unknown Person');

      expect(result).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should return null when no results in response', async () => {
      const mockResponse = {
        total: 0,
        offset: 0,
        data: [],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.searchAuthor('Nobody');

      expect(result).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should handle API errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.searchAuthor('John Doe');

      expect(result).toBeNull();
      // Should have retried (1 initial + 2 retries = 3 total)
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    test('should handle timeout errors', async () => {
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
      );

      const result = await service.searchAuthor('John Doe');

      expect(result).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test('should retry on transient failures', async () => {
      // Fail twice, then succeed
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary failure 1'))
        .mockRejectedValueOnce(new Error('Temporary failure 2'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            total: 1,
            offset: 0,
            data: [
              {
                authorId: '12345',
                name: 'John Doe',
                affiliations: ['Stanford'],
              },
            ],
          }),
        });

      const result = await service.searchAuthor('John Doe');

      expect(result).not.toBeNull();
      expect(result?.authorId).toBe('12345');
      expect(fetch).toHaveBeenCalledTimes(3); // Failed twice, succeeded on 3rd
    });

    test('should parse affiliations correctly', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'Jane Smith',
            affiliations: ['MIT', 'Google Research', 'Stanford University'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.searchAuthor('Jane Smith');

      expect(result?.affiliations).toEqual([
        'MIT',
        'Google Research',
        'Stanford University',
      ]);
    });

    test('should handle missing affiliations field', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            // No affiliations field
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.searchAuthor('John Doe');

      expect(result).not.toBeNull();
      expect(result?.affiliations).toEqual([]);
    });
  });

  // ==========================================================================
  // determineLocation() Tests
  // ==========================================================================

  describe('determineLocation', () => {
    test('should detect USA location with explicit USA keyword', () => {
      const affiliations = ['University of California, Berkeley'];
      const location = service.determineLocation(affiliations);
      expect(location).toBe('USA');
    });

    test('should detect USA location with state abbreviation', () => {
      const affiliations = ['Some Institute, Cambridge, MA'];
      const location = service.determineLocation(affiliations);
      expect(location).toBe('USA');
    });

    test('should detect USA location with company name', () => {
      const affiliations = ['Google Research'];
      const location = service.determineLocation(affiliations);
      expect(location).toBe('USA');
    });

    test('should detect USA location with university name', () => {
      const affiliations = ['Stanford University'];
      const location = service.determineLocation(affiliations);
      expect(location).toBe('USA');
    });

    test('should detect International location', () => {
      const affiliations = ['ETH Zurich', 'Switzerland'];
      const location = service.determineLocation(affiliations);
      expect(location).toBe('International');
    });

    test('should return Unknown for empty affiliations', () => {
      const affiliations: string[] = [];
      const location = service.determineLocation(affiliations);
      expect(location).toBe('Unknown');
    });

    test('should be case-insensitive', () => {
      const affiliations = ['STANFORD UNIVERSITY'];
      const location = service.determineLocation(affiliations);
      expect(location).toBe('USA');
    });

    test('should handle partial matches', () => {
      const affiliations = ['Researcher at MIT Media Lab'];
      const location = service.determineLocation(affiliations);
      expect(location).toBe('USA');
    });

    test('should prioritize USA match over International', () => {
      const affiliations = ['MIT', 'Cambridge University'];
      const location = service.determineLocation(affiliations);
      expect(location).toBe('USA');
    });

    test('should handle affiliations with special characters', () => {
      const affiliations = ['Carnegie Mellon University, Pittsburgh, PA'];
      const location = service.determineLocation(affiliations);
      expect(location).toBe('USA');
    });
  });

  // ==========================================================================
  // Caching Tests
  // ==========================================================================

  describe('caching', () => {
    test('should cache author lookups', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            affiliations: ['MIT'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // First call: should fetch from API
      await service.getAuthorLocation('John Doe');
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call: should use cache (no new fetch)
      await service.getAuthorLocation('John Doe');
      expect(fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    test('should return same data from cache', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            affiliations: ['MIT'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result1 = await service.getAuthorLocation('John Doe');
      const result2 = await service.getAuthorLocation('John Doe');

      expect(result1).toEqual(result2);
      expect(result1.location).toBe('USA');
    });

    test('should handle different authors separately', async () => {
      const mockResponse1 = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            affiliations: ['MIT'],
          },
        ],
      };

      const mockResponse2 = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '67890',
            name: 'Jane Smith',
            affiliations: ['Oxford University'],
          },
        ],
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse2,
        });

      await service.getAuthorLocation('John Doe');
      await service.getAuthorLocation('Jane Smith');

      expect(fetch).toHaveBeenCalledTimes(2); // Different authors
    });

    test('should be case-sensitive for cache keys', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            affiliations: ['MIT'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await service.getAuthorLocation('John Doe');
      await service.getAuthorLocation('john doe');

      expect(fetch).toHaveBeenCalledTimes(2); // Different cases
    });

    test('should clear cache when clearCache() is called', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            affiliations: ['MIT'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await service.getAuthorLocation('John Doe'); // Cached
      service.clearCache();
      await service.getAuthorLocation('John Doe'); // Should fetch again

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('should track cache statistics', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            affiliations: ['MIT'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await service.getAuthorLocation('John Doe'); // miss
      await service.getAuthorLocation('John Doe'); // hit
      await service.getAuthorLocation('John Doe'); // hit

      const stats = service.getCacheStats();

      expect(stats.size).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(2);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('integration', () => {
    test('should handle full lookup flow: USA author', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'Geoffrey Hinton',
            affiliations: ['MIT', 'Google Research'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getAuthorLocation('Geoffrey Hinton');

      expect(result.name).toBe('Geoffrey Hinton');
      expect(result.location).toBe('USA');
      expect(result.affiliations).toEqual(['MIT', 'Google Research']);
      expect(result.authorId).toBe('12345');
    });

    test('should handle full lookup flow: International author', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '67890',
            name: 'Some Researcher',
            affiliations: ['ETH Zurich', 'Max Planck Institute'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getAuthorLocation('Some Researcher');

      expect(result.name).toBe('Some Researcher');
      expect(result.location).toBe('International');
      expect(result.affiliations).toEqual(['ETH Zurich', 'Max Planck Institute']);
    });

    test('should handle full lookup flow: Not found', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await service.getAuthorLocation('Unknown Person');

      expect(result.name).toBe('Unknown Person');
      expect(result.location).toBe('Unknown');
      expect(result.affiliations).toEqual([]);
      expect(result.authorId).toBeUndefined();
    });

    test('should handle rate limiting with delays', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            affiliations: ['MIT'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const startTime = Date.now();

      // Make multiple rapid requests
      await service.getAuthorLocation('John Doe');
      await service.getAuthorLocation('Jane Smith');
      await service.getAuthorLocation('Bob Johnson');

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should have some delay between requests (at least 2 delays of 100ms each)
      // First request is immediate, 2nd and 3rd should be delayed
      expect(elapsed).toBeGreaterThanOrEqual(150); // Allow some margin
    });

    test('should handle author with no affiliations', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            affiliations: [],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getAuthorLocation('John Doe');

      expect(result.location).toBe('Unknown');
      expect(result.affiliations).toEqual([]);
    });
  });

  // ==========================================================================
  // Utility Methods Tests
  // ==========================================================================

  describe('utility methods', () => {
    test('getCacheStats should return correct initial state', () => {
      const stats = service.getCacheStats();

      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    test('clearCache should reset cache size', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            affiliations: ['MIT'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await service.getAuthorLocation('John Doe');
      await service.getAuthorLocation('Jane Smith');

      expect(service.getCacheStats().size).toBe(2);

      service.clearCache();

      expect(service.getCacheStats().size).toBe(0);
    });

    test('clearCache should reset statistics', async () => {
      const mockResponse = {
        total: 1,
        offset: 0,
        data: [
          {
            authorId: '12345',
            name: 'John Doe',
            affiliations: ['MIT'],
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await service.getAuthorLocation('John Doe');
      await service.getAuthorLocation('John Doe');

      service.clearCache();

      const stats = service.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
