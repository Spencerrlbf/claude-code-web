# OpenAI Service Implementation Plan

## Task: 2.1 Create OpenAI Service

**Status:** Ready to implement
**Approach:** Test-Driven Development (TDD)
**Created:** 2025-11-08

---

## 📋 Overview

Extract all OpenAI API interactions from `app/api/find-researchers/route.ts` into a dedicated, testable service module at `lib/services/openai-service.ts`.

### Current State
- All OpenAI logic is embedded in the 680-line `route.ts` file
- OpenAI client is instantiated at file level (line 16-18)
- Three main OpenAI interactions:
  1. **Strategy generation** (lines 26-88): Chat completion to generate search strategies
  2. **JD embedding** (lines 81-86): Single embedding for job description
  3. **Batch paper embeddings** (lines 187-201): Batch embeddings for papers
  4. **Researcher evaluation** (lines 394-438): Chat completion for fit evaluation

### Target State
- All OpenAI interactions encapsulated in `lib/services/openai-service.ts`
- Clean, testable interfaces with dependency injection
- Comprehensive error handling and retry logic
- Route file uses the service instead of direct API calls

---

## 🎯 Specific Tasks

### 1. Create Service File Structure

**File:** `lib/services/openai-service.ts`

**Public Interface:**
```typescript
export interface OpenAIServiceInterface {
  generateSearchStrategies(jobDescription: string): Promise<SearchStrategy[]>;
  createEmbedding(text: string): Promise<number[]>;
  createBatchEmbeddings(texts: string[]): Promise<number[][]>;
  evaluateResearcherFit(
    candidate: AuthorCandidate,
    jobDescription: string,
    strategies: SearchStrategy[]
  ): Promise<{ score: number; reason: string }>;
}
```

**Implementation approach:**
- Use dependency injection pattern (pass OpenAI client in constructor)
- Make all methods async
- Return clean, typed data (no raw OpenAI responses)

---

### 2. Method 1: Generate Search Strategies

**Current implementation:** Lines 21-89 in `route.ts`

**Extract to:**
```typescript
async generateSearchStrategies(jobDescription: string): Promise<SearchStrategy[]>
```

**What to extract:**
- System prompt (lines 31-65)
- User prompt construction (line 69)
- Chat completion API call (lines 26-73)
- JSON parsing and extraction (lines 75-76)
- Logging (line 78)

**Error handling to add:**
- Validate jobDescription is not empty
- Handle OpenAI API errors (timeout, rate limit, invalid key)
- Handle JSON parsing errors
- Validate response has strategies array
- Retry logic with exponential backoff

**Tests to write:**
1. ✅ Successful strategy generation
2. ✅ Empty job description throws error
3. ✅ OpenAI API timeout is handled
4. ✅ OpenAI rate limit (429) triggers retry
5. ✅ Invalid JSON response is handled
6. ✅ Missing strategies in response returns empty array
7. ✅ Retry logic works (fails 2x, succeeds on 3rd attempt)

---

### 3. Method 2: Create Single Embedding

**Current implementation:** Lines 81-86 in `route.ts`

**Extract to:**
```typescript
async createEmbedding(text: string): Promise<number[]>
```

**What to extract:**
- Embedding API call with model from config
- Extract embedding vector from response

**Error handling to add:**
- Validate text is not empty
- Handle API errors
- Validate embedding is returned
- Handle rate limiting
- Retry logic

**Tests to write:**
1. ✅ Successful embedding creation
2. ✅ Empty text throws error
3. ✅ OpenAI API error is handled
4. ✅ Rate limit triggers retry
5. ✅ Retry exhaustion throws error
6. ✅ Invalid response (no embedding) throws error

---

### 4. Method 3: Create Batch Embeddings

**Current implementation:** Lines 176-203 in `route.ts`

**Extract to:**
```typescript
async createBatchEmbeddings(texts: string[]): Promise<number[][]>
```

**What to extract:**
- Batch processing logic (lines 182-201)
- Uses config.openai.batchSize
- Creates embeddings for multiple texts in batches
- Returns array of embedding vectors

**Error handling to add:**
- Validate texts array is not empty
- Handle partial batch failures (retry only failed batch)
- Handle API errors
- Validate all embeddings are returned
- Retry logic per batch

**Tests to write:**
1. ✅ Successful batch embedding (single batch)
2. ✅ Successful batch embedding (multiple batches)
3. ✅ Empty array throws error
4. ✅ Batch failure triggers retry for that batch only
5. ✅ Partial batch success (some succeed, some fail)
6. ✅ All batches fail after retries throws error
7. ✅ Batch size from config is respected

---

### 5. Method 4: Evaluate Researcher Fit

**Current implementation:** Lines 382-456 in `route.ts`

**Extract to:**
```typescript
async evaluateResearcherFit(
  candidate: AuthorCandidate,
  jobDescription: string,
  strategies: SearchStrategy[]
): Promise<{ score: number; reason: string }>
```

**What to extract:**
- System prompt (lines 399-418)
- User prompt construction (lines 422-432)
- Chat completion call (lines 394-436)
- JSON parsing (line 438)
- Score and reason extraction (lines 440-443)

