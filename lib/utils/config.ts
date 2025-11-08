/**
 * Centralized Configuration Module
 *
 * This module extracts all magic numbers and hardcoded values from the codebase
 * into a single, type-safe, configurable location. All values can be overridden
 * via environment variables.
 *
 * @module lib/utils/config
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * OpenAI API configuration
 */
export interface OpenAIConfig {
  /** OpenAI API key (required) */
  apiKey: string;
  /** Model configurations */
  models: {
    /** Chat completion model for strategies and evaluations */
    chat: string;
    /** Embedding model for papers and job descriptions */
    embedding: string;
  };
  /** Number of items to process in a single batch */
  batchSize: number;
  /** Maximum number of retry attempts for failed requests */
  maxRetries: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Similarity scoring and filtering configuration
 */
export interface SimilarityConfig {
  /** Initial similarity threshold (0-1) */
  initialThreshold: number;
  /** Fallback thresholds if initial threshold yields too few results */
  fallbackThresholds: number[];
  /** Minimum papers required before trying fallback thresholds */
  minPapersForThreshold: number;
  /** Absolute minimum papers to return (takes top N if needed) */
  minPapersAbsolute: number;
  /** Maximum papers to keep after filtering */
  maxPapers: number;
}

/**
 * arXiv API configuration
 */
export interface ArxivConfig {
  /** arXiv API base URL */
  apiUrl: string;
  /** Default max results (function parameter default) */
  defaultMaxResults: number;
  /** Actual max results used in searches */
  maxResultsPerQuery: number;
  /** Sort field for arXiv results */
  sortBy: string;
  /** Sort order for arXiv results */
  sortOrder: string;
  /** Request timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Researcher selection configuration
 */
export interface ResearchersConfig {
  /** Number of top researchers to select */
  topCount: number;
  /** Number of additional candidates to return */
  additionalCount: number;
  /** Character limit for abstract preview in AI evaluation */
  abstractPreviewLength: number;
}

/**
 * Location detection configuration
 */
export interface LocationConfig {
  /** Keywords used to identify USA-based researchers */
  usaKeywords: string[];
  /** Sort priority for locations (lower = higher priority) */
  priorityOrder: Record<string, number>;
}

/**
 * Semantic Scholar API configuration
 */
export interface SemanticScholarConfig {
  /** Semantic Scholar API base URL */
  apiUrl: string;
  /** Default search parameters for author lookup */
  authorSearchParams: {
    /** Fields to retrieve */
    fields: string;
    /** Number of results to return */
    limit: number;
  };
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Maximum number of retry attempts for failed requests */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelay: number;
  /** Rate limiting configuration */
  rateLimit: {
    /** Delay between requests in milliseconds */
    delayBetweenRequests: number;
  };
}

/**
 * Debug and logging configuration
 */
export interface DebugConfig {
  /** Number of top scores to show in debug output */
  topScoresCount: number;
  /** Enable verbose debug logging */
  enableVerboseLogging: boolean;
}

/**
 * Complete configuration interface
 */
export interface Config {
  openai: OpenAIConfig;
  similarity: SimilarityConfig;
  arxiv: ArxivConfig;
  researchers: ResearchersConfig;
  location: LocationConfig;
  semanticScholar: SemanticScholarConfig;
  debug: DebugConfig;
}

// ============================================================================
// Environment Variable Helpers
// ============================================================================

/**
 * Get a number from environment variable with fallback to default
 * @param key - Environment variable name
 * @param defaultValue - Default value if env var not set or invalid
 * @returns Parsed number or default value
 */
export function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;

  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    console.warn(`Invalid number for ${key}: "${value}", using default: ${defaultValue}`);
    return defaultValue;
  }

  return parsed;
}

/**
 * Get a string from environment variable with fallback to default
 * @param key - Environment variable name
 * @param defaultValue - Default value if env var not set
 * @returns Environment variable value or default
 */
export function getEnvString(key: string, defaultValue: string): string {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value;
}

/**
 * Get a boolean from environment variable with fallback to default
 * @param key - Environment variable name
 * @param defaultValue - Default value if env var not set
 * @returns true if value is "true" (case insensitive), otherwise default
 */
export function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;

  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  return defaultValue;
}

// ============================================================================
// USA Keywords for Location Detection
// ============================================================================

