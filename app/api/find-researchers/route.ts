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
import { createOpenAIService } from '@/lib/services/openai-service';
import { createArxivService } from '@/lib/services/arxiv-service';
import { semanticScholarService } from '@/lib/services/semantic-scholar-service';
import {
  generateSearchStrategies,
  executeSearchStrategies,
} from '@/lib/core/search-strategy';
import { matchPapers } from '@/lib/core/paper-matching';
import { enrichWithLocation } from '@/lib/core/location-enrichment';

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

// Step 4: Calculate similarity and filter - Now handled by paper-matching module

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

// Step 6: Check USA location via Semantic Scholar - Now handled by location-enrichment module

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
    const strategies = await generateSearchStrategies(jobDescription, openaiService);
    const jdEmbedding = await openaiService.createEmbedding(jobDescription);
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
    const { papers, strategiesUsed } = await executeSearchStrategies(strategies, arxivService);
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

    // Step 4: Filter by similarity using new paper-matching module
    debugLog.push('📊 Step 4: Calculating similarity scores and filtering...');
    const matchResult = matchPapers(jdEmbedding, papersWithEmbeddings, {
      useAdaptive: true,
      minPapers: config.similarity.minPapersAbsolute,
      maxPapers: config.similarity.maxPapers,
      includeDebug: true,
    });

    const { filteredPapers, stats, threshold, allPapersWithScores } = matchResult;

    // Create allScores for debugging (top N papers)
    const allScores = allPapersWithScores
      .slice(0, config.debug.topScoresCount)
      .map(p => ({
        title: p.title,
        score: Math.round((p.similarityScore || 0) * 100) / 100,
      }));

    // Add detailed similarity debugging
    debugLog.push(`✓ Similarity Score Stats:`);
    debugLog.push(`   - Min: ${stats.min.toFixed(3)}, Max: ${stats.max.toFixed(3)}`);
    debugLog.push(`   - Avg: ${stats.avg.toFixed(3)}, Median: ${stats.median.toFixed(3)}`);
    debugLog.push(`   - Adaptive Threshold: ${threshold.toFixed(3)}`);
    debugLog.push(`✓ Top 5 papers by similarity:`);
    allScores.slice(0, 5).forEach((paper: { title: string; score: number }, idx: number) => {
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

    // Step 6: Check USA location using location-enrichment module
    debugLog.push('🌍 Step 6: Checking author locations via Semantic Scholar...');
    const { enrichedAuthors: authorsWithLocation, stats: locationStats } = await enrichWithLocation(
      allAuthors,
      {
        maxConcurrent: 5,
        timeoutMs: 5000,
        continueOnError: true,
      }
    );

    debugLog.push(
      `✓ Location enrichment complete: ${locationStats.enriched}/${locationStats.total} successful ` +
      `(${locationStats.usa} USA, ${locationStats.international} International, ${locationStats.unknown} Unknown)`
    );

    if (locationStats.failed > 0) {
      debugLog.push(`⚠️  ${locationStats.failed} author location lookups failed but continued`);
    }

    // Map enriched authors back to AuthorCandidate format (with location and affiliation)
    const authorsWithLocationMapped = authorsWithLocation.map(author => ({
      ...author,
      affiliation: author.affiliations?.[0],
    }));

    // Step 7: Select top N researchers
    debugLog.push(`🏆 Step 7: Selecting top ${config.researchers.topCount} researchers (USA-prioritized)...`);
    const topCandidates = selectTopResearchers(authorsWithLocationMapped, config.researchers.topCount);
    debugLog.push(`✓ Selected top ${config.researchers.topCount} researchers`);

    // Step 8: Generate AI fit reasons for top researchers
    debugLog.push(`🤖 Step 8: Generating AI fit reasons for top ${config.researchers.topCount}...`);
    const topResearchers = await generateFitReasons(openaiService, topCandidates, jobDescription, strategies);
    debugLog.push(`✓ Generated AI analysis for all top ${config.researchers.topCount} researchers`);

    // Prepare additional candidates (without AI fit reasons)
    const additionalCandidates = authorsWithLocationMapped
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
