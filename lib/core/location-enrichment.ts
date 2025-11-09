/**
 * Location Enrichment Module
 *
 * Enriches author candidates with location information from Semantic Scholar.
 * Handles parallel processing, error handling, and rate limiting.
 *
 * @module lib/core/location-enrichment
 */

import { SemanticScholarService } from '@/lib/services/semantic-scholar-service';
import type { AuthorCandidate, Location } from '@/lib/types';
import type { AuthorLocationData } from '@/lib/services/semantic-scholar-service';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * An author candidate enriched with location information
 */
export interface EnrichedAuthor extends AuthorCandidate {
  /** Geographic location of the author */
  location: Location;
  /** Author's institutional affiliations */
  affiliations?: string[];
  /** Error message if location lookup failed */
  locationCheckError?: string;
}

/**
 * Configuration options for location enrichment
 */
export interface LocationEnrichmentOptions {
  /** Maximum number of concurrent API requests (default: 5) */
  maxConcurrent?: number;
  /** Timeout in milliseconds for each author lookup (default: 5000) */
  timeoutMs?: number;
  /** Whether to continue processing if some lookups fail (default: true) */
  continueOnError?: boolean;
}

/**
 * Statistics about the enrichment process
 */
export interface LocationEnrichmentStats {
  /** Total number of authors processed */
  total: number;
  /** Number of authors successfully enriched */
  enriched: number;
  /** Number of authors that failed to enrich */
  failed: number;
  /** Number of USA-based authors */
  usa: number;
  /** Number of International authors */
  international: number;
  /** Number of Unknown location authors */
  unknown: number;
}

/**
 * Result of the location enrichment process
 */
export interface LocationEnrichmentResult {
  /** Array of enriched author candidates */
  enrichedAuthors: EnrichedAuthor[];
  /** Statistics about the enrichment process */
  stats: LocationEnrichmentStats;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<LocationEnrichmentOptions> = {
  maxConcurrent: 5,
  timeoutMs: 5000,
  continueOnError: true,
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Enriches a single author with location information
 *
 * Queries Semantic Scholar for the author's affiliations and determines
 * their geographic location. If the lookup fails, marks location as 'Unknown'
 * and includes error details (or throws if throwOnError is true).
 *
 * @param author - The author candidate to enrich
 * @param service - Optional Semantic Scholar service instance (for testing)
 * @param timeoutMs - Optional timeout in milliseconds
 * @param throwOnError - If true, throws errors instead of returning Unknown (default: false)
 * @returns Promise resolving to enriched author with location data
 *
 * @example
 * ```typescript
 * const author = { name: 'John Doe', similarityScore: 0.85, paper: {...} };
 * const enriched = await enrichSingleAuthor(author);
 * console.log(enriched.location); // 'USA' | 'International' | 'Unknown'
 * ```
 */
export async function enrichSingleAuthor(
  author: AuthorCandidate,
  service?: SemanticScholarService,
  timeoutMs?: number,
  throwOnError = false
): Promise<EnrichedAuthor> {
  // Use provided service or create new instance
  const semanticScholar = service || new SemanticScholarService();

  try {
    // Create a timeout promise
    const timeout = timeoutMs || DEFAULT_OPTIONS.timeoutMs;
    const timeoutPromise = new Promise<AuthorLocationData>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeout);
    });

    // Race between actual lookup and timeout
    const locationData = await Promise.race([
      semanticScholar.getAuthorLocation(author.name),
      timeoutPromise,
    ]);

    // Successfully enriched
    return {
      ...author,
      location: locationData.location,
      affiliations: locationData.affiliations,
    };
  } catch (error) {
    // If throwOnError is true, propagate the error
    if (throwOnError) {
      throw error;
    }

    // Lookup failed - mark as Unknown with error details
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      ...author,
      location: 'Unknown',
      affiliations: [],
      locationCheckError: errorMessage,
    };
  }
}