**Error handling to add:**
- Validate inputs
- Handle API errors
- Handle JSON parsing errors
- Default values on failure (score: 0, reason: "Error...")
- Retry logic

**Tests to write:**
1. ✅ Successful evaluation
2. ✅ Invalid candidate throws error
3. ✅ OpenAI API error returns default (not throws)
4. ✅ Invalid JSON returns default
5. ✅ Missing score/reason in response returns default
6. ✅ Retry logic on transient failures
7. ✅ Abstract preview is truncated correctly

---

### 6. Error Handling & Retry Logic

**Implement helper method:**
```typescript
private async withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = config.openai.maxRetries
): Promise<T>
```

**Retry strategy:**
- Exponential backoff: 1s, 2s, 4s, 8s
- Only retry on transient errors:
  - Network timeouts
  - 429 (rate limit)
  - 500, 502, 503, 504 (server errors)
- Don't retry on:
  - 401 (invalid key)
  - 400 (bad request)
  - Validation errors

**Tests to write:**
1. ✅ Successful retry after transient failure
2. ✅ Exponential backoff timing is correct
3. ✅ Non-retryable error throws immediately
4. ✅ Max retries exhausted throws error
5. ✅ Retry count is logged

---

### 7. Dependency Injection

**Constructor pattern:**
```typescript
export class OpenAIService implements OpenAIServiceInterface {
  constructor(
    private readonly client: OpenAI,
    private readonly config: Config['openai']
  ) {}

  // ... methods
}
```

**Factory function:**
```typescript
export function createOpenAIService(apiKey?: string): OpenAIService {
  const openaiConfig = apiKey
    ? { ...config.openai, apiKey }
    : config.openai;

  const client = new OpenAI({ apiKey: openaiConfig.apiKey });
  return new OpenAIService(client, openaiConfig);
}
```

**Benefits:**
- Easy to mock client in tests
- Can override config for testing
- Can inject custom client for different environments

---

### 8. Update route.ts to Use Service

**Changes needed in `app/api/find-researchers/route.ts`:**

1. **Remove lines 16-18** (OpenAI client instantiation)
2. **Import service:**
   ```typescript
   import { createOpenAIService } from '@/lib/services/openai-service';
   ```
3. **Create service instance at top of POST handler:**
   ```typescript
   const openaiService = createOpenAIService();
   ```
4. **Replace line 26-88** with:
   ```typescript
   const strategies = await openaiService.generateSearchStrategies(jobDescription);
   const jdEmbedding = await openaiService.createEmbedding(jobDescription);
   ```
5. **Replace lines 176-203** with:
   ```typescript
   const abstracts = papers.map(p => p.summary);
   const embeddings = await openaiService.createBatchEmbeddings(abstracts);
   const papersWithEmbeddings = papers.map((paper, idx) => ({
     ...paper,
     embedding: embeddings[idx],
   }));
   ```
6. **Replace lines 394-438** (inside loop) with:
   ```typescript
   const { score, reason } = await openaiService.evaluateResearcherFit(
     candidate,
     jobDescription,
     strategies
   );
   ```

**Expected result:**
- `route.ts` shrinks by ~150 lines
- No direct OpenAI API calls remain in route.ts
- All OpenAI logic is encapsulated in service

---

## 🧪 Testing Strategy (TDD)

### Phase 1: Write Tests First

**Test file:** `__tests__/unit/services/openai-service.test.ts`

**Test structure:**
```typescript
describe('OpenAIService', () => {
  describe('generateSearchStrategies', () => {
    it('should generate strategies successfully', async () => { ... });
    it('should handle empty job description', async () => { ... });
    it('should retry on rate limit', async () => { ... });
    // ... more tests
  });

  describe('createEmbedding', () => {
    // ... tests
  });

  describe('createBatchEmbeddings', () => {
    // ... tests
  });

  describe('evaluateResearcherFit', () => {
    // ... tests
  });

  describe('withRetry (private method testing via public methods)', () => {
    // ... tests
  });
});
```

**Mocking approach:**
- Mock OpenAI client methods
- Create fixtures for API responses
- Mock timers for retry backoff testing
- Use dependency injection to pass mocked client

**Coverage target:** 90%+ on all methods

---

### Phase 2: Implement Service

**Implementation order:**
1. Create basic class structure
2. Implement `withRetry` helper
3. Implement `generateSearchStrategies`
4. Implement `createEmbedding`
5. Implement `createBatchEmbeddings`
6. Implement `evaluateResearcherFit`
7. Add JSDoc documentation

**Run tests after each method implementation:**
```bash
npm test -- openai-service.test.ts --watch
```

---

### Phase 3: Integration Testing

**Test file:** `__tests__/integration/openai-service.integration.test.ts`

**What to test:**
- Service works with real OpenAI client (behind feature flag)
- Service integrates correctly with route.ts
- End-to-end flow works after refactor

