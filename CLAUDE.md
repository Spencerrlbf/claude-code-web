# AI Researcher Finder - Recruitment Platform

A Next.js application that uses AI embeddings and semantic search to match research papers from arXiv with job descriptions, helping you find the perfect researchers for academic or industry positions.

---

## 🎯 Project Vision

This is the core technology powering a recruitment platform that:
- Analyzes job descriptions to understand technical requirements
- Searches academic papers (arXiv, Semantic Scholar, etc.) using intelligent multi-strategy search
- Uses semantic embeddings to match papers with job requirements
- Ranks researchers based on relevance, impact, and location
- Provides AI-generated fit explanations for top candidates

---

## 🏗️ Current Architecture

### Technology Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **AI/ML:** OpenAI API (embeddings & chat completions)
- **Data Sources:**
  - arXiv API (research papers)
  - Semantic Scholar API (citations, affiliations, location)
- **Deployment:** Vercel-ready

### Current Structure (Pre-Refactor)
```
claude-code-web/
├── app/
│   ├── api/
│   │   └── find-researchers/
│   │       └── route.ts          # 680-line monolithic API handler
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Main UI (470 lines)
│   └── globals.css               # Global styles
├── public/                       # Static assets
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── TODO.md                       # Refactoring roadmap
└── README.md                     # This file
```

### Target Structure (Post-Refactor)
```
claude-code-web/
├── app/                          # Next.js app directory
│   ├── api/
│   │   └── find-researchers/
│   │       └── route.ts          # Thin API wrapper (~50 lines)
│   ├── (marketing)/              # Marketing pages (future)
│   ├── (dashboard)/              # User dashboard (future)
│   ├── layout.tsx
│   └── page.tsx
├── lib/                          # Core business logic
│   ├── services/                 # External API integrations
│   │   ├── openai-service.ts
│   │   ├── arxiv-service.ts
│   │   └── semantic-scholar-service.ts
│   ├── core/                     # Business logic modules
│   │   ├── search-strategy.ts
│   │   ├── paper-matching.ts
│   │   ├── author-extraction.ts
│   │   ├── location-enrichment.ts
│   │   ├── ai-evaluation.ts
│   │   └── researcher-finder.ts  # Main orchestrator
│   ├── utils/                    # Utilities
│   │   ├── math.ts
│   │   └── config.ts
│   └── types/                    # TypeScript definitions
│       └── index.ts
├── components/                   # React components (future)
│   ├── ui/                       # Reusable UI components
│   ├── features/                 # Feature-specific components
│   └── layout/                   # Layout components
├── __tests__/                    # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── public/                       # Static assets
├── TODO.md                       # Project roadmap
└── README.md                     # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm/yarn/pnpm/bun
- OpenAI API key

### Installation

1. **Clone the repository**
```bash
git clone git@github.com:Spencerrlbf/claude-code-web.git
cd claude-code-web
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` and add:
```env
OPENAI_API_KEY=sk-...

# Optional configuration overrides
SIMILARITY_THRESHOLD=0.6
MAX_PAPERS_TO_ANALYZE=60
ARXIV_RESULTS_PER_QUERY=40
```

4. **Run development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- paper-matching.test.ts
```

---

## 📋 Development Workflow

### Current Phase: Refactoring & Modularization

We are following a test-driven, modular approach outlined in `TODO.md`. The workflow for each task is:

1. **Discuss** - Review the TODO item and clarify requirements
2. **Test First (TDD)** - Write tests before implementation
3. **Implement** - Write code to pass the tests
4. **Verify** - Ensure all tests pass and app still works
5. **Mark Complete** - Check off the item in TODO.md

### Code Quality Standards

- **Test Coverage:** Aim for >80% coverage on all business logic
- **TypeScript:** Strict mode enabled, no `any` types
- **Linting:** Follow ESLint rules
- **Documentation:** JSDoc comments for all public functions
- **Commits:** Conventional commits format

### Branch Strategy

- `main` - Production-ready code
- `refactor/*` - Refactoring work (current phase)
- `feature/*` - New features
- `fix/*` - Bug fixes

---

## 🧠 How It Works (Current Algorithm)

### Pipeline Overview

The researcher finder follows an 8-step pipeline:

1. **Generate Search Strategies**
   - AI analyzes job description
   - Creates 3-5 search strategies (core, adjacent, foundational areas)
   - Each strategy has multiple arXiv queries

