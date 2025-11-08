# AI Researcher Finder - Refactoring & Enhancement TODO

This document outlines a modular, test-driven approach to improving the codebase. Each item should be completed one at a time, with tests written first (TDD), then discussed and confirmed before implementation.

---

## Phase 1: Foundation & Modularity

### - [x] 1.1 Project Setup & Testing Infrastructure
**Goal:** Set up testing framework and tools before any refactoring begins.

**What we're achieving:**
- Install and configure Jest + TypeScript for unit testing
- Install testing utilities (@testing-library, ts-jest)
- Set up test file structure (e.g., `__tests__` directories)
- Create a sample test to verify setup works
- Add test scripts to package.json (`npm test`, `npm run test:watch`, `npm run test:coverage`)

**Success criteria:**
- `npm test` runs successfully
- Can run tests in watch mode
- Sample test passes
- Coverage reports generate correctly

**Testing approach:**
- Create a simple utility function (e.g., `sum(a, b)`) with tests to validate Jest works

---

### - [x] 1.2 Extract Type Definitions
**Goal:** Create a centralized, single source of truth for all TypeScript types and interfaces.

**What we're achieving:**
- Create `lib/types/index.ts` with all shared types
- Move duplicated types from `route.ts` and `page.tsx` into this file
- Export all types from a single location
- Update both files to import from the new types file

**Types to extract:**
- `SearchStrategy`
- `ArxivPaper`
- `PaperWithEmbedding`
- `AuthorCandidate`
- `TopResearcher`
- `AdditionalCandidate`
- `ApiResponse`
- `StrategyUsed`
- Location type (`'USA' | 'International' | 'Unknown'`)

**Success criteria:**
- No type duplication between files
- All imports resolve correctly
- TypeScript compilation passes with no errors
- Application runs without breaking

**Testing approach:**
- TypeScript type checking is the test
- Verify `npm run build` succeeds
- Manually test the app still works

---

### - [x] 1.3 Create Configuration Module
**Goal:** Extract all magic numbers and hardcoded values into a centralized configuration file.

**What we're achieving:**
- Create `lib/utils/config.ts`
- Extract all configurable values:
  - Similarity thresholds (0.6, 0.55, 0.5, 0.45)
  - Batch sizes (20 for embeddings, 40 for arXiv, 60 max papers)
  - Result limits (top 10 researchers, 20 additional candidates)
  - USA location keywords array
  - API rate limits and timeouts
- Support environment variables for overrides
- Add type safety with constants and enums

**Success criteria:**
- No magic numbers remain in business logic
- Configuration is importable and type-safe
- Can override via environment variables
- Documentation for each config value

**Testing approach:**
- Write unit tests for config module
- Test environment variable overrides work
- Test default values are correct
- Mock config in other tests

---

### - [x] 1.4 Extract Cosine Similarity Utility
**Goal:** Move mathematical utilities to separate testable module.

**What we're achieving:**
- Create `lib/utils/math.ts`
- Move `cosineSimilarity()` function
- Add comprehensive tests for edge cases
- Add JSDoc documentation

**Success criteria:**
- Function is pure and side-effect free
- Handles edge cases (empty vectors, zero vectors, mismatched lengths)
- 100% test coverage
- Well documented

**Testing approach (TDD):**
1. Write tests FIRST:
   - Test normal case: `[1,2,3]` vs `[4,5,6]`
   - Test identical vectors (should return 1.0)
   - Test orthogonal vectors (should return 0.0)
   - Test zero vectors (should return 0)
   - Test mismatched lengths (should throw error)
2. Implement function to pass tests
3. Verify all tests pass

---

## Phase 2: Service Layer Extraction

### - [ ] 2.1 Create OpenAI Service
**Goal:** Encapsulate all OpenAI API interactions in a single service with clear interfaces.

**What we're achieving:**
- Create `lib/services/openai-service.ts`
- Extract methods:
  - `generateSearchStrategies(jobDescription: string): Promise<SearchStrategy[]>`
  - `createEmbedding(text: string): Promise<number[]>`
  - `createBatchEmbeddings(texts: string[]): Promise<number[][]>`
  - `evaluateResearcherFit(candidate, jobDescription, strategies): Promise<{score, reason}>`
- Add error handling and retries
- Add rate limiting logic
- Make testable with dependency injection

**Success criteria:**
- All OpenAI calls go through this service
- Service is mockable for testing
- Proper error handling for API failures
- Rate limiting prevents 429 errors

