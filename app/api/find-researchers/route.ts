import { NextRequest, NextResponse } from 'next/server';
import type {
  SearchStrategy,
  ResearchArea,
  ArxivPaper,
  PaperWithEmbedding,
  AuthorCandidate,
  TopResearcher,
  Location,
} from '@/lib/types';
import { config } from '@/lib/utils/config';
import { cosineSimilarity } from '@/lib/utils/math';
import { createOpenAIService } from '@/lib/services/openai-service';
import { createArxivService } from '@/lib/services/arxiv-service';
import { semanticScholarService } from '@/lib/services/semantic-scholar-service';

// Step 1: Generate intelligent search strategies and create JD embedding
async function generateSearchStrategiesAndEmbedding(
  openaiService: ReturnType<typeof createOpenAIService>,
  jobDescription: string
): Promise<{
  strategies: SearchStrategy[];
  embedding: number[];
}> {
  // Generate search strategies and embedding using OpenAI service
  const strategies = await openaiService.generateSearchStrategies(jobDescription);
  const embedding = await openaiService.createEmbedding(jobDescription);

  return { strategies, embedding };
}

// Step 2: Execute multiple search strategies in parallel
async function searchArxivWithStrategies(
  arxivService: ReturnType<typeof createArxivService>,
  strategies: SearchStrategy[]
): Promise<{
  papers: ArxivPaper[];
  strategiesUsed: { name: string; rationale: string; papersFound: number; }[];
}> {
  console.log(`Executing ${strategies.length} search strategies...`);

  const allPapers: ArxivPaper[] = [];
  const strategiesUsed: { name: string; rationale: string; papersFound: number; }[] = [];

  // Execute all strategies
  for (const strategy of strategies) {
    console.log(`Strategy: ${strategy.name} - ${strategy.queries.length} queries`);
    let strategyPapers: ArxivPaper[] = [];

    // Execute all queries for this strategy
    for (const query of strategy.queries) {
      console.log(`  Searching: ${query}`);
      const papers = await arxivService.searchPapers(query, config.arxiv.maxResultsPerQuery);
      strategyPapers.push(...papers);
      console.log(`    Found ${papers.length} papers`);
    }

    allPapers.push(...strategyPapers);
    strategiesUsed.push({
      name: strategy.name,
      rationale: strategy.rationale,
      papersFound: strategyPapers.length,
    });
  }

  // Deduplicate papers by ID
  const uniquePapersMap = new Map<string, ArxivPaper>();
  allPapers.forEach(paper => {
    if (!uniquePapersMap.has(paper.id)) {
      uniquePapersMap.set(paper.id, paper);
    }
  });

  const uniquePapers = Array.from(uniquePapersMap.values());

  console.log(`Total papers before deduplication: ${allPapers.length}`);
  console.log(`Unique papers after deduplication: ${uniquePapers.length}`);

  return {
    papers: uniquePapers,
    strategiesUsed,
  };
}

// Step 3: Create embeddings for all paper abstracts
async function createPaperEmbeddings(
  openaiService: ReturnType<typeof createOpenAIService>,
  papers: ArxivPaper[]
): Promise<PaperWithEmbedding[]> {
  const abstracts = papers.map(p => p.summary);
  const embeddings = await openaiService.createBatchEmbeddings(abstracts);

  // Combine papers with their embeddings
  const papersWithEmbeddings: PaperWithEmbedding[] = papers.map((paper, idx) => ({
    ...paper,
    embedding: embeddings[idx],
  }));

  return papersWithEmbeddings;
}

