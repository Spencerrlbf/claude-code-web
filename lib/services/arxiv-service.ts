/**
 * arXiv Service
 *
 * This service encapsulates all interactions with the arXiv API for searching
 * academic papers. It handles query construction, XML parsing, and error handling.
 *
 * @module lib/services/arxiv-service
 */

import { XMLParser } from 'fast-xml-parser';
import type { ArxivPaper } from '@/lib/types';
import type { Config } from '@/lib/utils/config';

/**
 * Service for interacting with arXiv API
 *
 * @example
 * ```typescript
 * const service = new ArxivService(config.arxiv);
 * const papers = await service.searchPapers('abs:machine+learning', 10);
 * ```
 */
export class ArxivService {
  private config: Config['arxiv'];

  /**
   * Creates an instance of ArxivService
   *
   * @param config - arXiv configuration object
   */
  constructor(config: Config['arxiv']) {
    this.config = config;
  }

  /**
   * Search arXiv for papers matching a query
   *
   * This method constructs an arXiv API query, fetches results, parses the XML
   * response, and returns an array of typed paper objects.
   *
   * @param query - arXiv search query (e.g., "abs:machine+learning")
   * @param maxResults - Maximum number of results to return (defaults to config.defaultMaxResults)
   * @returns Promise resolving to array of papers (empty array on error)
   *
   * @example
   * ```typescript
   * // Search for papers about transformers
   * const papers = await service.searchPapers('abs:transformer+architecture', 20);
   * ```
   */
  async searchPapers(
    query: string,
    maxResults?: number
  ): Promise<ArxivPaper[]> {
    const maxResultsToUse = maxResults ?? this.config.defaultMaxResults;

    // Construct arXiv API URL
    const url = `${this.config.apiUrl}?search_query=${query}&start=0&max_results=${maxResultsToUse}&sortBy=${this.config.sortBy}&sortOrder=${this.config.sortOrder}`;

    try {
      // Fetch XML data from arXiv
      const response = await fetch(url);
      const xmlData = await response.text();

      // Parse XML and return papers
      return this.parseXmlResponse(xmlData);
    } catch (error) {
      // Log error and return empty array (graceful degradation)
      console.error(`Error searching arXiv with query "${query}":`, error);
      return [];
    }
  }

  /**
   * Parse arXiv XML response into typed papers
   *
   * This method handles the XML parsing logic, including:
   * - Single entry vs array of entries
   * - Filtering invalid entries (missing title or summary)
   * - Normalizing whitespace in text fields
   * - Handling single author vs multiple authors
   *
   * @private
   * @param xmlData - Raw XML string from arXiv API
   * @returns Array of parsed papers
   */
  private parseXmlResponse(xmlData: string): ArxivPaper[] {
    try {
      // Create XML parser
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });

      // Parse XML
      const result = parser.parse(xmlData);

      // Extract entries from feed
      const entries = result.feed?.entry
        ? Array.isArray(result.feed.entry)
          ? result.feed.entry
          : [result.feed.entry]
        : [];

      // Filter and map entries to ArxivPaper objects
      return entries
        .filter((entry: any) => entry && entry.title && entry.summary)
        .map((entry: any) => ({
          id: entry.id,
          title: entry.title?.replace(/\s+/g, ' ').trim() || '',
          authors: Array.isArray(entry.author)
            ? entry.author.map((a: any) => a.name)
            : entry.author?.name
            ? [entry.author.name]
            : ['Unknown'],
          summary: entry.summary?.replace(/\s+/g, ' ').trim() || '',
          published: entry.published || '',
          link: entry.id || '',
        }));
    } catch (error) {
      // Log parse error and return empty array
      console.error('Error parsing arXiv XML response:', error);
      return [];
    }
  }
}

/**
 * Create ArxivService with default config
 *
 * This is a convenience factory function that creates an ArxivService instance
 * using the default configuration from the config module.
 *
 * @param config - Optional config override (defaults to global config)
 * @returns ArxivService instance
 *
 * @example
 * ```typescript
 * const service = createArxivService();
 * const papers = await service.searchPapers('abs:NLP', 10);
 * ```
 */
export function createArxivService(
  config?: Config['arxiv']
): ArxivService {
  if (config) {
    return new ArxivService(config);
  }

  // Import config lazily to avoid circular dependencies
  const { config: globalConfig } = require('@/lib/utils/config');
  return new ArxivService(globalConfig.arxiv);
}