**Testing approach (TDD):**
1. Write tests with mocked OpenAI client:
   - Test successful embedding creation
   - Test batch embedding with correct batching
   - Test error handling (API timeout, rate limit, invalid response)
   - Test retry logic
2. Implement service to pass tests
3. Integration test with real API (optional, behind flag)

---

### - [ ] 2.2 Create arXiv Service
**Goal:** Encapsulate all arXiv API interactions in a dedicated service.

**What we're achieving:**
- Create `lib/services/arxiv-service.ts`
- Extract method:
  - `searchPapers(query: string, maxResults: number): Promise<ArxivPaper[]>`
- Handle XML parsing internally
- Add error handling for network failures
- Add result validation

**Success criteria:**
- All arXiv API calls go through this service
- XML parsing is isolated and tested
- Handles malformed XML gracefully
- Returns clean, typed data

**Testing approach (TDD):**
1. Write tests with mocked fetch:
   - Test successful search with valid XML
   - Test parsing of single entry vs array of entries
   - Test empty results
   - Test malformed XML handling
   - Test network error handling
2. Create mock XML responses
3. Implement service to pass tests

---

### - [ ] 2.3 Create Semantic Scholar Service
**Goal:** Encapsulate Semantic Scholar API for author location lookup.

**What we're achieving:**
- Create `lib/services/semantic-scholar-service.ts`
- Extract method:
  - `searchAuthor(name: string): Promise<{affiliations: string[]}>`
  - `determineLocation(affiliations: string[]): 'USA' | 'International' | 'Unknown'`
- Move USA_KEYWORDS into config or this service
- Add caching to avoid duplicate API calls
- Add rate limiting

**Success criteria:**
- Clean separation of API calls and location logic
- No duplicate author lookups
- Handles API failures gracefully
- Fast response with caching

