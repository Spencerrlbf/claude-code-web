/**
 * OpenAI Service
 *
 * Encapsulates all OpenAI API interactions with proper error handling,
 * retry logic, and dependency injection for testability.
 *
 * @module lib/services/openai-service
 */

import OpenAI from 'openai';
import type { SearchStrategy, AuthorCandidate } from '@/lib/types';
import type { Config } from '@/lib/utils/config';
import { config } from '@/lib/utils/config';

/**
 * Interface for OpenAI Service
 * Defines all public methods for interacting with OpenAI API
 */
export interface OpenAIServiceInterface {
  /**
   * Generate intelligent search strategies from a job description
   * @param jobDescription - The job description text
   * @returns Array of search strategies with queries
   */
  generateSearchStrategies(jobDescription: string): Promise<SearchStrategy[]>;

  /**
   * Create a single embedding for text
   * @param text - The text to embed
   * @returns Embedding vector
   */
  createEmbedding(text: string): Promise<number[]>;

  /**
   * Create embeddings for multiple texts in batches
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   */
  createBatchEmbeddings(texts: string[]): Promise<number[][]>;

  /**
   * Evaluate how well a researcher fits a job description
   * @param candidate - The author candidate to evaluate
   * @param jobDescription - The job description
   * @param strategies - The search strategies used
   * @returns Evaluation score and reason
   */
  evaluateResearcherFit(
    candidate: AuthorCandidate,
    jobDescription: string,
    strategies: SearchStrategy[]
  ): Promise<{ score: number; reason: string }>;
}

/**
 * OpenAI Service Implementation
 *
 * Handles all interactions with OpenAI API including:
 * - Search strategy generation
 * - Text embeddings (single and batch)
 * - Researcher fit evaluation
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Comprehensive error handling
 * - Dependency injection for testing
 * - Configurable via environment variables
 */
export class OpenAIService implements OpenAIServiceInterface {
  /**
   * Creates an OpenAI Service instance
   * @param client - OpenAI client instance (injected for testability)
   * @param config - OpenAI configuration
   */
  constructor(
    private readonly client: OpenAI,
    private readonly openaiConfig: Config['openai'] & { abstractPreviewLength?: number }
  ) {}

  /**
   * Generate search strategies from job description using AI
   */
  async generateSearchStrategies(jobDescription: string): Promise<SearchStrategy[]> {
    // Validate input
    if (!jobDescription || jobDescription.trim() === '') {
      throw new Error('Job description cannot be empty');
    }

    const systemPrompt = `You are an expert at identifying relevant research areas for academic/industry hiring.

Given a job description, suggest 3-5 different search strategies to find researchers with relevant expertise on arXiv.

For each strategy:
1. Identify a research area/domain (be specific)
2. Explain why it's relevant (what expertise it demonstrates)
3. Provide 2-3 arXiv search queries using the abs: field format

Consider multiple angles:
- CORE: Direct matches for skills explicitly mentioned
- ADJACENT: Related fields that demonstrate transferable expertise
- FOUNDATIONAL: Underlying techniques/methods required
- APPLICATIONS: Similar problem domains or use cases

Search query tips:
- Use + instead of spaces (e.g., "machine+learning")
- Be specific but not overly narrow
- Each query should be different enough to find diverse papers

Return JSON:
{
  "strategies": [
    {
      "name": "Core Deep Learning",
      "rationale": "Direct match for deep learning expertise mentioned in JD",
      "queries": ["abs:deep+learning", "abs:neural+networks", "abs:convolutional+networks"]
    },
    {
      "name": "Computer Vision Applications",
      "rationale": "Adjacent field showing practical ML application skills",
      "queries": ["abs:computer+vision", "abs:image+recognition", "abs:object+detection"]
    }
  ]
}`;

    try {
      const completion = await this.withRetry(async () => {
        return await this.client.chat.completions.create({
          model: this.openaiConfig.models.chat,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `Job Description:\n\n${jobDescription}`,
            },
          ],
          response_format: { type: 'json_object' },
        });
      });