/**
 * Keywords used to identify USA-based researchers from affiliation text.
 * Includes universities, companies, cities, and country identifiers.
 */
const USA_KEYWORDS = [
  // Country identifiers
  'usa', 'united states', 'u.s.',

  // Top research universities
  'stanford', 'mit', 'berkeley', 'harvard',
  'carnegie mellon', 'princeton', 'yale', 'cornell', 'caltech', 'chicago',
  'columbia', 'michigan', 'washington',

  // Major tech companies
  'google', 'microsoft', 'meta', 'openai', 'anthropic', 'deepmind',

  // Major cities and states
  'california', 'new york', 'boston', 'seattle', 'san francisco', 'cambridge',
  'texas', 'georgia', 'illinois',
];

// ============================================================================
// Configuration Object
// ============================================================================

/**
 * Centralized configuration object.
 * All values can be overridden via environment variables.
 */
export const config: Config = {
  // OpenAI API Configuration
  openai: {
    apiKey: getEnvString('OPENAI_API_KEY', ''),
    models: {
      chat: getEnvString('OPENAI_CHAT_MODEL', 'gpt-4o-mini'),
      embedding: getEnvString('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
    },
    batchSize: getEnvNumber('OPENAI_BATCH_SIZE', 20),
    maxRetries: getEnvNumber('OPENAI_MAX_RETRIES', 3),
    timeoutMs: getEnvNumber('OPENAI_TIMEOUT_MS', 30000),
  },

  // Similarity Scoring Configuration
  similarity: {
    initialThreshold: getEnvNumber('SIMILARITY_THRESHOLD', 0.6),
    fallbackThresholds: [0.55, 0.5, 0.45], // Not configurable via env
    minPapersForThreshold: getEnvNumber('MIN_PAPERS_THRESHOLD', 10),
    minPapersAbsolute: getEnvNumber('MIN_PAPERS_ABSOLUTE', 30),
    maxPapers: getEnvNumber('MAX_PAPERS_TO_ANALYZE', 60),
  },

  // arXiv API Configuration
  arxiv: {
    apiUrl: getEnvString('ARXIV_API_URL', 'http://export.arxiv.org/api/query'),
    defaultMaxResults: getEnvNumber('ARXIV_DEFAULT_MAX_RESULTS', 50),
    maxResultsPerQuery: getEnvNumber('ARXIV_RESULTS_PER_QUERY', 40),
    sortBy: getEnvString('ARXIV_SORT_BY', 'submittedDate'),
    sortOrder: getEnvString('ARXIV_SORT_ORDER', 'descending'),
    timeoutMs: getEnvNumber('ARXIV_TIMEOUT_MS', 10000),
  },

  // Researcher Selection Configuration
  researchers: {
    topCount: getEnvNumber('TOP_RESEARCHERS_COUNT', 10),
    additionalCount: getEnvNumber('ADDITIONAL_CANDIDATES_COUNT', 20),
    abstractPreviewLength: getEnvNumber('ABSTRACT_PREVIEW_LENGTH', 600),
  },

  // Location Detection Configuration
  location: {
    usaKeywords: USA_KEYWORDS,
    priorityOrder: {
      USA: 0,
      Unknown: 1,
      International: 2,
    },
  },

  // Semantic Scholar API Configuration
  semanticScholar: {
    apiUrl: getEnvString(
      'SEMANTIC_SCHOLAR_API_URL',
      'https://api.semanticscholar.org/graph/v1/author/search'
    ),
    authorSearchParams: {
      fields: getEnvString('SEMANTIC_SCHOLAR_FIELDS', 'name,affiliations'),
      limit: getEnvNumber('SEMANTIC_SCHOLAR_LIMIT', 1),
    },
    timeoutMs: getEnvNumber('SEMANTIC_SCHOLAR_TIMEOUT_MS', 10000),
    maxRetries: getEnvNumber('SEMANTIC_SCHOLAR_MAX_RETRIES', 2),
    retryDelay: getEnvNumber('SEMANTIC_SCHOLAR_RETRY_DELAY', 1000),
    rateLimit: {
      delayBetweenRequests: getEnvNumber('SEMANTIC_SCHOLAR_RATE_LIMIT_DELAY', 100),
    },
  },

  // Debug Configuration
  debug: {
    topScoresCount: getEnvNumber('DEBUG_TOP_SCORES_COUNT', 20),
    enableVerboseLogging: getEnvBoolean('ENABLE_DEBUG_LOGGING', true),
  },
};

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Validates the configuration object and returns an array of error messages.
 * An empty array indicates valid configuration.
 *
 * @param cfg - Configuration object to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateConfig(cfg: Config): string[] {
  const errors: string[] = [];

  // Validate OpenAI configuration
  if (!cfg.openai.apiKey) {
    errors.push('OPENAI_API_KEY is required');
  }

  if (cfg.openai.batchSize <= 0) {
    errors.push('openai.batchSize must be greater than 0');
  }

  if (cfg.openai.maxRetries < 0) {
    errors.push('openai.maxRetries must be non-negative');
  }

  if (cfg.openai.timeoutMs <= 0) {
    errors.push('openai.timeoutMs must be greater than 0');
  }

  // Validate similarity configuration
  if (cfg.similarity.initialThreshold < 0 || cfg.similarity.initialThreshold > 1) {
    errors.push('similarity.initialThreshold must be between 0 and 1');
  }

  cfg.similarity.fallbackThresholds.forEach((threshold, idx) => {
    if (threshold < 0 || threshold > 1) {
      errors.push(`similarity.fallbackThresholds[${idx}] must be between 0 and 1`);
    }
  });

  if (cfg.similarity.minPapersForThreshold < 0) {
    errors.push('similarity.minPapersForThreshold must be non-negative');
  }

  if (cfg.similarity.minPapersAbsolute <= 0) {
    errors.push('similarity.minPapersAbsolute must be greater than 0');
  }

  if (cfg.similarity.maxPapers <= 0) {
    errors.push('similarity.maxPapers must be greater than 0');
  }

  // Validate arXiv configuration
  if (!cfg.arxiv.apiUrl) {
    errors.push('arxiv.apiUrl is required');
  }

  if (cfg.arxiv.defaultMaxResults <= 0) {
    errors.push('arxiv.defaultMaxResults must be greater than 0');
  }

  if (cfg.arxiv.maxResultsPerQuery <= 0) {
    errors.push('arxiv.maxResultsPerQuery must be greater than 0');
  }

  if (cfg.arxiv.timeoutMs <= 0) {
    errors.push('arxiv.timeoutMs must be greater than 0');
  }

  // Validate researchers configuration
  if (cfg.researchers.topCount <= 0) {
    errors.push('researchers.topCount must be greater than 0');
  }

  if (cfg.researchers.additionalCount < 0) {
    errors.push('researchers.additionalCount must be non-negative');
  }

  if (cfg.researchers.abstractPreviewLength <= 0) {
    errors.push('researchers.abstractPreviewLength must be greater than 0');
  }

  // Validate location configuration
  if (!Array.isArray(cfg.location.usaKeywords) || cfg.location.usaKeywords.length === 0) {
    errors.push('location.usaKeywords must be a non-empty array');
  }

  // Validate semantic scholar configuration
  if (!cfg.semanticScholar.apiUrl) {
    errors.push('semanticScholar.apiUrl is required');
  }

  if (cfg.semanticScholar.authorSearchParams.limit <= 0) {
    errors.push('semanticScholar.authorSearchParams.limit must be greater than 0');
  }

  if (cfg.semanticScholar.timeoutMs <= 0) {
    errors.push('semanticScholar.timeoutMs must be greater than 0');
  }

  if (cfg.semanticScholar.maxRetries < 0) {
    errors.push('semanticScholar.maxRetries must be non-negative');
  }

  if (cfg.semanticScholar.retryDelay < 0) {
    errors.push('semanticScholar.retryDelay must be non-negative');
  }

  if (cfg.semanticScholar.rateLimit.delayBetweenRequests < 0) {
    errors.push('semanticScholar.rateLimit.delayBetweenRequests must be non-negative');
  }

  // Validate debug configuration
  if (cfg.debug.topScoresCount <= 0) {
    errors.push('debug.topScoresCount must be greater than 0');
  }

  return errors;
}

// ============================================================================
// Validation on Startup
// ============================================================================

// Validate configuration on module load
const validationErrors = validateConfig(config);
if (validationErrors.length > 0) {
  console.error('Configuration validation errors:');
  validationErrors.forEach(error => console.error(`  - ${error}`));

  // Only throw in production/non-test environments
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Configuration validation failed: ${validationErrors.join(', ')}`);
  }
}
