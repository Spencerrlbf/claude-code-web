/**
 * Unit tests for ArxivService
 *
 * These tests use mocked fetch to test the service in isolation.
 * Following TDD approach - tests written before implementation.
 */

import { ArxivService } from '@/lib/services/arxiv-service';
import type { ArxivPaper } from '@/lib/types';
import type { Config } from '@/lib/utils/config';

// Mock XML Fixtures
const MOCK_XML_MULTIPLE_ENTRIES = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <title>Attention Is All You Need</title>
    <author>
      <name>Ashish Vaswani</name>
    </author>
    <author>
      <name>Noam Shazeer</name>
    </author>
    <summary>The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.</summary>
    <published>2023-01-15T09:00:00Z</published>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2301.67890v1</id>
    <title>BERT: Pre-training of Deep Bidirectional Transformers</title>
    <author>
      <name>Jacob Devlin</name>
    </author>
    <summary>We introduce a new language representation model called BERT.</summary>
    <published>2023-01-20T14:30:00Z</published>
  </entry>
</feed>`;

const MOCK_XML_SINGLE_ENTRY = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <title>Single Paper</title>
    <author>
      <name>John Doe</name>
    </author>
    <summary>This is a single paper result.</summary>
    <published>2023-01-15T09:00:00Z</published>
  </entry>
</feed>`;

const MOCK_XML_EMPTY_RESULTS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
</feed>`;

const MOCK_XML_MISSING_TITLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <author>
      <name>John Doe</name>
    </author>
    <summary>This entry has no title.</summary>
    <published>2023-01-15T09:00:00Z</published>
  </entry>
</feed>`;

const MOCK_XML_MISSING_SUMMARY = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <title>This entry has no summary</title>
    <author>
      <name>John Doe</name>
    </author>
    <published>2023-01-15T09:00:00Z</published>
  </entry>
</feed>`;

const MOCK_XML_SINGLE_AUTHOR = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <title>Solo Author Paper</title>
    <author>
      <name>Jane Smith</name>
    </author>
    <summary>A paper by a single author.</summary>
    <published>2023-01-15T09:00:00Z</published>
  </entry>
</feed>`;

const MOCK_XML_WHITESPACE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <title>Title   with    extra
    whitespace</title>
    <author>
      <name>John Doe</name>
    </author>
    <summary>Summary   with
    multiple   spaces   and
    newlines.</summary>
    <published>2023-01-15T09:00:00Z</published>
  </entry>
</feed>`;

const MOCK_XML_MALFORMED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <title>Unclosed title
    <author>
      <name>John Doe</name>
    </author>
`;

const MOCK_XML_MIXED_VALID_INVALID = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.11111v1</id>
    <title>Valid Paper 1</title>
    <author>
      <name>Alice</name>
    </author>
    <summary>This is valid.</summary>
    <published>2023-01-15T09:00:00Z</published>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2301.22222v1</id>
    <author>
      <name>Bob</name>
    </author>
    <summary>Missing title.</summary>
    <published>2023-01-16T09:00:00Z</published>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2301.33333v1</id>
    <title>Valid Paper 2</title>
    <author>
      <name>Charlie</name>
    </author>
    <summary>This is also valid.</summary>
    <published>2023-01-17T09:00:00Z</published>
  </entry>