/**
 * Enriches multiple authors with location information in parallel
 *
 * Processes a list of author candidates, querying Semantic Scholar for each
 * to determine their geographic location. Processing is done in parallel with
 * a configurable concurrency limit to avoid overwhelming the API.
 *
 * @param authors - Array of author candidates to enrich
 * @param options - Configuration options for enrichment process
 * @returns Promise resolving to enrichment result with statistics
 *
 * @throws Error if continueOnError is false and any lookup fails
 *
 * @example
 * ```typescript
 * const authors = [...]; // Array of AuthorCandidate
 * const result = await enrichWithLocation(authors, {
 *   maxConcurrent: 10,
 *   timeoutMs: 3000,
 *   continueOnError: true
 * });
 * console.log(`Enriched ${result.stats.enriched}/${result.stats.total}`);
 * ```
 */
export async function enrichWithLocation(
  authors: AuthorCandidate[],
  options: LocationEnrichmentOptions = {}
): Promise<LocationEnrichmentResult> {
  // Merge provided options with defaults
  const opts: Required<LocationEnrichmentOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  // Handle empty input
  if (authors.length === 0) {
    return {
      enrichedAuthors: [],
      stats: {
        total: 0,
        enriched: 0,
        failed: 0,
        usa: 0,
        international: 0,
        unknown: 0,
      },
    };
  }

  // Create a single service instance for all lookups (shared cache)
  const service = new SemanticScholarService();

  // Process authors in parallel with concurrency limit
  const enrichedAuthors = await parallelProcess(
    authors,
    async (author) => {
      // Pass throwOnError based on continueOnError option
      return await enrichSingleAuthor(
        author,
        service,
        opts.timeoutMs,
        !opts.continueOnError // Throw on error if continueOnError is false
      );
    },
    opts.maxConcurrent
  );

  // Calculate statistics
  const stats = calculateStats(enrichedAuthors);

  return {
    enrichedAuthors,
    stats,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Process items in parallel with a concurrency limit
 *
 * Processes an array of items through an async processor function, ensuring
 * that no more than `maxConcurrent` items are processed simultaneously.
 * Maintains the original order of items in the results.
 *
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param maxConcurrent - Maximum number of concurrent operations
 * @returns Promise resolving to array of processed results in original order
 *
 * @private
 */
async function parallelProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  maxConcurrent: number
): Promise<R[]> {
  // Results array to maintain order
  const results: R[] = new Array(items.length);

  // Track current index
  let currentIndex = 0;

  // Worker function - processes items until none are left
  const worker = async (): Promise<void> => {
    while (currentIndex < items.length) {
      // Get next item and increment index
      const index = currentIndex++;
      const item = items[index];

      // Process item and store result at correct index
      results[index] = await processor(item);
    }
  };

  // Create worker pool
  const workers = Array.from({ length: Math.min(maxConcurrent, items.length) }, () =>
    worker()
  );

  // Wait for all workers to complete
  await Promise.all(workers);

  return results;
}

/**
 * Calculate statistics from enriched authors
 *
 * Analyzes the enriched author list to generate statistics about
 * the enrichment process and location distribution.
 *
 * @param authors - Array of enriched authors
 * @returns Statistics object
 *
 * @private
 */
function calculateStats(authors: EnrichedAuthor[]): LocationEnrichmentStats {
  const stats: LocationEnrichmentStats = {
    total: authors.length,
    enriched: 0,
    failed: 0,
    usa: 0,
    international: 0,
    unknown: 0,
  };

  for (const author of authors) {
    // Count enriched vs failed
    if (author.locationCheckError) {
      stats.failed++;
    } else {
      stats.enriched++;
    }

    // Count by location
    switch (author.location) {
      case 'USA':
        stats.usa++;
        break;
      case 'International':
        stats.international++;
        break;
      case 'Unknown':
        stats.unknown++;
        break;
    }
  }

  return stats;
}