// Step 4: Calculate similarity and filter
function filterBySimilarity(
  jdEmbedding: number[],
  papers: PaperWithEmbedding[],
  threshold: number = config.similarity.initialThreshold
): {
  filtered: PaperWithEmbedding[];
  allScores: { title: string; score: number; }[];
  stats: { min: number; max: number; avg: number; median: number; };
} {
  const papersWithScores = papers.map(paper => ({
    ...paper,
    similarityScore: cosineSimilarity(jdEmbedding, paper.embedding),
  }));

  // Calculate statistics
  const scores = papersWithScores.map(p => p.similarityScore!).sort((a, b) => b - a);
  const stats = {
    min: Math.min(...scores),
    max: Math.max(...scores),
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    median: scores[Math.floor(scores.length / 2)],
  };

  console.log('Similarity score stats:', stats);
  console.log('Top 10 similarity scores:', scores.slice(0, 10));

  // Get top papers info for debugging
  const allScores = papersWithScores
    .sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))
    .slice(0, config.debug.topScoresCount) // Top N for debugging
    .map(p => ({
      title: p.title,
      score: Math.round((p.similarityScore || 0) * 100) / 100,
    }));

  let filtered = papersWithScores.filter(p => p.similarityScore! >= threshold);

  // If we got too few, progressively lower the threshold
  if (filtered.length < config.similarity.minPapersForThreshold) {
    console.log(`Only ${filtered.length} papers above ${threshold}, lowering threshold...`);

    // Try fallback thresholds
    for (const fallbackThreshold of config.similarity.fallbackThresholds) {
      filtered = papersWithScores.filter(p => p.similarityScore! >= fallbackThreshold);
      if (filtered.length >= config.similarity.minPapersForThreshold) {
        console.log(`Found ${filtered.length} papers at threshold ${fallbackThreshold}`);
        break;
      }
      console.log(`Only ${filtered.length} papers above ${fallbackThreshold}, trying lower threshold...`);
    }

    // Just take top N if still too few
    if (filtered.length < config.similarity.minPapersForThreshold) {
      console.log(`Still only ${filtered.length} papers, taking top ${config.similarity.minPapersAbsolute} by score...`);
      filtered = papersWithScores.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0)).slice(0, config.similarity.minPapersAbsolute);
    }
  }

  // Sort by similarity
  filtered.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));

  // Take top N max
  return {
    filtered: filtered.slice(0, config.similarity.maxPapers),
    allScores,
    stats,
  };
}

// Step 5: Extract all authors and deduplicate
function extractAndDeduplicateAuthors(papers: PaperWithEmbedding[]): AuthorCandidate[] {
  const authorMap = new Map<string, AuthorCandidate>();

  papers.forEach(paper => {
    paper.authors.forEach(authorName => {
      const normalizedName = authorName.toLowerCase().trim();

      // If we've seen this author before, only keep the paper with higher similarity
      if (authorMap.has(normalizedName)) {
        const existing = authorMap.get(normalizedName)!;
        if (paper.similarityScore! > existing.similarityScore) {
          authorMap.set(normalizedName, {
            name: authorName,
            paper: {
              id: paper.id,
              title: paper.title,
              authors: paper.authors,
              summary: paper.summary,
              published: paper.published,
              link: paper.link,
            },
            similarityScore: paper.similarityScore!,
          });
        }
      } else {
        authorMap.set(normalizedName, {
          name: authorName,
          paper: {
            id: paper.id,
            title: paper.title,
            authors: paper.authors,
            summary: paper.summary,
            published: paper.published,
            link: paper.link,
          },
          similarityScore: paper.similarityScore!,
        });
      }
    });
  });

  return Array.from(authorMap.values());
}

// Step 6: Check USA location via Semantic Scholar
async function checkUSALocation(authors: AuthorCandidate[]): Promise<AuthorCandidate[]> {
  console.log(`Checking location for ${authors.length} authors...`);

  const enrichedAuthors = await Promise.all(
    authors.map(async (author) => {
      const locationData = await semanticScholarService.getAuthorLocation(author.name);

      return {
        ...author,
        location: locationData.location as Location,
        affiliation: locationData.affiliations[0],
      };
    })
  );

  return enrichedAuthors;
}

