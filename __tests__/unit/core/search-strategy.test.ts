/**
 * Tests for Search Strategy Module
 *
 * Test-driven development approach: Tests written first, then implementation.
 */

import {
  generateSearchStrategies,
  executeSearchStrategies,
  deduplicatePapers,
} from '@/lib/core/search-strategy';
import type { SearchStrategy, ArxivPaper } from '@/lib/types';

// ============================================================================
// Test Helpers
// ============================================================================

const createMockPaper = (id: string, title: string): ArxivPaper => ({
  id,
  title,
  authors: [`Author of ${id}`],
  summary: `Summary for ${title}`,
  published: '2024-01-01',
  link: `https://arxiv.org/abs/${id}`,
});

// ============================================================================
// Tests: deduplicatePapers
// ============================================================================

describe('deduplicatePapers', () => {
  it('should remove duplicate papers by ID', () => {
    const papers: ArxivPaper[] = [
      createMockPaper('paper1', 'Paper 1'),
      createMockPaper('paper2', 'Paper 2'),
      createMockPaper('paper1', 'Paper 1 (duplicate)'),
      createMockPaper('paper3', 'Paper 3'),
    ];

    const unique = deduplicatePapers(papers);

    expect(unique).toHaveLength(3);
    expect(unique.map((p) => p.id)).toEqual(['paper1', 'paper2', 'paper3']);
    expect(unique[0].title).toBe('Paper 1'); // First occurrence kept
  });

  it('should keep first occurrence of each paper', () => {
    const paper1a = createMockPaper('paper1', 'First version');
    const paper1b = createMockPaper('paper1', 'Second version');
    const papers: ArxivPaper[] = [paper1a, paper1b];

    const unique = deduplicatePapers(papers);

    expect(unique).toHaveLength(1);
    expect(unique[0].title).toBe('First version');
  });

  it('should handle empty array', () => {
    const unique = deduplicatePapers([]);
    expect(unique).toEqual([]);
  });

  it('should handle array with no duplicates', () => {
    const papers: ArxivPaper[] = [
      createMockPaper('paper1', 'Paper 1'),
      createMockPaper('paper2', 'Paper 2'),
      createMockPaper('paper3', 'Paper 3'),
    ];

    const unique = deduplicatePapers(papers);

    expect(unique).toHaveLength(3);
    expect(unique).toEqual(papers);
  });

  it('should handle all papers being duplicates', () => {
    const papers: ArxivPaper[] = [
      createMockPaper('paper1', 'Version 1'),
      createMockPaper('paper1', 'Version 2'),
      createMockPaper('paper1', 'Version 3'),
    ];

    const unique = deduplicatePapers(papers);

    expect(unique).toHaveLength(1);
    expect(unique[0].title).toBe('Version 1');
  });
});

// ============================================================================
// Tests: generateSearchStrategies
// ============================================================================

