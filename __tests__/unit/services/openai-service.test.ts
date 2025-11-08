/**
 * Unit tests for OpenAI Service
 *
 * These tests use mocked OpenAI client to test the service in isolation.
 * Following TDD approach - tests written before implementation.
 */

import { OpenAIService } from '@/lib/services/openai-service';
import type { SearchStrategy, AuthorCandidate } from '@/lib/types';
import type { Config } from '@/lib/utils/config';
import OpenAI from 'openai';

// Mock OpenAI module
jest.mock('openai');

describe('OpenAIService', () => {
  let mockOpenAIClient: jest.Mocked<OpenAI>;
  let mockConfig: Config['openai'];
  let service: OpenAIService;

  beforeEach(() => {
    // Create mock OpenAI client
    mockOpenAIClient = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
      embeddings: {
        create: jest.fn(),
      },
    } as any;

    // Mock config
    mockConfig = {
      apiKey: 'test-api-key',
      models: {
        chat: 'gpt-4o-mini',
        embedding: 'text-embedding-3-small',
      },
      batchSize: 20,
      maxRetries: 3,
      timeoutMs: 30000,
    };

    // Create service instance with mocked client
    service = new OpenAIService(mockOpenAIClient, mockConfig);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // ============================================================================
  // generateSearchStrategies Tests
  // ============================================================================

  describe('generateSearchStrategies', () => {
    const mockJobDescription = 'Looking for a machine learning engineer with experience in NLP and transformers.';

    const mockStrategiesResponse: SearchStrategy[] = [
      {
        name: 'Core NLP',
        rationale: 'Direct match for NLP expertise',
        queries: ['abs:natural+language+processing', 'abs:NLP', 'abs:language+models'],
      },
      {
        name: 'Transformers',
        rationale: 'Transformer architecture expertise',
        queries: ['abs:transformer+networks', 'abs:attention+mechanism'],
      },
    ];

    it('should generate strategies successfully', async () => {
      // Mock successful API response
      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ strategies: mockStrategiesResponse }),
            },
          },
        ],
      } as any);

      const result = await service.generateSearchStrategies(mockJobDescription);

      expect(result).toEqual(mockStrategiesResponse);
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining(mockJobDescription),
            }),
          ]),
        })
      );
    });

    it('should throw error for empty job description', async () => {
      await expect(service.generateSearchStrategies('')).rejects.toThrow(
        'Job description cannot be empty'
      );

      expect(mockOpenAIClient.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should handle OpenAI API timeout', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';

      mockOpenAIClient.chat.completions.create.mockRejectedValue(timeoutError);

      await expect(service.generateSearchStrategies(mockJobDescription)).rejects.toThrow(
        'Request timeout'
      );
    }, 10000); // Increase timeout for this test

    it('should retry on rate limit (429) and succeed', async () => {
      const rateLimitError: any = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      // Fail twice, succeed on third attempt
      mockOpenAIClient.chat.completions.create
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({ strategies: mockStrategiesResponse }),
              },
            },
          ],
        } as any);

      const result = await service.generateSearchStrategies(mockJobDescription);

      expect(result).toEqual(mockStrategiesResponse);
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(3);
    });

    it('should handle invalid JSON response', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'This is not valid JSON',
            },
          },
        ],
      } as any);

      await expect(service.generateSearchStrategies(mockJobDescription)).rejects.toThrow(
        'Failed to parse search strategies from response'
      );
    });

    it('should return empty array if strategies missing in response', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ someOtherField: 'value' }),
            },
          },
        ],
      } as any);

      const result = await service.generateSearchStrategies(mockJobDescription);

      expect(result).toEqual([]);
    });

    it('should fail after max retries exhausted', async () => {
      const rateLimitError: any = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      mockOpenAIClient.chat.completions.create.mockRejectedValue(rateLimitError);

      await expect(service.generateSearchStrategies(mockJobDescription)).rejects.toThrow(
        'Rate limit exceeded'
      );

      // Should try initial + 3 retries = 4 times
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(4);
    }, 20000); // Increase timeout for retry tests

    it('should not retry on 401 (invalid API key)', async () => {
      const authError: any = new Error('Invalid API key');
      authError.status = 401;

      mockOpenAIClient.chat.completions.create.mockRejectedValue(authError);

      await expect(service.generateSearchStrategies(mockJobDescription)).rejects.toThrow(
        'Invalid API key'
      );

      // Should only try once (no retries for auth errors)
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // createEmbedding Tests
  // ============================================================================

  describe('createEmbedding', () => {
    const mockText = 'This is a test text for embedding';
    const mockEmbedding = Array(1536).fill(0).map((_, i) => i / 1536);

    it('should create embedding successfully', async () => {
      mockOpenAIClient.embeddings.create.mockResolvedValueOnce({
        data: [{ embedding: mockEmbedding }],
      } as any);

      const result = await service.createEmbedding(mockText);

      expect(result).toEqual(mockEmbedding);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(1);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: mockText,
      });
    });

    it('should throw error for empty text', async () => {
      await expect(service.createEmbedding('')).rejects.toThrow('Text cannot be empty');

      expect(mockOpenAIClient.embeddings.create).not.toHaveBeenCalled();
    });

    it('should handle OpenAI API error', async () => {
      const apiError = new Error('API error');
      mockOpenAIClient.embeddings.create.mockRejectedValue(apiError);

      await expect(service.createEmbedding(mockText)).rejects.toThrow('API error');
    });

    it('should retry on rate limit', async () => {
      const rateLimitError: any = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      mockOpenAIClient.embeddings.create
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding }],
        } as any);

      const result = await service.createEmbedding(mockText);

      expect(result).toEqual(mockEmbedding);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(2);
    });

    it('should throw error if no embedding in response', async () => {
      mockOpenAIClient.embeddings.create.mockResolvedValueOnce({
        data: [],
      } as any);

      await expect(service.createEmbedding(mockText)).rejects.toThrow(
        'No embedding returned in response'
      );
    });

    it('should fail after retry exhaustion', async () => {
      const serverError: any = new Error('Server error');
      serverError.status = 500;

      mockOpenAIClient.embeddings.create.mockRejectedValue(serverError);

      await expect(service.createEmbedding(mockText)).rejects.toThrow('Server error');

      // Initial + 3 retries
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(4);
    }, 20000); // Increase timeout for retry tests
  });

  // ============================================================================
  // createBatchEmbeddings Tests
  // ============================================================================

  describe('createBatchEmbeddings', () => {
    const mockTexts = [
      'First text',
      'Second text',
      'Third text',
    ];

    const mockEmbeddings = mockTexts.map((_, i) =>
      Array(1536).fill(0).map((_, j) => (i * 1536 + j) / 1536)
    );

    it('should create batch embeddings successfully (single batch)', async () => {
      mockOpenAIClient.embeddings.create.mockResolvedValueOnce({
        data: mockEmbeddings.map((embedding) => ({ embedding })),
      } as any);

      const result = await service.createBatchEmbeddings(mockTexts);

      expect(result).toEqual(mockEmbeddings);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(1);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: mockTexts,
      });
    });

    it('should create batch embeddings successfully (multiple batches)', async () => {
      // Override batch size for this test
      const smallBatchService = new OpenAIService(mockOpenAIClient, {
        ...mockConfig,
        batchSize: 2,
      });

      const texts = ['Text 1', 'Text 2', 'Text 3', 'Text 4', 'Text 5'];
      const embeddings = texts.map((_, i) =>
        Array(1536).fill(0).map((_, j) => (i * 1536 + j) / 1536)
      );

      // Mock three batch calls
      mockOpenAIClient.embeddings.create
        .mockResolvedValueOnce({
          data: [{ embedding: embeddings[0] }, { embedding: embeddings[1] }],
        } as any)
        .mockResolvedValueOnce({
          data: [{ embedding: embeddings[2] }, { embedding: embeddings[3] }],
        } as any)
        .mockResolvedValueOnce({
          data: [{ embedding: embeddings[4] }],
        } as any);

      const result = await smallBatchService.createBatchEmbeddings(texts);

      expect(result).toEqual(embeddings);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(3);
    });

    it('should throw error for empty array', async () => {
      await expect(service.createBatchEmbeddings([])).rejects.toThrow(
        'Texts array cannot be empty'
      );

      expect(mockOpenAIClient.embeddings.create).not.toHaveBeenCalled();
    });

    it('should retry failed batch', async () => {
      const rateLimitError: any = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      mockOpenAIClient.embeddings.create
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          data: mockEmbeddings.map((embedding) => ({ embedding })),
        } as any);

      const result = await service.createBatchEmbeddings(mockTexts);

      expect(result).toEqual(mockEmbeddings);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(2);
    });

    it('should throw error after all retries exhausted', async () => {
      const serverError: any = new Error('Server error');
      serverError.status = 503;

      mockOpenAIClient.embeddings.create.mockRejectedValue(serverError);

      await expect(service.createBatchEmbeddings(mockTexts)).rejects.toThrow('Server error');

      // Initial + 3 retries
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(4);
    }, 20000); // Increase timeout for retry tests

    it('should respect batch size from config', async () => {
      const texts = Array(25).fill('').map((_, i) => `Text ${i}`);
      const embeddings = texts.map((_, i) =>
        Array(1536).fill(0).map((_, j) => (i * 1536 + j) / 1536)
      );

      // With batch size of 20, should make 2 calls (20 + 5)
      mockOpenAIClient.embeddings.create
        .mockResolvedValueOnce({
          data: embeddings.slice(0, 20).map((embedding) => ({ embedding })),
        } as any)
        .mockResolvedValueOnce({
          data: embeddings.slice(20).map((embedding) => ({ embedding })),
        } as any);

      const result = await service.createBatchEmbeddings(texts);

      expect(result).toEqual(embeddings);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(2);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenNthCalledWith(1, {
        model: 'text-embedding-3-small',
        input: texts.slice(0, 20),
      });
      expect(mockOpenAIClient.embeddings.create).toHaveBeenNthCalledWith(2, {
        model: 'text-embedding-3-small',
        input: texts.slice(20),
      });
    });
  });

  // ============================================================================
  // evaluateResearcherFit Tests
  // ============================================================================

  describe('evaluateResearcherFit', () => {
    const mockCandidate: AuthorCandidate = {
      name: 'Dr. Jane Smith',
      paper: {
        id: 'arxiv:1234.5678',
        title: 'Advanced Transformer Architectures for NLP',
        authors: ['Dr. Jane Smith', 'Dr. John Doe'],
        summary: 'This paper presents novel transformer architectures that improve performance on various NLP tasks including question answering and sentiment analysis.',
        published: '2024-01-15',
        link: 'https://arxiv.org/abs/1234.5678',
      },
      similarityScore: 0.85,
      location: 'USA',
      affiliation: 'Stanford University',
    };

    const mockJobDescription = 'Looking for NLP researcher with transformer experience';

    const mockStrategies: SearchStrategy[] = [
      {
        name: 'Core NLP',
        rationale: 'Direct NLP match',
        queries: ['abs:NLP'],
      },
    ];

    it('should evaluate researcher fit successfully', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 85,
                reason: 'Strong match with transformer and NLP expertise',
              }),
            },
          },
        ],
      } as any);

      const result = await service.evaluateResearcherFit(
        mockCandidate,
        mockJobDescription,
        mockStrategies
      );

      expect(result).toEqual({
        score: 85,
        reason: 'Strong match with transformer and NLP expertise',
      });
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining(mockCandidate.name),
            }),
          ]),
        })
      );
    });

    it('should return default values on API error', async () => {
      const apiError = new Error('API error');
      mockOpenAIClient.chat.completions.create.mockRejectedValue(apiError);

      const result = await service.evaluateResearcherFit(
        mockCandidate,
        mockJobDescription,
        mockStrategies
      );

      expect(result).toEqual({
        score: 0,
        reason: 'Error generating fit reason',
      });
    });

    it('should return default values on invalid JSON', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'Invalid JSON response',
            },
          },
        ],
      } as any);

      const result = await service.evaluateResearcherFit(
        mockCandidate,
        mockJobDescription,
        mockStrategies
      );

      expect(result).toEqual({
        score: 0,
        reason: 'Error generating fit reason',
      });
    });

    it('should return default values if score/reason missing', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ someOtherField: 'value' }),
            },
          },
        ],
      } as any);

      const result = await service.evaluateResearcherFit(
        mockCandidate,
        mockJobDescription,
        mockStrategies
      );

      expect(result).toEqual({
        score: 0,
        reason: 'No reason provided',
      });
    });

    it('should retry on transient failures', async () => {
      const serverError: any = new Error('Server error');
      serverError.status = 500;

      mockOpenAIClient.chat.completions.create
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  score: 75,
                  reason: 'Good match',
                }),
              },
            },
          ],
        } as any);

      const result = await service.evaluateResearcherFit(
        mockCandidate,
        mockJobDescription,
        mockStrategies
      );

      expect(result).toEqual({
        score: 75,
        reason: 'Good match',
      });
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should truncate abstract to preview length', async () => {
      const longSummary = 'A'.repeat(1000);
      const candidateWithLongSummary = {
        ...mockCandidate,
        paper: {
          ...mockCandidate.paper,
          summary: longSummary,
        },
      };

      // Create service with custom abstract preview length
      const customService = new OpenAIService(mockOpenAIClient, {
        ...mockConfig,
        abstractPreviewLength: 100,
      } as any);

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ score: 80, reason: 'Good' }),
            },
          },
        ],
      } as any);

      await customService.evaluateResearcherFit(
        candidateWithLongSummary,
        mockJobDescription,
        mockStrategies
      );

      const callArgs = mockOpenAIClient.chat.completions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user')?.content;

      // Abstract should be truncated to 100 characters
      expect(userMessage).toContain('A'.repeat(100));
      expect(userMessage).not.toContain('A'.repeat(101));
    });
  });
});