// Step 7: Sort and select top N
function selectTopResearchers(authors: AuthorCandidate[], topCount: number = config.researchers.topCount): AuthorCandidate[] {
  // Sort: USA first, then Unknown, then International; within each group, by similarity score
  const sorted = authors.sort((a, b) => {
    const locationDiff = config.location.priorityOrder[a.location || 'Unknown'] - config.location.priorityOrder[b.location || 'Unknown'];

    if (locationDiff !== 0) return locationDiff;

    return b.similarityScore - a.similarityScore;
  });

  return sorted.slice(0, topCount);
}

// Step 8: Generate AI fit reasons for top researchers
async function generateFitReasons(
  openaiService: ReturnType<typeof createOpenAIService>,
  candidates: AuthorCandidate[],
  jobDescription: string,
  strategies: SearchStrategy[]
): Promise<TopResearcher[]> {
  const topResearchers: TopResearcher[] = [];

  console.log(`Generating AI fit reasons for ${candidates.length} top researchers...`);

  for (const candidate of candidates) {
    const { score, reason } = await openaiService.evaluateResearcherFit(
      candidate,
      jobDescription,
      strategies
    );

    topResearchers.push({
      ...candidate,
      aiRelevanceScore: score,
      fitReason: reason,
    });
  }

  return topResearchers;
}