describe('generateSearchStrategies', () => {
  it('should generate strategies using OpenAI service', async () => {
    const mockOpenaiService = {
      generateSearchStrategies: jest.fn().mockResolvedValue([
        {
          name: 'Core Skills',
          rationale: 'Direct match for required skills',
          queries: ['machine learning', 'neural networks'],
        },
        {
          name: 'Adjacent Areas',
          rationale: 'Related fields that may be relevant',
          queries: ['computer vision', 'NLP'],
        },
      ]),
    };

    const strategies = await generateSearchStrategies(
      'Machine learning engineer role',
      mockOpenaiService as any
    );

    expect(strategies).toHaveLength(2);
    expect(strategies[0].name).toBe('Core Skills');
    expect(strategies[0].queries).toHaveLength(2);
    expect(mockOpenaiService.generateSearchStrategies).toHaveBeenCalledWith(
      'Machine learning engineer role'
    );
  });

  it('should handle empty job description', async () => {
    const mockOpenaiService = {
      generateSearchStrategies: jest.fn().mockResolvedValue([]),
    };

    const strategies = await generateSearchStrategies('', mockOpenaiService as any);

    expect(strategies).toEqual([]);
    expect(mockOpenaiService.generateSearchStrategies).toHaveBeenCalledWith('');
  });

  it('should handle OpenAI service failure', async () => {
    const mockOpenaiService = {
      generateSearchStrategies: jest
        .fn()
        .mockRejectedValue(new Error('OpenAI API timeout')),
    };

    await expect(
      generateSearchStrategies('Test JD', mockOpenaiService as any)
    ).rejects.toThrow('OpenAI API timeout');
  });

  it('should validate returned strategies have required fields', async () => {
    const mockOpenaiService = {
      generateSearchStrategies: jest.fn().mockResolvedValue([
        {
          name: 'Test Strategy',
          rationale: 'Test rationale',
          queries: ['query1', 'query2'],
        },
      ]),
    };

    const strategies = await generateSearchStrategies(
      'Test JD',
      mockOpenaiService as any
    );

    expect(strategies[0]).toHaveProperty('name');
    expect(strategies[0]).toHaveProperty('rationale');
    expect(strategies[0]).toHaveProperty('queries');
    expect(Array.isArray(strategies[0].queries)).toBe(true);
  });
});

// ============================================================================
// Tests: executeSearchStrategies
// ============================================================================

