/**
 * Semantic Scholar Service
 *
 * Provides methods to interact with the Semantic Scholar API for author lookup
 * and location determination. Includes caching, rate limiting, and error handling.
 *
 * @module lib/services/semantic-scholar-service
 */

import { config } from '@/lib/utils/config';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Semantic Scholar author data (simplified)
 */
export interface SemanticScholarAuthor {
  /** Semantic Scholar author ID */
  authorId: string;
  /** Author's name */
  name: string;
  /** Author's institutional affiliations */
  affiliations?: string[];
  /** Citation count (for future use) */
  citationCount?: number;
}

/**
 * Semantic Scholar API response structure
 */
interface SemanticScholarSearchResponse {
  /** Total number of results */
  total: number;
  /** Offset for pagination */
  offset: number;
  /** Next offset (if more results available) */
  next?: number;
  /** Array of author results */
  data: SemanticScholarAuthor[];
}

/**
 * Author location classification
 */
export type AuthorLocation = 'USA' | 'International' | 'Unknown';

/**
 * Result of author search with location
 */
export interface AuthorLocationData {
  /** Author's name */
  name: string;
  /** Determined location */
  location: AuthorLocation;
  /** Author's affiliations */
  affiliations: string[];
  /** Semantic Scholar author ID (if found) */
  authorId?: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Number of cached entries */
  size: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
}

// ============================================================================
// Semantic Scholar Service Class
// ============================================================================

/**
 * Service for interacting with Semantic Scholar API
 *
 * Provides author search, location determination, and caching.
 * Handles rate limiting and retries automatically.
 *
 * @example
 * ```typescript
 * const service = new SemanticScholarService();
 * const location = await service.getAuthorLocation('Geoffrey Hinton');
 * console.log(location.location); // 'USA'
 * ```
 */
export class SemanticScholarService {
  /** In-memory cache for author lookups */
  private cache: Map<string, AuthorLocationData>;

  /** Cache hit counter */
  private cacheHits: number;

  /** Cache miss counter */
  private cacheMisses: number;

  /** Timestamp of last API request (for rate limiting) */
  private lastRequestTime: number;

  constructor() {
    this.cache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.lastRequestTime = 0;
  }

  /**
   * Search for an author by name
   *
   * Makes a request to Semantic Scholar API with retry logic.
   * Returns null if author not found or on error.
   *
   * @param name - Author's full name
   * @returns Author data with affiliations, or null if not found
   */
  async searchAuthor(name: string): Promise<SemanticScholarAuthor | null> {
    const maxRetries = config.semanticScholar.maxRetries;
    let lastError: Error | null = null;

    // Try initial request + retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Build URL
        const url = `${config.semanticScholar.apiUrl}?query=${encodeURIComponent(
          name
        )}&fields=${config.semanticScholar.authorSearchParams.fields}&limit=${
          config.semanticScholar.authorSearchParams.limit
        }`;

        // Make request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          config.semanticScholar.timeoutMs
        );

        const response = await fetch(url, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle non-OK responses
        if (!response.ok) {
          if (response.status === 404) {
            return null; // Author not found
          }
          throw new Error(`API returned ${response.status}`);
        }

        // Parse response
        const data: SemanticScholarSearchResponse = await response.json();

        // Check if we got results
        if (!data.data || data.data.length === 0) {
          return null;
        }

        // Return first author with normalized affiliations
        const author = data.data[0];
        return {
          authorId: author.authorId,
          name: author.name,
          affiliations: author.affiliations || [],
          citationCount: author.citationCount,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If we have retries left, wait before retrying
        if (attempt < maxRetries) {
          await this.sleep(config.semanticScholar.retryDelay);
          continue;
        }
      }
    }

    // All retries exhausted
    console.error(
      `Failed to search for author "${name}" after ${maxRetries + 1} attempts:`,
      lastError
    );
    return null;
  }

  /**
   * Determine geographic location from affiliations
   *
   * Checks if any affiliation contains USA keywords. If yes, returns 'USA'.
   * If affiliations exist but no USA match, returns 'International'.
   * If no affiliations, returns 'Unknown'.
   *
   * @param affiliations - Array of affiliation strings
   * @returns Location classification (USA, International, or Unknown)
   */
  determineLocation(affiliations: string[]): AuthorLocation {
    // No affiliations = Unknown
    if (!affiliations || affiliations.length === 0) {
      return 'Unknown';
    }

    // Join all affiliations and convert to lowercase for matching
    const affiliationText = affiliations.join(' ').toLowerCase();

    // Check if any USA keyword is found
    const isUSA = config.location.usaKeywords.some((keyword) =>
      affiliationText.includes(keyword.toLowerCase())
    );

    return isUSA ? 'USA' : 'International';
  }

  /**
   * Get author location data with caching
   *
   * Checks cache first. If not cached, searches Semantic Scholar API,
   * determines location, caches result, and returns.
   *
   * @param name - Author's full name
   * @returns Location data for the author
   */
  async getAuthorLocation(name: string): Promise<AuthorLocationData> {
    // Check cache first
    if (this.cache.has(name)) {
      this.cacheHits++;
      return this.cache.get(name)!;
    }

    // Cache miss
    this.cacheMisses++;

    // Rate limiting: ensure minimum delay between requests
    await this.applyRateLimit();

    // Search for author
    const authorData = await this.searchAuthor(name);

    // Build result
    const result: AuthorLocationData = {
      name,
      location: 'Unknown',
      affiliations: [],
      authorId: undefined,
    };

    if (authorData) {
      result.location = this.determineLocation(authorData.affiliations || []);
      result.affiliations = authorData.affiliations || [];
      result.authorId = authorData.authorId;
    }

    // Cache the result
    this.cache.set(name, result);

    return result;
  }

  /**
   * Apply rate limiting by waiting if necessary
   *
   * Ensures minimum delay between consecutive API requests.
   *
   * @private
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = config.semanticScholar.rateLimit.delayBetweenRequests;

    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Sleep for specified milliseconds
   *
   * @param ms - Milliseconds to sleep
   * @private
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear the author cache
   *
   * Removes all cached entries and resets statistics.
   * Useful for testing or manual cache invalidation.
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get cache statistics
   *
   * Returns current cache size, hits, and misses.
   * Useful for monitoring cache effectiveness.
   *
   * @returns Cache statistics object
   */
  getCacheStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
    };
  }
}

// ============================================================================
// Singleton Instance Export
// ============================================================================

/**
 * Singleton instance of SemanticScholarService
 *
 * Use this instance throughout the application to benefit from shared caching.
 *
 * @example
 * ```typescript
 * import { semanticScholarService } from '@/lib/services/semantic-scholar-service';
 *
 * const location = await semanticScholarService.getAuthorLocation('John Doe');
 * ```
 */
export const semanticScholarService = new SemanticScholarService();