      const content = completion.choices[0].message.content || '{}';

      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        throw new Error('Failed to parse search strategies from response');
      }

      const strategies = result.strategies || [];

      console.log('Generated search strategies:', JSON.stringify(strategies, null, 2));

      return strategies;
    } catch (error) {
      console.error('Error generating search strategies:', error);
      throw error;
    }
  }

  /**
   * Create embedding for a single text
   */
  async createEmbedding(text: string): Promise<number[]> {
    // Validate input
    if (!text || text.trim() === '') {
      throw new Error('Text cannot be empty');
    }

    try {
      const response = await this.withRetry(async () => {
        return await this.client.embeddings.create({
          model: this.openaiConfig.models.embedding,
          input: text,
        });
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding returned in response');
      }

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error creating embedding:', error);
      throw error;
    }
  }

  /**
   * Create embeddings for multiple texts in batches
   */
  async createBatchEmbeddings(texts: string[]): Promise<number[][]> {
    // Validate input
    if (!texts || texts.length === 0) {
      throw new Error('Texts array cannot be empty');
    }

    console.log(`Creating embeddings for ${texts.length} texts...`);

    const allEmbeddings: number[][] = [];
    const batchSize = this.openaiConfig.batchSize;

    // Process in batches to avoid rate limits
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      try {
        const response = await this.withRetry(async () => {
          return await this.client.embeddings.create({
            model: this.openaiConfig.models.embedding,
            input: batch,
          });
        });

        // Extract embeddings in order
        const batchEmbeddings = response.data.map((item) => item.embedding);
        allEmbeddings.push(...batchEmbeddings);

        console.log(`Processed ${Math.min(i + batchSize, texts.length)}/${texts.length} texts`);
      } catch (error) {
        console.error(`Error creating embeddings for batch ${i / batchSize + 1}:`, error);
        throw error;
      }
    }

    return allEmbeddings;
  }

  /**
   * Evaluate how well a researcher fits the job description
   */
  async evaluateResearcherFit(
    candidate: AuthorCandidate,
    jobDescription: string,
    strategies: SearchStrategy[]
  ): Promise<{ score: number; reason: string }> {
    const targetAreas = strategies.map((s) => s.name).join(', ');

    // Get abstract preview length from config or use default
    const abstractPreviewLength = this.openaiConfig.abstractPreviewLength || 600;

    const systemPrompt = `You are an expert technical recruiter evaluating researchers for academic/industry positions.

Given a job description and a research paper, you must:

1. Carefully analyze how well the researcher's work matches the job requirements
2. Provide a realistic relevance score (0-100) where:
   - 90-100: Perfect match, directly addresses multiple key requirements
   - 70-89: Strong match, covers most requirements with relevant experience
   - 50-69: Moderate match, some relevant experience but missing key areas
   - 30-49: Weak match, tangentially related work
   - 0-29: Poor match, different field or minimal overlap

3. Write a concise 2-3 sentence explanation focusing on:
   - Specific technical skills/methods that match the role
   - Relevant research contributions
   - Any gaps or limitations

Be HONEST and CRITICAL. Don't inflate scores. Only give high scores for genuinely strong matches.

Return as JSON: {"score": 75, "reason": "This researcher has extensive experience with X and Y which directly aligns with the position. Their work on Z demonstrates practical application. However, they lack exposure to W mentioned in the job description."}`;

    const userPrompt = `Job Description:
${jobDescription}

Target Research Areas: ${targetAreas}

Research Paper:
Title: ${candidate.paper.title}
Authors: ${candidate.paper.authors.join(', ')}
Abstract: ${candidate.paper.summary.slice(0, abstractPreviewLength)}

Evaluate ${candidate.name} for this position.`;

    try {
      const completion = await this.withRetry(async () => {
        return await this.client.chat.completions.create({
          model: this.openaiConfig.models.chat,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          response_format: { type: 'json_object' },
        });
      });

      const content = completion.choices[0].message.content || '{}';

      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error(`Error parsing fit evaluation for ${candidate.name}:`, parseError);
        return {
          score: 0,
          reason: 'Error generating fit reason',
        };
      }

      return {
        score: result.score || 0,
        reason: result.reason || 'No reason provided',
      };
    } catch (error) {
      console.error(`Error evaluating fit for ${candidate.name}:`, error);
      // Return default values instead of throwing
      return {
        score: 0,
        reason: 'Error generating fit reason',
      };
    }
  }

  /**
   * Execute an async operation with retry logic
   * Implements exponential backoff for transient errors
   *
   * @param operation - The async operation to execute
   * @param maxRetries - Maximum number of retry attempts (default from config)
   * @returns Result of the operation
   * @throws Error if all retries exhausted or non-retryable error
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.openaiConfig.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || attempt === maxRetries) {
          // Don't retry - either non-retryable error or max retries reached
          throw error;
        }

        // Calculate backoff delay: 1s, 2s, 4s, 8s
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);

        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${backoffMs}ms for error: ${error.message}`
        );

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Unknown error during retry');
  }

  /**
   * Determine if an error is retryable
   * @param error - The error to check
   * @returns true if error should be retried
   */
  private isRetryableError(error: any): boolean {
    // Retry on rate limit errors
    if (error.status === 429) {
      return true;
    }

    // Retry on server errors (5xx)
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Retry on timeout errors
    if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // Don't retry on client errors (4xx except 429)
    if (error.status >= 400 && error.status < 500) {
      return false;
    }

    // For unknown errors, don't retry
    return false;
  }
}

/**
 * Factory function to create an OpenAI Service instance
 * Uses default configuration unless overridden
 *
 * @param apiKey - Optional API key override
 * @returns Configured OpenAI Service instance
 */
export function createOpenAIService(apiKey?: string): OpenAIService {
  const openaiConfig = apiKey ? { ...config.openai, apiKey } : config.openai;

  const client = new OpenAI({
    apiKey: openaiConfig.apiKey,
  });

  // Include researchers config for abstract preview length
  const serviceConfig = {
    ...openaiConfig,
    abstractPreviewLength: config.researchers.abstractPreviewLength,
  };

  return new OpenAIService(client, serviceConfig);
}