// Main API handler
export async function POST(request: NextRequest) {
  const debugLog: string[] = [];

  try {
    const { jobDescription } = await request.json();

    if (!jobDescription || typeof jobDescription !== 'string') {
      return NextResponse.json(
        { error: 'Job description is required' },
        { status: 400 }
      );
    }

    debugLog.push(`📝 Received job description (${jobDescription.length} characters)`);

    // Create service instances
    const openaiService = createOpenAIService();
    const arxivService = createArxivService();

    // Step 1: Generate intelligent search strategies and create JD embedding
    debugLog.push('🧠 Step 1: Generating intelligent search strategies with AI...');
    const { strategies, embedding: jdEmbedding } = await generateSearchStrategiesAndEmbedding(
      openaiService,
      jobDescription
    );
    debugLog.push(`✓ Generated ${strategies.length} search strategies:`);
    strategies.forEach((s, idx) => {
      debugLog.push(`   ${idx + 1}. ${s.name} - ${s.rationale}`);
      debugLog.push(`      Queries: ${s.queries.join(', ')}`);
    });

    if (strategies.length === 0) {
      debugLog.push('⚠️  WARNING: No search strategies generated!');
      return NextResponse.json({
        searchStrategies: [],
        topResearchers: [],
        additionalCandidates: [],
        debug: debugLog,
        error: 'No search strategies could be generated from the job description',
      });
    }

    // Step 2: Execute search strategies on arXiv
    debugLog.push('📚 Step 2: Executing search strategies on arXiv...');
    const { papers, strategiesUsed } = await searchArxivWithStrategies(arxivService, strategies);
    debugLog.push(`✓ Search results by strategy:`);
    strategiesUsed.forEach((s, idx) => {
      debugLog.push(`   ${idx + 1}. ${s.name}: ${s.papersFound} papers`);
    });
    debugLog.push(`✓ Total unique papers found: ${papers.length}`);

    if (papers.length === 0) {
      debugLog.push('⚠️  WARNING: No papers found on arXiv');
      return NextResponse.json({
        searchStrategies: strategies,
        topResearchers: [],
        additionalCandidates: [],
        debug: debugLog,
        error: 'No papers found on arXiv for any of the search strategies',
      });
    }

    // Step 3: Create embeddings for papers
    debugLog.push('🧮 Step 3: Creating embeddings for paper abstracts...');
    const papersWithEmbeddings = await createPaperEmbeddings(openaiService, papers);
    debugLog.push(`✓ Created embeddings for ${papersWithEmbeddings.length} papers`);

    // Step 4: Filter by similarity
    debugLog.push('📊 Step 4: Calculating similarity scores and filtering...');
    const { filtered: filteredPapers, allScores, stats } = filterBySimilarity(jdEmbedding, papersWithEmbeddings, config.similarity.initialThreshold);

    // Add detailed similarity debugging
    debugLog.push(`✓ Similarity Score Stats:`);
    debugLog.push(`   - Min: ${stats.min.toFixed(3)}, Max: ${stats.max.toFixed(3)}`);
    debugLog.push(`   - Avg: ${stats.avg.toFixed(3)}, Median: ${stats.median.toFixed(3)}`);
    debugLog.push(`✓ Top 5 papers by similarity:`);
    allScores.slice(0, 5).forEach((paper, idx) => {
      debugLog.push(`   ${idx + 1}. [${paper.score}] ${paper.title.slice(0, 80)}...`);
    });
    debugLog.push(`✓ Filtered to ${filteredPapers.length} papers above threshold`);

    if (filteredPapers.length === 0) {
      debugLog.push('⚠️  WARNING: No papers passed similarity threshold');
      return NextResponse.json({
        searchStrategies: strategies,
        topResearchers: [],
        additionalCandidates: [],
        similarityDebug: { stats, topPapers: allScores },
        debug: debugLog,
        error: 'No papers were similar enough to the job description',
      });
    }

    // Step 5: Extract and deduplicate authors
    debugLog.push('👥 Step 5: Extracting all authors and deduplicating...');
    const allAuthors = extractAndDeduplicateAuthors(filteredPapers);
    debugLog.push(`✓ Found ${allAuthors.length} unique researchers`);

    // Step 6: Check USA location
    debugLog.push('🌍 Step 6: Checking author locations via Semantic Scholar...');
    const authorsWithLocation = await checkUSALocation(allAuthors);
    const usaCount = authorsWithLocation.filter(a => a.location === 'USA').length;
    debugLog.push(`✓ Location check complete: ${usaCount} USA-based, ${authorsWithLocation.length - usaCount} other`);

    // Step 7: Select top N researchers
    debugLog.push(`🏆 Step 7: Selecting top ${config.researchers.topCount} researchers (USA-prioritized)...`);
    const topCandidates = selectTopResearchers(authorsWithLocation, config.researchers.topCount);
    debugLog.push(`✓ Selected top ${config.researchers.topCount} researchers`);

    // Step 8: Generate AI fit reasons for top researchers
    debugLog.push(`🤖 Step 8: Generating AI fit reasons for top ${config.researchers.topCount}...`);
    const topResearchers = await generateFitReasons(openaiService, topCandidates, jobDescription, strategies);
    debugLog.push(`✓ Generated AI analysis for all top ${config.researchers.topCount} researchers`);

    // Prepare additional candidates (without AI fit reasons)
    const additionalCandidates = authorsWithLocation
      .filter(a => !topCandidates.find(t => t.name === a.name))
      .slice(0, config.researchers.additionalCount);

    debugLog.push('✅ Complete! Returning results.');

    return NextResponse.json({
      searchStrategies: strategies,
      strategiesUsed,
      topResearchers: topResearchers.map(r => ({
        name: r.name,
        similarityScore: Math.round(r.similarityScore * 100),
        aiRelevanceScore: r.aiRelevanceScore,
        fitReason: r.fitReason,
        location: r.location || 'Unknown',
        affiliation: r.affiliation,
        paper: r.paper,
      })),
      additionalCandidates: additionalCandidates.map(a => ({
        name: a.name,
        similarityScore: Math.round(a.similarityScore * 100),
        location: a.location || 'Unknown',
        affiliation: a.affiliation,
        paper: a.paper,
      })),
      totalPapersAnalyzed: papers.length,
      similarityDebug: {
        stats,
        topPapers: allScores,
      },
      debug: debugLog,
    });

  } catch (error) {
    console.error('Error in find-researchers API:', error);
    debugLog.push(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        debug: debugLog,
      },
      { status: 500 }
    );
  }
}
