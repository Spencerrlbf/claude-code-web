/**
 * Tests for AI Evaluation Module
 *
 * Tests cover:
 * - Successful evaluation for all candidates
 * - Partial failures (some candidates fail)
 * - Invalid JSON response handling
 * - Complete API failure scenarios
 * - Sequential processing
 * - Edge cases (empty arrays, single candidate)
 *
 * @group unit
 * @group core
 */

import {
  evaluateResearchers,
  type EvaluationResult,
  type EvaluationOptions,
} from '@/lib/core/ai-evaluation';
import { OpenAIService } from '@/lib/services/openai-service';
import type { AuthorCandidate, SearchStrategy } from '@/lib/types';

// Mock the OpenAI Service
jest.mock('@/lib/services/openai-service');

describe('AI Evaluation Module', () => {
  let mockOpenAIService: jest.Mocked<OpenAIService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create a mock instance
    mockOpenAIService = new OpenAIService(
      {} as any,
      {} as any
    ) as jest.Mocked<OpenAIService>;

    // Get the mocked class
    const MockedOpenAIService = OpenAIService as jest.MockedClass<
      typeof OpenAIService
    >;

    // Ensure the mocked constructor returns our mock instance
    MockedOpenAIService.mockImplementation(() => mockOpenAIService);
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  const createMockCandidate = (
    name: string,
    similarityScore = 0.85
  ): AuthorCandidate => ({
    name,
    similarityScore,
    paper: {
      id: `arxiv-${name.replace(/\s+/g, '-').toLowerCase()}`,
      title: `Sample Paper by ${name}`,
      authors: [name, 'Co-Author'],
      summary: `This paper presents novel research in machine learning by ${name}. The approach demonstrates significant improvements over baseline methods.`,
      published: '2024-01-01',
      link: 'https://arxiv.org/abs/1234.5678',
    },
    location: 'USA',
    affiliation: 'MIT',
  });

  const createMockStrategy = (name: string): SearchStrategy => ({
    name,
    rationale: `Strategy for ${name}`,
    queries: [`abs:${name.toLowerCase().replace(/\s+/g, '+')}`],
  });

  const mockJobDescription = `We are seeking a machine learning researcher with expertise in deep learning,
natural language processing, and computer vision. The ideal candidate will have strong
publication record and practical experience deploying ML systems.`;

  const mockStrategies: SearchStrategy[] = [
    createMockStrategy('Deep Learning'),
    createMockStrategy('Natural Language Processing'),
    createMockStrategy('Computer Vision'),
  ];

  // ==========================================================================
  // evaluateResearchers() - Success Cases
  // ==========================================================================

  describe('evaluateResearchers - success cases', () => {
    test('should successfully evaluate all candidates when all API calls succeed', async () => {
      const candidates = [
        createMockCandidate('Alice Johnson'),
        createMockCandidate('Bob Smith'),
        createMockCandidate('Charlie Davis'),
      ];

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockImplementation(async (candidate: AuthorCandidate) => {
          // Return different scores based on candidate
          const scores: Record<string, number> = {
            'Alice Johnson': 85,
            'Bob Smith': 72,
            'Charlie Davis': 90,
          };

          return {
            score: scores[candidate.name] || 50,
            reason: `${candidate.name} has relevant experience in machine learning with strong publication record.`,
          };
        });

      const results = await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results).toHaveLength(3);

      // Check Alice Johnson
      expect(results[0].authorName).toBe('Alice Johnson');
      expect(results[0].score).toBe(85);
      expect(results[0].success).toBe(true);
      expect(results[0].reason).toContain('Alice Johnson');
      expect(results[0].error).toBeUndefined();

      // Check Bob Smith
      expect(results[1].authorName).toBe('Bob Smith');
      expect(results[1].score).toBe(72);
      expect(results[1].success).toBe(true);

      // Check Charlie Davis
      expect(results[2].authorName).toBe('Charlie Davis');
      expect(results[2].score).toBe(90);
      expect(results[2].success).toBe(true);

      // Verify service was called for each candidate
      expect(mockOpenAIService.evaluateResearcherFit).toHaveBeenCalledTimes(3);
    });

    test('should process candidates sequentially', async () => {
      const candidates = [
        createMockCandidate('Candidate 1'),
        createMockCandidate('Candidate 2'),
        createMockCandidate('Candidate 3'),
      ];

      const callOrder: string[] = [];

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockImplementation(async (candidate: AuthorCandidate) => {
          callOrder.push(`start-${candidate.name}`);
          await new Promise((resolve) => setTimeout(resolve, 50));
          callOrder.push(`end-${candidate.name}`);

          return {
            score: 75,
            reason: 'Good fit',
          };
        });

      await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      // Verify sequential processing: each candidate starts after the previous one ends
      expect(callOrder).toEqual([
        'start-Candidate 1',
        'end-Candidate 1',
        'start-Candidate 2',
        'end-Candidate 2',
        'start-Candidate 3',
        'end-Candidate 3',
      ]);
    });

    test('should pass correct parameters to OpenAI service', async () => {
      const candidate = createMockCandidate('Test Author');

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockResolvedValue({ score: 80, reason: 'Good fit' });

      await evaluateResearchers(
        [candidate],
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(mockOpenAIService.evaluateResearcherFit).toHaveBeenCalledWith(
        candidate,
        mockJobDescription,
        mockStrategies
      );
    });

    test('should handle empty candidates array', async () => {
      const results = await evaluateResearchers(
        [],
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results).toEqual([]);
      expect(mockOpenAIService.evaluateResearcherFit).not.toHaveBeenCalled();
    });

    test('should handle single candidate', async () => {
      const candidate = createMockCandidate('Solo Author');

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockResolvedValue({ score: 88, reason: 'Excellent match' });

      const results = await evaluateResearchers(
        [candidate],
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results).toHaveLength(1);
      expect(results[0].authorName).toBe('Solo Author');
      expect(results[0].score).toBe(88);
      expect(results[0].success).toBe(true);
    });
  });

  // ==========================================================================
  // evaluateResearchers() - Partial Failures
  // ==========================================================================

  describe('evaluateResearchers - partial failures', () => {
    test('should handle partial failures gracefully', async () => {
      const candidates = [
        createMockCandidate('Good Author 1'),
        createMockCandidate('Bad Author'),
        createMockCandidate('Good Author 2'),
      ];

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockImplementation(async (candidate: AuthorCandidate) => {
          if (candidate.name === 'Bad Author') {
            throw new Error('API Error');
          }
          return { score: 75, reason: 'Good fit' };
        });

      const results = await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results).toHaveLength(3);

      // First candidate should succeed
      expect(results[0].authorName).toBe('Good Author 1');
      expect(results[0].success).toBe(true);
      expect(results[0].score).toBe(75);

      // Second candidate should fail with default values
      expect(results[1].authorName).toBe('Bad Author');
      expect(results[1].success).toBe(false);
      expect(results[1].score).toBe(50); // Default score
      expect(results[1].reason).toContain('Unable to evaluate');
      expect(results[1].error).toBe('API Error');

      // Third candidate should succeed
      expect(results[2].authorName).toBe('Good Author 2');
      expect(results[2].success).toBe(true);
      expect(results[2].score).toBe(75);
    });

    test('should use custom default score when provided', async () => {
      const candidates = [createMockCandidate('Failed Author')];

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockRejectedValue(new Error('Service error'));

      const options: EvaluationOptions = {
        defaultScore: 30,
      };

      const results = await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        options
      );

      expect(results[0].success).toBe(false);
      expect(results[0].score).toBe(30); // Custom default
    });

    test('should handle network timeout errors', async () => {
      const candidates = [createMockCandidate('Timeout Author')];

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockRejectedValue(new Error('Request timeout'));

      const results = await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Request timeout');
      expect(results[0].reason).toContain('Unable to evaluate');
    });
  });

  // ==========================================================================
  // evaluateResearchers() - Complete API Failure
  // ==========================================================================

  describe('evaluateResearchers - complete API failure', () => {
    test('should handle all evaluations failing', async () => {
      const candidates = [
        createMockCandidate('Author 1'),
        createMockCandidate('Author 2'),
        createMockCandidate('Author 3'),
      ];

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockRejectedValue(new Error('Service unavailable'));

      const results = await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results).toHaveLength(3);

      // All should have failed
      results.forEach((result, index) => {
        expect(result.success).toBe(false);
        expect(result.score).toBe(50); // Default score
        expect(result.reason).toContain('Unable to evaluate');
        expect(result.error).toBe('Service unavailable');
        expect(result.authorName).toBe(`Author ${index + 1}`);
      });
    });

    test('should handle rate limiting errors with default score', async () => {
      const candidates = [createMockCandidate('Rate Limited Author')];

      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockRejectedValue(rateLimitError);

      const results = await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].success).toBe(false);
      expect(results[0].score).toBe(50);
    });
  });

  // ==========================================================================
  // evaluateResearchers() - Invalid JSON Handling
  // ==========================================================================

  describe('evaluateResearchers - invalid JSON handling', () => {
    test('should handle malformed JSON response gracefully', async () => {
      const candidates = [createMockCandidate('JSON Error Author')];

      // OpenAI service already handles JSON parsing, so if it returns
      // invalid data, we should handle it
      mockOpenAIService.evaluateResearcherFit = jest.fn().mockResolvedValue({
        score: null, // Invalid score
        reason: null, // Invalid reason
      });

      const results = await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].success).toBe(true);
      expect(results[0].score).toBe(0); // Coalesced from null
      expect(results[0].reason).toBe(''); // Coalesced from null
    });

    test('should handle response with missing fields', async () => {
      const candidates = [createMockCandidate('Missing Fields Author')];

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockResolvedValue({} as any);

      const results = await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].success).toBe(true);
      expect(results[0].score).toBeDefined();
      expect(results[0].reason).toBeDefined();
    });
  });

  // ==========================================================================
  // evaluateResearchers() - Edge Cases
  // ==========================================================================

  describe('evaluateResearchers - edge cases', () => {
    test('should handle candidate with empty paper summary', async () => {
      const candidate = createMockCandidate('Empty Summary Author');
      candidate.paper.summary = '';

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockResolvedValue({ score: 60, reason: 'Limited information' });

      const results = await evaluateResearchers(
        [candidate],
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].success).toBe(true);
      expect(mockOpenAIService.evaluateResearcherFit).toHaveBeenCalledWith(
        candidate,
        mockJobDescription,
        mockStrategies
      );
    });

    test('should handle candidate with special characters in name', async () => {
      const candidate = createMockCandidate("O'Brien-Müller");

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockResolvedValue({ score: 75, reason: 'Good fit' });

      const results = await evaluateResearchers(
        [candidate],
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].authorName).toBe("O'Brien-Müller");
      expect(results[0].success).toBe(true);
    });

    test('should handle very long job descriptions', async () => {
      const candidate = createMockCandidate('Test Author');
      const longJobDescription = 'We need a researcher '.repeat(1000);

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockResolvedValue({ score: 70, reason: 'Matches requirements' });

      const results = await evaluateResearchers(
        [candidate],
        longJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].success).toBe(true);
      expect(mockOpenAIService.evaluateResearcherFit).toHaveBeenCalledWith(
        candidate,
        longJobDescription,
        mockStrategies
      );
    });

    test('should handle empty strategies array', async () => {
      const candidate = createMockCandidate('Test Author');

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockResolvedValue({ score: 65, reason: 'General fit' });

      const results = await evaluateResearchers(
        [candidate],
        mockJobDescription,
        [],
        { openAIService: mockOpenAIService }
      );

      expect(results[0].success).toBe(true);
      expect(mockOpenAIService.evaluateResearcherFit).toHaveBeenCalledWith(
        candidate,
        mockJobDescription,
        []
      );
    });

    test('should handle candidate without location information', async () => {
      const candidate = createMockCandidate('No Location Author');
      delete candidate.location;
      delete candidate.affiliation;

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockResolvedValue({ score: 80, reason: 'Good fit' });

      const results = await evaluateResearchers(
        [candidate],
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].success).toBe(true);
    });

    test('should handle non-Error object thrown', async () => {
      const candidate = createMockCandidate('String Error Author');

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockRejectedValue('String error message');

      const results = await evaluateResearchers(
        [candidate],
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('String error message');
    });

    test('should handle undefined error', async () => {
      const candidate = createMockCandidate('Undefined Error Author');

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockRejectedValue(undefined);

      const results = await evaluateResearchers(
        [candidate],
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });
  });

  // ==========================================================================
  // Integration Scenarios
  // ==========================================================================

  describe('integration scenarios', () => {
    test('should handle mixed results with varying scores', async () => {
      const candidates = [
        createMockCandidate('High Score Author'),
        createMockCandidate('Medium Score Author'),
        createMockCandidate('Low Score Author'),
        createMockCandidate('Failed Author'),
      ];

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockImplementation(async (candidate: AuthorCandidate) => {
          if (candidate.name === 'High Score Author')
            return { score: 95, reason: 'Excellent match' };
          if (candidate.name === 'Medium Score Author')
            return { score: 70, reason: 'Good match' };
          if (candidate.name === 'Low Score Author')
            return { score: 45, reason: 'Weak match' };
          throw new Error('Evaluation failed');
        });

      const results = await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].score).toBe(95);
      expect(results[0].success).toBe(true);

      expect(results[1].score).toBe(70);
      expect(results[1].success).toBe(true);

      expect(results[2].score).toBe(45);
      expect(results[2].success).toBe(true);

      expect(results[3].score).toBe(50); // Default
      expect(results[3].success).toBe(false);
    });

    test('should preserve candidate order in results', async () => {
      const candidates = [
        createMockCandidate('Zebra'),
        createMockCandidate('Alpha'),
        createMockCandidate('Beta'),
      ];

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockResolvedValue({ score: 75, reason: 'Good fit' });

      const results = await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results[0].authorName).toBe('Zebra');
      expect(results[1].authorName).toBe('Alpha');
      expect(results[2].authorName).toBe('Beta');
    });

    test('should handle large batch of candidates', async () => {
      const candidates = Array.from({ length: 50 }, (_, i) =>
        createMockCandidate(`Author ${i}`)
      );

      mockOpenAIService.evaluateResearcherFit = jest
        .fn()
        .mockResolvedValue({ score: 75, reason: 'Good fit' });

      const results = await evaluateResearchers(
        candidates,
        mockJobDescription,
        mockStrategies,
        { openAIService: mockOpenAIService }
      );

      expect(results).toHaveLength(50);
      expect(mockOpenAIService.evaluateResearcherFit).toHaveBeenCalledTimes(
        50
      );

      results.forEach((result, index) => {
        expect(result.authorName).toBe(`Author ${index}`);
        expect(result.success).toBe(true);
      });
    });
  });
});
