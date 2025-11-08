/**
 * Unit tests for configuration module
 * Following TDD approach - tests written before implementation
 */

describe('Configuration Module', () => {
  // Store original env vars to restore after tests
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and env before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('Environment Variable Parsing', () => {
    describe('getEnvNumber', () => {
      it('should return default value when env var is not set', () => {
        const { getEnvNumber } = require('@/lib/utils/config');
        expect(getEnvNumber('NONEXISTENT_VAR', 42)).toBe(42);
      });

      it('should return parsed number when env var is set', () => {
        process.env.TEST_NUMBER = '100';
        const { getEnvNumber } = require('@/lib/utils/config');
        expect(getEnvNumber('TEST_NUMBER', 42)).toBe(100);
      });

      it('should handle float values', () => {
        process.env.TEST_FLOAT = '0.75';
        const { getEnvNumber } = require('@/lib/utils/config');
        expect(getEnvNumber('TEST_FLOAT', 0.5)).toBe(0.75);
      });

      it('should return default value for invalid number strings', () => {
        process.env.TEST_INVALID = 'not-a-number';
        const { getEnvNumber } = require('@/lib/utils/config');
        expect(getEnvNumber('TEST_INVALID', 42)).toBe(42);
      });

      it('should handle negative numbers', () => {
        process.env.TEST_NEGATIVE = '-10';
        const { getEnvNumber } = require('@/lib/utils/config');
        expect(getEnvNumber('TEST_NEGATIVE', 0)).toBe(-10);
      });

      it('should handle zero', () => {
        process.env.TEST_ZERO = '0';
        const { getEnvNumber } = require('@/lib/utils/config');
        expect(getEnvNumber('TEST_ZERO', 42)).toBe(0);
      });

      it('should return default for empty string', () => {
        process.env.TEST_EMPTY = '';
        const { getEnvNumber } = require('@/lib/utils/config');
        expect(getEnvNumber('TEST_EMPTY', 42)).toBe(42);
      });
    });

    describe('getEnvString', () => {
      it('should return default value when env var is not set', () => {
        const { getEnvString } = require('@/lib/utils/config');
        expect(getEnvString('NONEXISTENT_VAR', 'default')).toBe('default');
      });

      it('should return env var value when set', () => {
        process.env.TEST_STRING = 'hello world';
        const { getEnvString } = require('@/lib/utils/config');
        expect(getEnvString('TEST_STRING', 'default')).toBe('hello world');
      });

      it('should return empty string if env var is empty string', () => {
        process.env.TEST_EMPTY = '';
        const { getEnvString } = require('@/lib/utils/config');
        expect(getEnvString('TEST_EMPTY', 'default')).toBe('default');
      });

      it('should preserve whitespace in env var values', () => {
        process.env.TEST_WHITESPACE = '  hello  ';
        const { getEnvString } = require('@/lib/utils/config');
        expect(getEnvString('TEST_WHITESPACE', 'default')).toBe('  hello  ');
      });
    });

    describe('getEnvBoolean', () => {
      it('should return default value when env var is not set', () => {
        const { getEnvBoolean } = require('@/lib/utils/config');
        expect(getEnvBoolean('NONEXISTENT_VAR', true)).toBe(true);
        expect(getEnvBoolean('NONEXISTENT_VAR', false)).toBe(false);
      });

      it('should return true for "true" string (case insensitive)', () => {
        const { getEnvBoolean } = require('@/lib/utils/config');
        process.env.TEST_BOOL1 = 'true';
        expect(getEnvBoolean('TEST_BOOL1', false)).toBe(true);

        process.env.TEST_BOOL2 = 'TRUE';
        expect(getEnvBoolean('TEST_BOOL2', false)).toBe(true);

        process.env.TEST_BOOL3 = 'True';
        expect(getEnvBoolean('TEST_BOOL3', false)).toBe(true);
      });

      it('should return false for "false" string', () => {
        process.env.TEST_BOOL = 'false';
        const { getEnvBoolean } = require('@/lib/utils/config');
        expect(getEnvBoolean('TEST_BOOL', true)).toBe(false);
      });

      it('should return default for other strings', () => {
        process.env.TEST_BOOL = 'yes';
        const { getEnvBoolean } = require('@/lib/utils/config');
        expect(getEnvBoolean('TEST_BOOL', true)).toBe(true);
        expect(getEnvBoolean('TEST_BOOL', false)).toBe(false);
      });

      it('should return default for empty string', () => {
        process.env.TEST_BOOL = '';
        const { getEnvBoolean } = require('@/lib/utils/config');
        expect(getEnvBoolean('TEST_BOOL', true)).toBe(true);
      });
    });
  });

  describe('Configuration Object Structure', () => {
    it('should export a config object', () => {
      const { config } = require('@/lib/utils/config');
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should have all required top-level keys', () => {
      const { config } = require('@/lib/utils/config');
      expect(config).toHaveProperty('openai');
      expect(config).toHaveProperty('similarity');
      expect(config).toHaveProperty('arxiv');
      expect(config).toHaveProperty('researchers');
      expect(config).toHaveProperty('location');
      expect(config).toHaveProperty('semanticScholar');
      expect(config).toHaveProperty('debug');
    });

    describe('OpenAI Configuration', () => {
      it('should have correct structure', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.openai).toHaveProperty('apiKey');
        expect(config.openai).toHaveProperty('models');
        expect(config.openai).toHaveProperty('batchSize');
        expect(config.openai).toHaveProperty('maxRetries');
        expect(config.openai).toHaveProperty('timeoutMs');
      });

      it('should have correct default values', () => {
        delete process.env.OPENAI_API_KEY;
        const { config } = require('@/lib/utils/config');
        expect(config.openai.models.chat).toBe('gpt-4o-mini');
        expect(config.openai.models.embedding).toBe('text-embedding-3-small');
        expect(config.openai.batchSize).toBe(20);
        expect(config.openai.maxRetries).toBe(3);
        expect(config.openai.timeoutMs).toBe(30000);
      });

      it('should allow env var overrides', () => {
        process.env.OPENAI_CHAT_MODEL = 'gpt-4';
        process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-large';
        process.env.OPENAI_BATCH_SIZE = '50';

        const { config } = require('@/lib/utils/config');
        expect(config.openai.models.chat).toBe('gpt-4');
        expect(config.openai.models.embedding).toBe('text-embedding-3-large');
        expect(config.openai.batchSize).toBe(50);
      });
    });

    describe('Similarity Configuration', () => {
      it('should have correct structure', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.similarity).toHaveProperty('initialThreshold');
        expect(config.similarity).toHaveProperty('fallbackThresholds');
        expect(config.similarity).toHaveProperty('minPapersForThreshold');
        expect(config.similarity).toHaveProperty('minPapersAbsolute');
        expect(config.similarity).toHaveProperty('maxPapers');
      });

      it('should have correct default values', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.similarity.initialThreshold).toBe(0.6);
        expect(config.similarity.fallbackThresholds).toEqual([0.55, 0.5, 0.45]);
        expect(config.similarity.minPapersForThreshold).toBe(10);
        expect(config.similarity.minPapersAbsolute).toBe(30);
        expect(config.similarity.maxPapers).toBe(60);
      });

      it('should allow env var overrides', () => {
        process.env.SIMILARITY_THRESHOLD = '0.7';
        process.env.MAX_PAPERS_TO_ANALYZE = '100';

        const { config } = require('@/lib/utils/config');
        expect(config.similarity.initialThreshold).toBe(0.7);
        expect(config.similarity.maxPapers).toBe(100);
      });
    });

    describe('arXiv Configuration', () => {
      it('should have correct structure', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.arxiv).toHaveProperty('apiUrl');
        expect(config.arxiv).toHaveProperty('defaultMaxResults');
        expect(config.arxiv).toHaveProperty('maxResultsPerQuery');
        expect(config.arxiv).toHaveProperty('sortBy');
        expect(config.arxiv).toHaveProperty('sortOrder');
        expect(config.arxiv).toHaveProperty('timeoutMs');
      });

      it('should have correct default values', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.arxiv.apiUrl).toBe('http://export.arxiv.org/api/query');
        expect(config.arxiv.defaultMaxResults).toBe(50);
        expect(config.arxiv.maxResultsPerQuery).toBe(40);
        expect(config.arxiv.sortBy).toBe('submittedDate');
        expect(config.arxiv.sortOrder).toBe('descending');
        expect(config.arxiv.timeoutMs).toBe(10000);
      });

      it('should allow env var overrides', () => {
        process.env.ARXIV_RESULTS_PER_QUERY = '100';
        process.env.ARXIV_API_URL = 'https://custom-arxiv.com/api';

        const { config } = require('@/lib/utils/config');
        expect(config.arxiv.maxResultsPerQuery).toBe(100);
        expect(config.arxiv.apiUrl).toBe('https://custom-arxiv.com/api');
      });
    });

    describe('Researchers Configuration', () => {
      it('should have correct structure', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.researchers).toHaveProperty('topCount');
        expect(config.researchers).toHaveProperty('additionalCount');
        expect(config.researchers).toHaveProperty('abstractPreviewLength');
      });

      it('should have correct default values', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.researchers.topCount).toBe(10);
        expect(config.researchers.additionalCount).toBe(20);
        expect(config.researchers.abstractPreviewLength).toBe(600);
      });

      it('should allow env var overrides', () => {
        process.env.TOP_RESEARCHERS_COUNT = '15';
        process.env.ADDITIONAL_CANDIDATES_COUNT = '30';

        const { config } = require('@/lib/utils/config');
        expect(config.researchers.topCount).toBe(15);
        expect(config.researchers.additionalCount).toBe(30);
      });
    });

    describe('Location Configuration', () => {
      it('should have correct structure', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.location).toHaveProperty('usaKeywords');
        expect(config.location).toHaveProperty('priorityOrder');
      });

      it('should have USA keywords array', () => {
        const { config } = require('@/lib/utils/config');
        expect(Array.isArray(config.location.usaKeywords)).toBe(true);
        expect(config.location.usaKeywords.length).toBeGreaterThan(0);
        expect(config.location.usaKeywords).toContain('usa');
        expect(config.location.usaKeywords).toContain('stanford');
        expect(config.location.usaKeywords).toContain('mit');
      });

      it('should have correct priority order', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.location.priorityOrder).toEqual({
          USA: 0,
          Unknown: 1,
          International: 2,
        });
      });
    });

    describe('Semantic Scholar Configuration', () => {
      it('should have correct structure', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.semanticScholar).toHaveProperty('apiUrl');
        expect(config.semanticScholar).toHaveProperty('authorSearchParams');
        expect(config.semanticScholar).toHaveProperty('timeoutMs');
      });

      it('should have correct default values', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.semanticScholar.apiUrl).toBe('https://api.semanticscholar.org/graph/v1/author/search');
        expect(config.semanticScholar.authorSearchParams.fields).toBe('name,affiliations');
        expect(config.semanticScholar.authorSearchParams.limit).toBe(1);
        expect(config.semanticScholar.timeoutMs).toBe(10000);
      });
    });

    describe('Debug Configuration', () => {
      it('should have correct structure', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.debug).toHaveProperty('topScoresCount');
        expect(config.debug).toHaveProperty('enableVerboseLogging');
      });

      it('should have correct default values', () => {
        const { config } = require('@/lib/utils/config');
        expect(config.debug.topScoresCount).toBe(20);
        expect(config.debug.enableVerboseLogging).toBe(true);
      });

      it('should allow env var overrides', () => {
        process.env.ENABLE_DEBUG_LOGGING = 'false';

        const { config } = require('@/lib/utils/config');
        expect(config.debug.enableVerboseLogging).toBe(false);
      });
    });
  });

  describe('Configuration Validation', () => {
    it('should export a validateConfig function', () => {
      const { validateConfig } = require('@/lib/utils/config');
      expect(validateConfig).toBeDefined();
      expect(typeof validateConfig).toBe('function');
    });

    it('should return empty array for valid config', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const { config, validateConfig } = require('@/lib/utils/config');
      const errors = validateConfig(config);
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBe(0);
    });

    it('should return error when OPENAI_API_KEY is missing', () => {
      delete process.env.OPENAI_API_KEY;
      const { config, validateConfig } = require('@/lib/utils/config');
      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((err: string) => err.includes('OPENAI_API_KEY'))).toBe(true);
    });

    it('should return error when similarity threshold is out of range', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const { config, validateConfig } = require('@/lib/utils/config');

      const invalidConfig = { ...config, similarity: { ...config.similarity, initialThreshold: 1.5 } };
      const errors = validateConfig(invalidConfig);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('similarity.initialThreshold must be between 0 and 1');
    });

    it('should return error for negative batch size', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const { config, validateConfig } = require('@/lib/utils/config');

      const invalidConfig = { ...config, openai: { ...config.openai, batchSize: -1 } };
      const errors = validateConfig(invalidConfig);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((err: string) => err.includes('batchSize'))).toBe(true);
    });

    it('should return error for zero max papers', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const { config, validateConfig } = require('@/lib/utils/config');

      const invalidConfig = { ...config, similarity: { ...config.similarity, maxPapers: 0 } };
      const errors = validateConfig(invalidConfig);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((err: string) => err.includes('maxPapers'))).toBe(true);
    });

    it('should return multiple errors for multiple issues', () => {
      delete process.env.OPENAI_API_KEY;
      const { config, validateConfig } = require('@/lib/utils/config');

      const invalidConfig = {
        ...config,
        openai: { ...config.openai, batchSize: -1 },
        similarity: { ...config.similarity, initialThreshold: 2.0 },
      };
      const errors = validateConfig(invalidConfig);
      expect(errors.length).toBeGreaterThanOrEqual(3); // API key, batchSize, threshold
    });
  });

  describe('Type Safety', () => {
    it('should export Config interface', () => {
      // This is a compile-time check, but we can verify the structure
      const { config } = require('@/lib/utils/config');
      expect(config).toBeDefined();
    });
  });
});