</feed>`;

describe('ArxivService', () => {
  let service: ArxivService;
  let mockConfig: Config['arxiv'];
  let mockFetch: jest.Mock;

  beforeEach(() => {
    // Mock config
    mockConfig = {
      apiUrl: 'http://export.arxiv.org/api/query',
      defaultMaxResults: 50,
      maxResultsPerQuery: 40,
      sortBy: 'submittedDate',
      sortOrder: 'descending',
      timeoutMs: 10000,
    };

    // Create service instance
    service = new ArxivService(mockConfig);

    // Mock global fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Mock console.error to avoid cluttering test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================================================
  // searchPapers Tests - Successful Cases
  // ============================================================================

  describe('searchPapers - successful cases', () => {
    it('should return papers for successful search with multiple entries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_MULTIPLE_ENTRIES,
      });

      const result = await service.searchPapers('abs:machine+learning', 10);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'http://arxiv.org/abs/2301.12345v1',
        title: 'Attention Is All You Need',
        authors: ['Ashish Vaswani', 'Noam Shazeer'],
        summary: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
        published: '2023-01-15T09:00:00Z',
        link: 'http://arxiv.org/abs/2301.12345v1',
      });
      expect(result[1]).toEqual({
        id: 'http://arxiv.org/abs/2301.67890v1',
        title: 'BERT: Pre-training of Deep Bidirectional Transformers',
        authors: ['Jacob Devlin'],
        summary: 'We introduce a new language representation model called BERT.',
        published: '2023-01-20T14:30:00Z',
        link: 'http://arxiv.org/abs/2301.67890v1',
      });
    });

    it('should handle single entry (not array)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_SINGLE_ENTRY,
      });

      const result = await service.searchPapers('abs:specific+paper', 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'http://arxiv.org/abs/2301.12345v1',
        title: 'Single Paper',
        authors: ['John Doe'],
        summary: 'This is a single paper result.',
        published: '2023-01-15T09:00:00Z',
        link: 'http://arxiv.org/abs/2301.12345v1',
      });
    });

    it('should handle single author (not array)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_SINGLE_AUTHOR,
      });

      const result = await service.searchPapers('abs:solo+research', 5);

      expect(result).toHaveLength(1);
      expect(result[0].authors).toEqual(['Jane Smith']);
    });

    it('should normalize whitespace in title and summary', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_WHITESPACE,
      });

      const result = await service.searchPapers('abs:test', 5);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Title with extra whitespace');
      expect(result[0].summary).toBe('Summary with multiple spaces and newlines.');
    });

    it('should return empty array for empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_EMPTY_RESULTS,
      });

      const result = await service.searchPapers('abs:nonexistent+topic', 10);

      expect(result).toEqual([]);
    });

    it('should filter out entries missing title but keep valid ones', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_MIXED_VALID_INVALID,
      });

      const result = await service.searchPapers('abs:test', 10);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Valid Paper 1');
      expect(result[1].title).toBe('Valid Paper 2');
    });

    it('should filter out entries missing summary', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_MISSING_SUMMARY,
      });

      const result = await service.searchPapers('abs:test', 10);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // searchPapers Tests - API URL Construction
  // ============================================================================

  describe('searchPapers - API URL construction', () => {
    it('should use correct API URL format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_EMPTY_RESULTS,
      });

      await service.searchPapers('abs:machine+learning', 10);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('http://export.arxiv.org/api/query');
      expect(callUrl).toContain('search_query=abs:machine+learning');
      expect(callUrl).toContain('start=0');
      expect(callUrl).toContain('max_results=10');
      expect(callUrl).toContain('sortBy=submittedDate');
      expect(callUrl).toContain('sortOrder=descending');
    });

    it('should use default maxResults when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_EMPTY_RESULTS,
      });

      await service.searchPapers('abs:test');

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('max_results=50'); // defaultMaxResults from config
    });

    it('should use provided maxResults', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_EMPTY_RESULTS,
      });

      await service.searchPapers('abs:test', 25);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('max_results=25');
    });
  });

  // ============================================================================
  // searchPapers Tests - Error Handling
  // ============================================================================

  describe('searchPapers - error handling', () => {
    it('should return empty array on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.searchPapers('abs:test', 10);

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error searching arXiv'),
        expect.any(Error)
      );
    });

    it('should return empty array on malformed XML', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_MALFORMED,
      });

      const result = await service.searchPapers('abs:test', 10);

      expect(result).toEqual([]);
    });

    it('should log errors to console', async () => {
      const testError = new Error('Test error');
      mockFetch.mockRejectedValueOnce(testError);

      await service.searchPapers('abs:test', 10);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error searching arXiv'),
        testError
      );
    });

    it('should handle fetch returning non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Error',
      });

      const result = await service.searchPapers('abs:test', 10);

      // Should still try to parse the response
      // But will return empty array due to invalid XML
      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('searchPapers - edge cases', () => {
    it('should handle empty query string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_EMPTY_RESULTS,
      });

      const result = await service.searchPapers('', 10);

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle maxResults of 0', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_XML_EMPTY_RESULTS,
      });

      const result = await service.searchPapers('abs:test', 0);

      expect(result).toEqual([]);
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('max_results=0');
    });

    it('should handle entries with missing authors (default to Unknown)', async () => {
      const xmlMissingAuthor = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.12345v1</id>
    <title>Paper with no author</title>
    <summary>This paper somehow has no author listed.</summary>
    <published>2023-01-15T09:00:00Z</published>
  </entry>
</feed>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => xmlMissingAuthor,
      });

      const result = await service.searchPapers('abs:test', 5);

      expect(result).toHaveLength(1);
      expect(result[0].authors).toEqual(['Unknown']);
    });
  });
});