2. **Multi-Strategy Paper Search**
   - Executes all queries in parallel on arXiv
   - Finds 100-200+ papers across different research areas
   - Deduplicates by paper ID

3. **Create Paper Embeddings**
   - Generates embeddings for all paper abstracts
   - Batches API calls (20 at a time) for efficiency

4. **Semantic Filtering**
   - Calculates cosine similarity between JD and each paper
   - Filters papers above similarity threshold (0.6, with fallback)
   - Returns top 60 papers

5. **Extract Authors**
   - Extracts all unique authors from filtered papers
   - Deduplicates (keeps highest-scoring paper per author)

6. **Enrich with Location**
   - Queries Semantic Scholar for author affiliations
   - Determines location (USA/International/Unknown) via keyword matching

7. **Select Top 10**
   - Sorts: USA first, then Unknown, then International
   - Within each group, sorts by similarity score
   - Takes top 10

8. **Generate AI Fit Reasons**
   - For top 10 only (cost optimization)
   - AI evaluates each researcher against JD
   - Returns relevance score (0-100) and explanation

### Key Algorithms

**Cosine Similarity:**
```typescript
similarity(A, B) = (A · B) / (||A|| × ||B||)
```
- Range: 0 (completely different) to 1 (identical)
- Used to compare JD embedding vs paper embeddings

**Adaptive Threshold:**
```typescript
threshold = max(0.45, median + 0.5 × stddev)
```
- Adjusts based on score distribution
- Ensures we get papers even in low-similarity scenarios

---

## 🎨 Planned Frontend Enhancement

After refactoring, we'll build a complete recruitment platform UI with:

### Landing Page
- Hero section explaining the service
- Value proposition for recruiters
- Demo search capability
- Testimonials & social proof

### Search Experience
- Enhanced job description input (with templates)
- Real-time progress updates during search
- Interactive results with filtering & sorting
- Researcher detail pages

### Dashboard (Future)
- Saved searches
- Researcher shortlists
- Search history
- Usage analytics

### Design System
- Component library (shadcn/ui or similar)
- Consistent color palette & typography
- Responsive design (mobile-first)
- Accessibility compliance (WCAG AA)

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (required) | - |
| `SIMILARITY_THRESHOLD` | Initial similarity threshold | `0.6` |
| `MAX_PAPERS_TO_ANALYZE` | Max papers after filtering | `60` |
| `ARXIV_RESULTS_PER_QUERY` | Results per arXiv query | `40` |
| `EMBEDDING_BATCH_SIZE` | Batch size for embeddings | `20` |
| `TOP_RESEARCHERS_COUNT` | Number of top researchers | `10` |
| `ADDITIONAL_CANDIDATES_COUNT` | Additional candidates | `20` |

### Configurable Parameters (lib/utils/config.ts)

After refactoring, all magic numbers will be centralized in `lib/utils/config.ts`:

```typescript
export const CONFIG = {
  similarity: {
    initialThreshold: 0.6,
    fallbackThresholds: [0.55, 0.5, 0.45],
    minPapers: 10,
    maxPapers: 60,
  },
  arxiv: {
    resultsPerQuery: 40,
    requestTimeout: 10000,
  },
  openai: {
    embeddingModel: 'text-embedding-3-small',
    chatModel: 'gpt-4o-mini',
    embeddingBatchSize: 20,
    maxRetries: 3,
  },
  researchers: {
    topCount: 10,
    additionalCount: 20,
  },
  location: {
    usaKeywords: [/* ... */],
    priorityOrder: ['USA', 'Unknown', 'International'],
  },
};
```

---

## 📊 Performance Considerations

### Current Performance
- **Average search time:** 60-120 seconds
- **API calls per search:**
  - OpenAI embeddings: ~10-15 calls (100-200 papers)
  - OpenAI chat: 11 calls (strategies + 10 evaluations)
  - Semantic Scholar: 50-100 calls (author lookups)
- **Cost per search:** ~$0.20-0.40 (mostly embeddings)

### Optimization Targets (Post-Refactor)
- [ ] Reduce to <60 seconds average
- [ ] Implement caching (reduce repeated searches)
- [ ] Parallel processing where possible
- [ ] Request queuing for API rate limits
- [ ] Cost reduction via smarter batching

---

## 🧪 Testing Strategy

### Test Types

1. **Unit Tests** - Test individual functions in isolation
   - All utils (math, config)
   - All services (mocked external APIs)
   - All core modules (mocked dependencies)

2. **Integration Tests** - Test module interactions
   - Service + core module integration
   - Pipeline stages working together
   - API route + orchestrator