**Optional (requires OpenAI API key):**
```typescript
describe('OpenAIService Integration', () => {
  // Skip by default, run with INTEGRATION_TEST=true
  const shouldRun = process.env.INTEGRATION_TEST === 'true';

  (shouldRun ? describe : describe.skip)('with real OpenAI API', () => {
    it('should generate strategies for real job description', async () => {
      // ... real API test
    });
  });
});
```

---

### Phase 4: Update Route and Verify

**Steps:**
1. Update route.ts to use service
2. Run TypeScript type checking: `npm run build`
3. Run all tests: `npm test`
4. Manually test the application: `npm run dev`
5. Submit a test job description and verify results

**Verification checklist:**
- [ ] TypeScript compiles with no errors
- [ ] All tests pass
- [ ] Application runs without errors
- [ ] Test job description returns results
- [ ] Debug logs show service methods are being called
- [ ] No direct OpenAI API calls in route.ts

---

## 📁 File Structure

```
claude-code-web/
├── lib/
│   └── services/
│       └── openai-service.ts              # NEW: Service implementation
├── __tests__/
│   ├── unit/
│   │   └── services/
│   │       └── openai-service.test.ts     # NEW: Unit tests
│   └── integration/
│       └── openai-service.integration.test.ts  # NEW: Integration tests
├── app/
│   └── api/
│       └── find-researchers/
│           └── route.ts                   # MODIFIED: Uses service
```

---

## 🔍 Code Review Checklist

Before marking this task as complete:

- [ ] All methods have JSDoc documentation
- [ ] All tests pass with >90% coverage
- [ ] Error handling is comprehensive
- [ ] Retry logic works correctly
- [ ] TypeScript types are correct and exported
- [ ] No `any` types used
- [ ] Dependency injection is implemented
- [ ] route.ts has no direct OpenAI calls
- [ ] Application works end-to-end
- [ ] Debug logging is helpful
- [ ] Config values are used (no magic numbers)

---

## 🚀 Expected Outcomes

### Before
- `route.ts`: 680 lines with embedded OpenAI logic
- No separation of concerns
- Hard to test
- Direct API calls scattered throughout

### After
- `route.ts`: ~530 lines (150 lines removed)
- `openai-service.ts`: ~400 lines (new)
- `openai-service.test.ts`: ~600 lines (new)
- Clean separation of concerns
- 90%+ test coverage
- Easy to mock in other tests
- All OpenAI logic in one place

### Benefits
✅ **Testability:** Can mock service in other tests
✅ **Reusability:** Service can be used elsewhere
✅ **Maintainability:** Changes to OpenAI logic centralized
✅ **Error Handling:** Robust retry and error handling
✅ **Type Safety:** Clear interfaces and types
✅ **Flexibility:** Easy to swap AI providers later

---

## ⚠️ Potential Gotchas

### 1. Batching Logic
- Ensure batch indices align correctly (line 192-197 in current code)
- Test edge cases: 0 papers, 1 paper, exactly batch size, just over batch size

### 2. Retry Logic
- Don't retry on validation errors (infinite loop risk)
- Ensure exponential backoff doesn't exceed timeout
- Log retry attempts for debugging

### 3. Error Messages
- Preserve enough context for debugging
- Don't expose API keys in errors
- Return user-friendly messages

### 4. Type Safety
- Ensure SearchStrategy type is correctly used
- AuthorCandidate interface should match
- Response parsing should validate all required fields

### 5. Configuration
- Use config.openai values, not hardcoded strings
- Respect batchSize, maxRetries, timeoutMs

---

## 📊 Success Metrics

- [ ] All 30+ tests pass
- [ ] Test coverage >90%
- [ ] TypeScript compiles with no errors
- [ ] Application runs without errors
- [ ] Manual test completes successfully
- [ ] route.ts reduced by ~150 lines
- [ ] No direct OpenAI imports in route.ts

---

## 🔗 Dependencies

**Before this task:**
- ✅ 1.3 Create Configuration Module (complete)
- ✅ 1.2 Extract Type Definitions (complete)

**After this task:**
- 2.2 Create arXiv Service
- 2.3 Create Semantic Scholar Service
- 3.x Core Business Logic modules (will use this service)

**Blocks:**
- All Phase 3 tasks (they need this service)
- Orchestrator (will coordinate all services)

---

## 💡 Implementation Tips

1. **Start with tests:** Write at least 5 tests before any implementation
2. **One method at a time:** Don't implement all methods at once
3. **Run tests frequently:** Use watch mode during development
4. **Keep commits small:** Commit after each method passes tests
5. **Test error paths:** Don't just test happy paths
6. **Mock carefully:** Ensure mocks match real API behavior
7. **Use fixtures:** Create reusable test fixtures for API responses

---

## 📝 Notes

- This is the first service extraction, so it sets the pattern for others
- Pay attention to how we structure the service - we'll replicate this for arXiv and Semantic Scholar
- Error handling is critical - OpenAI API can fail in many ways
- The retry logic will be reused in other services
- Good tests here will make other modules easier to test (they can mock this service)

---

**Ready to implement?** Please confirm and I'll proceed with TDD implementation! 🚀