**Testing approach (TDD):**
1. Write tests with mocked fetch:
   - Test author found with USA affiliation
   - Test author found with international affiliation
   - Test author not found
   - Test location determination with various affiliations
   - Test caching works (2nd call doesn't hit API)
2. Implement service to pass tests

---

## Phase 3: Core Business Logic Extraction

### - [ ] 3.1 Create Search Strategy Module
**Goal:** Isolate search strategy generation and execution logic.

**What we're achieving:**
- Create `lib/core/search-strategy.ts`
- Extract:
  - Strategy generation logic (calls OpenAI service)
  - Multi-strategy execution logic
  - Paper deduplication logic
- Return both papers and metadata about strategies used

**Success criteria:**
- Module has no direct API calls (uses services)
- Easily testable with mocked services
- Clear input/output contracts
- Strategy execution can be parallelized

**Testing approach (TDD):**
1. Mock OpenAI and arXiv services
2. Write tests:
   - Test strategy generation returns expected format
   - Test multi-query execution aggregates results
   - Test deduplication removes duplicate paper IDs
   - Test empty results handling
3. Implement module to pass tests

---

### - [ ] 3.2 Create Paper Matching Module
**Goal:** Isolate semantic similarity and filtering logic.

**What we're achieving:**
- Create `lib/core/paper-matching.ts`
- Extract:
  - `calculateSimilarities(jdEmbedding, papers): PaperWithScore[]`
  - `filterByThreshold(papers, threshold): FilteredPapers`
  - `adaptiveThreshold(scores): number` (dynamic threshold calculation)
  - `computeSimilarityStats(scores): Stats`
- Move away from hardcoded threshold cascading
- Add adaptive threshold based on score distribution

**Success criteria:**
- Similarity calculation is isolated and testable
- Threshold can be dynamic or fixed (configurable)
- Returns rich statistics for debugging
- No business logic leakage

**Testing approach (TDD):**
1. Create mock papers with embeddings
2. Write tests:
   - Test similarity calculation correctness
   - Test filtering at various thresholds
   - Test adaptive threshold with different distributions
   - Test statistics calculation (min, max, avg, median)
   - Test edge case: all papers below threshold
3. Implement module to pass tests

---

### - [ ] 3.3 Create Author Extraction Module
**Goal:** Isolate author deduplication and candidate creation logic.

**What we're achieving:**
- Create `lib/core/author-extraction.ts`
- Extract:
  - `extractAuthors(papers): AuthorCandidate[]`
  - Deduplication logic (keep highest-scoring paper per author)
  - Author normalization (lowercase, trim)

**Success criteria:**
- Pure function with no side effects
- Handles multi-author papers correctly
- Deduplication keeps best paper per author
- Efficient (uses Map for O(1) lookups)

**Testing approach (TDD):**
1. Create mock papers with overlapping authors
2. Write tests:
   - Test single author extraction
   - Test multi-author paper handling
   - Test deduplication (keeps higher score)
   - Test name normalization (case, whitespace)
   - Test empty papers array
3. Implement module to pass tests

---

### - [ ] 3.4 Create Location Enrichment Module
**Goal:** Isolate author location enrichment logic.

**What we're achieving:**
- Create `lib/core/location-enrichment.ts`
- Extract:
  - `enrichWithLocation(authors): Promise<EnrichedAuthors>`
  - Use Semantic Scholar service
  - Parallel processing with rate limiting

**Success criteria:**
- Module coordinates service calls efficiently
- Handles partial failures gracefully
- Returns authors with location info
- Respects rate limits

**Testing approach (TDD):**
1. Mock Semantic Scholar service
2. Write tests:
   - Test successful enrichment for all authors
   - Test partial API failures (some authors enriched, others unknown)
   - Test all API failures scenario
   - Test rate limiting behavior
3. Implement module to pass tests

---

### - [ ] 3.5 Create AI Evaluation Module
**Goal:** Isolate researcher fit evaluation logic.

**What we're achieving:**
- Create `lib/core/ai-evaluation.ts`
- Extract:
  - `evaluateResearchers(candidates, jobDescription, strategies): Promise<TopResearchers>`
  - Use OpenAI service for fit evaluation
  - Sequential processing with error handling

**Success criteria:**
- Module uses OpenAI service (not direct API calls)
- Handles evaluation failures gracefully
- Returns structured evaluation results
- Doesn't fail entire process if one evaluation fails

**Testing approach (TDD):**
1. Mock OpenAI service
2. Write tests:
   - Test successful evaluation for all candidates
   - Test partial failures (some candidates evaluated, others get default)
   - Test invalid JSON response handling
   - Test rate limiting/retries
3. Implement module to pass tests

---

## Phase 4: Orchestration & API Layer

### - [ ] 4.1 Create Main Orchestrator
**Goal:** Create a high-level orchestrator that coordinates all modules.

**What we're achieving:**
- Create `lib/core/researcher-finder.ts`
- Main function: `findResearchers(jobDescription): Promise<Results>`
- Orchestrates the full pipeline:
  1. Generate strategies + JD embedding
  2. Search papers with strategies
  3. Create paper embeddings
  4. Calculate similarity & filter
  5. Extract authors
  6. Enrich with location
  7. Select top 10
  8. Evaluate top 10
  9. Return results
- Add debug logging throughout
- Add error recovery at each step

**Success criteria:**
- Clean, readable orchestration code
- Each step can be mocked for testing
- Proper error handling with partial results
- Debug logging for troubleshooting

**Testing approach (TDD):**
1. Mock all services and modules
2. Write tests:
   - Test successful full pipeline
   - Test failure at each step (should return partial results or error)
   - Test empty results at various stages
   - Test debug log generation
3. Implement orchestrator to pass tests

---

### - [ ] 4.2 Refactor API Route Handler
**Goal:** Make the API route a thin wrapper around the orchestrator.

**What we're achieving:**
- Refactor `app/api/find-researchers/route.ts`
- Should only:
  - Validate request
  - Call orchestrator
  - Format response
  - Handle HTTP errors
- All business logic moved to orchestrator
- Should be < 100 lines

**Success criteria:**
- Route handler is minimal
- No business logic in route
- Clean error handling
- Proper HTTP status codes

**Testing approach:**
1. Mock orchestrator
2. Write integration tests:
   - Test successful request/response
   - Test validation errors (400)
   - Test orchestrator errors (500)
   - Test response format matches expected schema
3. Refactor route to pass tests

---

## Phase 5: Enhanced Paper Matching (Improvements)

### - [ ] 5.1 Add Title + Abstract Embeddings
**Goal:** Improve matching by embedding both title and abstract, not just abstract.

**What we're achieving:**
- Update `paper-matching.ts` to support multiple embeddings per paper
- Create combined embeddings with weighted average (title: 40%, abstract: 60%)
- Update similarity calculation to use combined embedding

**Success criteria:**
- Papers have both title and abstract embeddings
- Combined embedding improves matching quality
- Backward compatible (can still use abstract-only)

**Testing approach (TDD):**
1. Create test papers with titles and abstracts
2. Write tests:
   - Test title embedding creation
   - Test weighted combination calculation
   - Test similarity with combined embeddings
   - Compare results: abstract-only vs combined
3. Implement feature to pass tests
4. A/B test with real JD to verify improvement

---

### - [ ] 5.2 Implement Multi-Aspect JD Embeddings
**Goal:** Create separate embeddings for different aspects of the job description.

**What we're achieving:**
- Extract technical skills, domain knowledge, and methodologies from JD
- Create separate embeddings for each aspect
- Calculate weighted similarity:
  - Technical skills: 50%
  - Methodologies: 30%
  - Domain knowledge: 20%

**Success criteria:**
- JD is decomposed into aspects using AI
- Each aspect has its own embedding
- Weighted similarity is more accurate than single embedding

**Testing approach (TDD):**
1. Mock OpenAI service for aspect extraction
2. Write tests:
   - Test JD aspect extraction
   - Test multi-aspect embedding creation
   - Test weighted similarity calculation
   - Compare results: single vs multi-aspect
3. Implement feature to pass tests
4. A/B test with real JDs

---

### - [ ] 5.3 Implement Adaptive Threshold
**Goal:** Replace fixed threshold cascade with statistical adaptive threshold.

**What we're achieving:**
- Calculate threshold based on score distribution
- Use: `median + 0.5 * stddev` or percentile-based (top 20%)
- Ensure minimum of 10 papers, maximum of 60

**Success criteria:**
- No more hardcoded threshold cascade
- Threshold adapts to score distribution
- Always returns reasonable number of papers

**Testing approach (TDD):**
1. Create mock score distributions:
   - High variance (wide range)
   - Low variance (clustered)
   - All high scores
   - All low scores
2. Write tests:
   - Test threshold calculation for each distribution
   - Test minimum/maximum paper count enforcement
   - Test edge cases (empty, single paper)
3. Implement feature to pass tests
4. Test with real data

---

### - [ ] 5.4 Add Maximal Marginal Relevance (MMR)
**Goal:** Improve diversity in results by balancing relevance and uniqueness.

**What we're achieving:**
- Implement MMR algorithm for paper selection
- Parameter `lambda` (default 0.7) balances relevance vs diversity
- Prevents returning 10 researchers all working on same narrow problem

**Success criteria:**
- More diverse research areas in top results
- Still maintains relevance to JD
- Configurable relevance/diversity tradeoff

**Testing approach (TDD):**
1. Create mock papers with similar/dissimilar embeddings
2. Write tests:
   - Test MMR selects diverse papers
   - Test lambda=1.0 (pure relevance, no diversity)
   - Test lambda=0.0 (pure diversity, no relevance)
   - Test lambda=0.7 (balanced)
   - Compare with top-K selection (current approach)
3. Implement MMR algorithm to pass tests
4. A/B test with real JDs

---

### - [ ] 5.5 Add Two-Stage Author Ranking
**Goal:** Rank authors based on their overall body of work, not just single best paper.

**What we're achieving:**
- Build author profiles aggregating all their papers
- Score authors on:
  - Best paper (40%)
  - Average similarity across papers (30%)
  - Productivity - number of relevant papers (20%)
  - Consistency - low variance in scores (10%)

**Success criteria:**
- Authors with multiple good papers rank higher than one-hit wonders
- Scoring is balanced across multiple factors
- Results feel more accurate for prolific researchers

**Testing approach (TDD):**
1. Create mock authors with different paper profiles:
   - One great paper vs multiple good papers
   - Consistent researcher vs inconsistent
2. Write tests:
   - Test author profile building
   - Test scoring calculation
   - Test ranking order
   - Compare with single-paper ranking
3. Implement feature to pass tests
4. Evaluate with real data

---

### - [ ] 5.6 Integrate Citation Metrics from Semantic Scholar
**Goal:** Boost scores for impactful papers with high citations.

**What we're achieving:**
- Fetch citation count from Semantic Scholar when checking location
- Add citation boost to similarity score: `log10(citations + 1) / 5`
- Add recency multiplier: 1.1x for papers < 2 years old

**Success criteria:**
- High-impact papers rank higher
- Boost is logarithmic (avoids over-weighting mega-cited papers)
- Recent papers get small boost

**Testing approach (TDD):**
1. Mock Semantic Scholar service with citation data
2. Write tests:
   - Test citation boost calculation
   - Test logarithmic scaling (100 citations vs 1000 shouldn't be 10x difference)
   - Test recency multiplier
   - Test combined adjusted score
3. Implement feature to pass tests
4. Compare results with/without citation boost

---

## Phase 6: Advanced Improvements (Future)

### 🔄 6.1 Add Multiple Paper Sources
**Goal:** Aggregate papers from arXiv, Semantic Scholar, and OpenAlex.

**What we're achieving:**
- Create abstraction for paper sources
- Implement Semantic Scholar and OpenAlex sources
- Deduplicate across sources (by DOI, title similarity)

**Success criteria:**
- More comprehensive paper coverage
- Deduplication works across sources
- Can enable/disable sources via config

**Testing approach:**
- Mock each source
- Test aggregation and deduplication
- Test handling of source failures

---

### 🔄 6.2 Add arXiv Category Filtering
**Goal:** Use arXiv categories (cs.AI, cs.LG, etc.) to improve search precision.

**What we're achieving:**
- Extract relevant categories from JD using AI
- Add category filters to arXiv searches
- Combine category + keyword search

**Success criteria:**
- More relevant papers from arXiv
- Fewer off-topic results
- Category detection is accurate

**Testing approach:**
- Test category extraction from various JDs
- Test arXiv search with category filters
- Compare results with/without categories

---

### 🔄 6.3 Implement Clustering for Diversity
**Goal:** Use k-means clustering to ensure diverse research areas in results.

**What we're achieving:**
- Cluster papers by embedding similarity
- Sample top papers from each cluster
- Ensure diversity across research subfields

**Success criteria:**
- Results span multiple research areas
- Still maintains relevance threshold
- Interpretable clusters

**Testing approach:**
- Test clustering algorithm
- Test sampling from clusters
- Compare diversity metrics with/without clustering

---

## Phase 7: Performance & Polish

### 🔄 7.1 Add Caching Layer
**Goal:** Cache embeddings and API responses to reduce costs and latency.

**What we're achieving:**
- Cache paper embeddings (by paper ID)
- Cache author location lookups (by author name)
- Cache search results (with TTL)
- Use Redis or in-memory cache

**Success criteria:**
- Repeat searches are much faster
- Cache hit/miss metrics
- Configurable TTL
- Cache invalidation works

---

### 🔄 7.2 Add Request Queuing & Rate Limiting
**Goal:** Handle concurrent requests without hitting API rate limits.

**What we're achieving:**
- Implement request queue for OpenAI API
- Implement rate limiting for external APIs
- Add retry logic with exponential backoff

**Success criteria:**
- No 429 rate limit errors
- Requests are processed fairly
- System handles concurrent users

---

### 🔄 7.3 Add Progress Tracking
**Goal:** Show real-time progress to user during long-running searches.

**What we're achieving:**
- Implement Server-Sent Events (SSE) or WebSocket
- Send progress updates from each pipeline stage
- Update UI in real-time

**Success criteria:**
- User sees what's happening during search
- Better UX for 1-2 minute wait times
- Progress is accurate

---

### 🔄 7.4 Add Comprehensive Logging & Monitoring
**Goal:** Production-ready logging and monitoring.

**What we're achieving:**
- Structured logging (JSON format)
- Log levels (debug, info, warn, error)
- Performance metrics (duration, API calls, costs)
- Error tracking integration

**Success criteria:**
- Easy to debug production issues
- Can track API costs per request
- Performance bottlenecks are visible

---

## Completion Checklist

- [ ] All Phase 1 items completed (Foundation & Modularity)
- [ ] All Phase 2 items completed (Service Layer)
- [ ] All Phase 3 items completed (Core Business Logic)
- [ ] All Phase 4 items completed (Orchestration)
- [ ] All Phase 5 items completed (Enhanced Matching)
- [ ] Test coverage > 80%
- [ ] All TypeScript errors resolved
- [ ] Application runs without errors
- [ ] Performance is acceptable (< 2 min per search)
- [ ] Documentation updated
- [ ] README has setup instructions
- [ ] Code review completed

---

## Notes

- **TDD Process:** For each item, write tests first, then implement to make tests pass
- **Discussion First:** Before implementing each item, discuss approach and confirm requirements
- **One at a Time:** Complete each item fully before moving to next
- **Mark Complete:** Check off items (✅) and remove from list when done
- **Testing:** Every item must have tests before considered complete
- **Documentation:** Add JSDoc comments to all public functions

---

## Current Status

**Currently working on:** 2.1 Create OpenAI Service (Next up)
**Last completed:** 1.4 Extract Cosine Similarity Utility ✅
**Last updated:** 2025-11-07