3. **E2E Tests** - Test full user flows
   - Submit JD → Get results
   - Error handling flows
   - Edge cases (no results, API failures)

### Test Coverage Goals
- **Utils:** 100% coverage
- **Services:** >90% coverage
- **Core modules:** >85% coverage
- **Overall:** >80% coverage

### Mocking Strategy
- Mock all external APIs (OpenAI, arXiv, Semantic Scholar)
- Use fixtures for API responses
- Dependency injection for testability

---

## 🚢 Deployment

### Vercel (Recommended)

1. Connect GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to `main`

```bash
# Or deploy manually
npm run build
vercel deploy --prod
```

### Environment Setup
- Set `OPENAI_API_KEY` in Vercel environment variables
- Configure other env vars as needed
- Enable Edge Runtime for API routes (optional, for speed)

### Monitoring
- Vercel Analytics for performance
- Sentry or similar for error tracking
- OpenAI usage dashboard for cost monitoring

---

## 📚 Key Dependencies

### Production
- `next` (16.0.1) - React framework
- `react` (19.2.0) - UI library
- `openai` (6.8.1) - OpenAI SDK
- `fast-xml-parser` (5.3.1) - arXiv XML parsing
- `tailwindcss` (4.x) - Styling

### Development
- `typescript` (5.x) - Type safety
- `jest` + `ts-jest` - Testing framework
- `@testing-library/react` - React testing utilities
- `eslint` - Code linting

---

## 🗺️ Roadmap

### Phase 1: Refactoring (Current) - Weeks 1-2
- [ ] Extract services & modules
- [ ] Implement comprehensive testing
- [ ] Improve code modularity
- [ ] See `TODO.md` for detailed breakdown

### Phase 2: Enhanced Matching - Weeks 3-4
- [ ] Multi-aspect JD embeddings
- [ ] Title + abstract embeddings
- [ ] Adaptive thresholds
- [ ] MMR for diversity
- [ ] Citation metrics integration
- [ ] Two-stage author ranking

### Phase 3: Frontend Enhancement - Weeks 5-6
- [ ] Landing page redesign
- [ ] Search experience improvements
- [ ] Researcher detail pages
- [ ] Dashboard for saved searches
- [ ] Mobile responsiveness

### Phase 4: Platform Features - Weeks 7-8
- [ ] User authentication
- [ ] Saved searches & shortlists
- [ ] Email notifications
- [ ] Export to CSV/PDF
- [ ] Search sharing

### Phase 5: Advanced Features - Future
- [ ] Multiple paper sources (OpenAlex, etc.)
- [ ] Author contact info enrichment
- [ ] Batch processing mode
- [ ] API for external integrations
- [ ] Admin dashboard

---

## 🤝 Contributing

This is currently a private project, but contributions are welcome from approved collaborators.

### Development Process
1. Check `TODO.md` for current task
2. Create feature branch from `main`
3. Write tests first (TDD)
4. Implement feature
5. Ensure all tests pass
6. Create pull request
7. Code review + approval
8. Merge to `main`

---

## 📖 Additional Documentation

- **TODO.md** - Detailed refactoring roadmap with TDD approach
- **API Documentation** - (To be added in `docs/api.md`)
- **Architecture Decision Records** - (To be added in `docs/adr/`)
- **Component Storybook** - (To be added post-frontend refactor)

---

## 🐛 Troubleshooting

### Common Issues

**Issue: OpenAI API rate limits**
```
Error: 429 Too Many Requests
```
Solution: Implement request queuing (Phase 2), or upgrade OpenAI tier

**Issue: No papers found**
```
WARNING: No papers found on arXiv
```
Solution: Check JD content - may be too specific or non-technical

**Issue: All similarity scores low**
```
Max similarity: 0.42
```
Solution: This is expected for some JDs - adaptive threshold will lower automatically

**Issue: Semantic Scholar lookup fails**
```
Error checking location for [author]
```
Solution: This is non-fatal, author will be marked as "Unknown" location

---

## 📄 License

Private project - All rights reserved

---

## 📞 Contact

For questions or issues, contact: [Your contact info]

---

## 🙏 Acknowledgments

- OpenAI for embeddings and chat APIs
- arXiv for open access to research papers
- Semantic Scholar for author metadata
- Next.js team for excellent framework

---

**Last Updated:** 2025-11-07
**Version:** 0.1.0 (Pre-refactor)
**Status:** 🚧 Active Development - Refactoring Phase