describe('executeSearchStrategies', () => {
  it('should execute all strategies and aggregate results', async () => {
    const mockArxivService = {
      searchPapers: jest
        .fn()
        .mockResolvedValueOnce([
          createMockPaper('paper1', 'Paper 1'),
          createMockPaper('paper2', 'Paper 2'),
        ])
        .mockResolvedValueOnce([createMockPaper('paper3', 'Paper 3')]),
    };

    const strategies: SearchStrategy[] = [
      {
        name: 'Strategy 1',
        rationale: 'Test strategy 1',
        queries: ['query1'],
      },
      {
        name: 'Strategy 2',
        rationale: 'Test strategy 2',
        queries: ['query2'],
      },
    ];

    const result = await executeSearchStrategies(strategies, mockArxivService as any);

    expect(result.papers).toHaveLength(3);
    expect(mockArxivService.searchPapers).toHaveBeenCalledTimes(2);
    expect(result.strategiesUsed).toHaveLength(2);
  });

  it('should deduplicate papers across strategies', async () => {
    const mockArxivService = {
      searchPapers: jest
        .fn()
        .mockResolvedValueOnce([
          createMockPaper('paper1', 'Paper 1'),
          createMockPaper('paper2', 'Paper 2'),
        ])
        .mockResolvedValueOnce([
          createMockPaper('paper2', 'Paper 2 (duplicate)'),
          createMockPaper('paper3', 'Paper 3'),
        ]),
    };

    const strategies: SearchStrategy[] = [
      { name: 'Strategy 1', rationale: 'Test', queries: ['query1'] },
      { name: 'Strategy 2', rationale: 'Test', queries: ['query2'] },
    ];

    const result = await executeSearchStrategies(strategies, mockArxivService as any);

    expect(result.papers).toHaveLength(3); // Only unique papers
    expect(result.totalPapersFound).toBe(4); // Before deduplication
    expect(result.duplicatesRemoved).toBe(1);
  });

  it('should collect metadata about each strategy', async () => {
    const mockArxivService = {
      searchPapers: jest
        .fn()
        .mockResolvedValueOnce([
          createMockPaper('paper1', 'Paper 1'),
          createMockPaper('paper2', 'Paper 2'),
        ])
        .mockResolvedValueOnce([createMockPaper('paper3', 'Paper 3')]),
    };

    const strategies: SearchStrategy[] = [
      { name: 'Core Skills', rationale: 'Direct match', queries: ['ml'] },
      { name: 'Adjacent', rationale: 'Related', queries: ['ai'] },
    ];

    const result = await executeSearchStrategies(strategies, mockArxivService as any);

    expect(result.strategiesUsed[0].name).toBe('Core Skills');
    expect(result.strategiesUsed[0].rationale).toBe('Direct match');
    expect(result.strategiesUsed[0].papersFound).toBe(2);
    expect(result.strategiesUsed[0].queriesExecuted).toBe(1);

    expect(result.strategiesUsed[1].name).toBe('Adjacent');
    expect(result.strategiesUsed[1].papersFound).toBe(1);
  });

  it('should handle empty strategies array', async () => {
    const mockArxivService = {
      searchPapers: jest.fn(),
    };

    const result = await executeSearchStrategies([], mockArxivService as any);

    expect(result.papers).toEqual([]);
    expect(result.strategiesUsed).toEqual([]);
    expect(result.totalPapersFound).toBe(0);
    expect(result.duplicatesRemoved).toBe(0);
    expect(mockArxivService.searchPapers).not.toHaveBeenCalled();
  });

  it('should handle arXiv service failures gracefully', async () => {
    const mockArxivService = {
      searchPapers: jest
        .fn()
        .mockResolvedValueOnce([createMockPaper('paper1', 'Paper 1')])
        .mockRejectedValueOnce(new Error('API timeout')),
    };

    const strategies: SearchStrategy[] = [
      { name: 'Strategy 1', rationale: 'Test', queries: ['query1'] },
      { name: 'Strategy 2', rationale: 'Test', queries: ['query2'] },
    ];

    // Should not throw, should return partial results
    const result = await executeSearchStrategies(strategies, mockArxivService as any);

    expect(result.papers).toHaveLength(1); // Only from successful query
    expect(result.strategiesUsed[1].papersFound).toBe(0); // Failed strategy reports 0 papers
  });

  it('should handle partial failures (some strategies fail)', async () => {
    const mockArxivService = {
      searchPapers: jest
        .fn()
        .mockResolvedValueOnce([createMockPaper('paper1', 'Paper 1')])
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([createMockPaper('paper2', 'Paper 2')]),
    };

    const strategies: SearchStrategy[] = [
      { name: 'Strategy 1', rationale: 'Test', queries: ['query1'] },
      { name: 'Strategy 2', rationale: 'Test', queries: ['query2'] },
      { name: 'Strategy 3', rationale: 'Test', queries: ['query3'] },
    ];

    const result = await executeSearchStrategies(strategies, mockArxivService as any);

    expect(result.papers).toHaveLength(2); // From successful queries only
    expect(result.strategiesUsed).toHaveLength(3); // All strategies reported
    expect(result.strategiesUsed[1].papersFound).toBe(0); // Failed strategy
  });

  it('should execute multiple queries within a strategy', async () => {
    const mockArxivService = {
      searchPapers: jest
        .fn()
        .mockResolvedValueOnce([createMockPaper('paper1', 'Paper 1')])
        .mockResolvedValueOnce([createMockPaper('paper2', 'Paper 2')])
        .mockResolvedValueOnce([createMockPaper('paper3', 'Paper 3')]),
    };

    const strategies: SearchStrategy[] = [
      {
        name: 'Multi-query Strategy',
        rationale: 'Test multiple queries',
        queries: ['query1', 'query2', 'query3'],
      },
    ];

    const result = await executeSearchStrategies(strategies, mockArxivService as any);

    expect(result.papers).toHaveLength(3);
    expect(mockArxivService.searchPapers).toHaveBeenCalledTimes(3);
    expect(result.strategiesUsed[0].queriesExecuted).toBe(3);
    expect(result.strategiesUsed[0].papersFound).toBe(3);
  });

  it('should handle queries returning empty results', async () => {
    const mockArxivService = {
      searchPapers: jest.fn().mockResolvedValue([]),
    };

    const strategies: SearchStrategy[] = [
      { name: 'Empty Strategy', rationale: 'Test', queries: ['obscure query'] },
    ];

    const result = await executeSearchStrategies(strategies, mockArxivService as any);

    expect(result.papers).toEqual([]);
    expect(result.strategiesUsed[0].papersFound).toBe(0);
  });
});
