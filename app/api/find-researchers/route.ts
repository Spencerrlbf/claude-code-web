import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { XMLParser } from 'fast-xml-parser';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ResearchArea {
  term: string;
  importance: 'high' | 'medium' | 'low';
}

interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  link: string;
}

interface PaperWithEmbedding extends ArxivPaper {
  embedding: number[];
  similarityScore?: number;
}

interface AuthorCandidate {
  name: string;
  paper: ArxivPaper;
  similarityScore: number;
  location?: 'USA' | 'International' | 'Unknown';
  affiliation?: string;
}

interface TopResearcher extends AuthorCandidate {
  aiRelevanceScore: number;
  fitReason: string;
}

// Helper: Calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// Step 1: Extract keywords and create JD embedding
async function extractKeywordsAndEmbedding(jobDescription: string): Promise<{
  keywords: ResearchArea[];
  embedding: number[];
}> {
  // Extract keywords
  const keywordCompletion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert at analyzing job descriptions and extracting specific technical research keywords.

Extract 3-5 VERY SPECIFIC technical terms or research areas from the job description. These will be used to search academic papers.

Rules:
- Use precise technical terms (e.g., "neural networks", "transformer architecture", "reinforcement learning")
- Avoid vague terms (e.g., "AI", "technology", "innovation")
- Prefer multi-word phrases over single words
- Focus on methods, techniques, or specific research domains

Return ONLY a JSON object with this exact format:
{"areas": [{"term": "deep learning", "importance": "high"}, {"term": "computer vision", "importance": "medium"}]}`,
      },
      {
        role: 'user',
        content: `Extract key research areas from this job description:\n\n${jobDescription}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const keywordResult = JSON.parse(keywordCompletion.choices[0].message.content || '{}');
  const keywords = keywordResult.areas || [];

  // Create embedding for full job description
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: jobDescription,
  });

  const embedding = embeddingResponse.data[0].embedding;

  return { keywords, embedding };
}

// Step 2: Search arXiv for papers
async function searchArxivPapers(keywords: ResearchArea[]): Promise<ArxivPaper[]> {
  const searchParts = keywords.slice(0, 3).map(area => {
    const term = area.term.replace(/[^\w\s]/g, '').replace(/\s+/g, '+');
    return `abs:${term}`;
  });

  // Try AND first
  const searchQuery = searchParts.join(' AND ');
  const url = `http://export.arxiv.org/api/query?search_query=${searchQuery}&start=0&max_results=150&sortBy=submittedDate&sortOrder=descending`;

  console.log('arXiv search query:', searchQuery);

  const response = await fetch(url);
  const xmlData = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const result = parser.parse(xmlData);

  // Check if we got enough results
  let entries = result.feed?.entry ? (Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry]) : [];

  // Fallback to OR if we got too few results
  if (entries.length < 50) {
    console.log(`Only got ${entries.length} papers with AND, trying OR...`);
    const fallbackQuery = searchParts.join(' OR ');
    const fallbackUrl = `http://export.arxiv.org/api/query?search_query=${fallbackQuery}&start=0&max_results=150&sortBy=submittedDate&sortOrder=descending`;

    const fallbackResponse = await fetch(fallbackUrl);
    const fallbackXmlData = await fallbackResponse.text();
    const fallbackResult = parser.parse(fallbackXmlData);

    entries = fallbackResult.feed?.entry ? (Array.isArray(fallbackResult.feed.entry) ? fallbackResult.feed.entry : [fallbackResult.feed.entry]) : [];
  }

  console.log(`Found ${entries.length} papers from arXiv`);

  return entries
    .filter((entry: any) => entry && entry.title && entry.summary)
    .map((entry: any) => ({
      id: entry.id,
      title: entry.title?.replace(/\s+/g, ' ').trim() || '',
      authors: Array.isArray(entry.author)
        ? entry.author.map((a: any) => a.name)
        : [entry.author?.name || 'Unknown'],
      summary: entry.summary?.replace(/\s+/g, ' ').trim() || '',
      published: entry.published || '',
      link: entry.id || '',
    }));
}

// Step 3: Create embeddings for all paper abstracts
async function createPaperEmbeddings(papers: ArxivPaper[]): Promise<PaperWithEmbedding[]> {
  console.log(`Creating embeddings for ${papers.length} papers...`);

  const papersWithEmbeddings: PaperWithEmbedding[] = [];

  // Process in batches of 20 to avoid rate limits
  const batchSize = 20;
  for (let i = 0; i < papers.length; i += batchSize) {
    const batch = papers.slice(i, i + batchSize);
    const abstracts = batch.map(p => p.summary);

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: abstracts,
    });

    batch.forEach((paper, idx) => {
      papersWithEmbeddings.push({
        ...paper,
        embedding: embeddingResponse.data[idx].embedding,
      });
    });

    console.log(`Processed ${Math.min(i + batchSize, papers.length)}/${papers.length} papers`);
  }

  return papersWithEmbeddings;
}

// Step 4: Calculate similarity and filter
function filterBySimilarity(
  jdEmbedding: number[],
  papers: PaperWithEmbedding[],
  threshold: number = 0.6
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
    .slice(0, 20) // Top 20 for debugging
    .map(p => ({
      title: p.title,
      score: Math.round((p.similarityScore || 0) * 100) / 100,
    }));

  let filtered = papersWithScores.filter(p => p.similarityScore! >= threshold);

  // If we got too few, progressively lower the threshold
  if (filtered.length < 10) {
    console.log(`Only ${filtered.length} papers above ${threshold}, lowering threshold...`);

    // Try 0.55
    filtered = papersWithScores.filter(p => p.similarityScore! >= 0.55);

    // Try 0.50
    if (filtered.length < 10) {
      console.log(`Only ${filtered.length} papers above 0.55, lowering to 0.50...`);
      filtered = papersWithScores.filter(p => p.similarityScore! >= 0.50);
    }

    // Try 0.45
    if (filtered.length < 10) {
      console.log(`Only ${filtered.length} papers above 0.50, lowering to 0.45...`);
      filtered = papersWithScores.filter(p => p.similarityScore! >= 0.45);
    }

    // Just take top 30 if still too few
    if (filtered.length < 10) {
      console.log(`Still only ${filtered.length} papers, taking top 30 by score...`);
      filtered = papersWithScores.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0)).slice(0, 30);
    }
  }

  // Sort by similarity
  filtered.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));

  // Take top 60 max
  return {
    filtered: filtered.slice(0, 60),
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

  const USA_KEYWORDS = [
    'usa', 'united states', 'u.s.', 'stanford', 'mit', 'berkeley', 'harvard',
    'carnegie mellon', 'princeton', 'yale', 'cornell', 'caltech', 'chicago',
    'columbia', 'michigan', 'washington', 'google', 'microsoft', 'meta',
    'openai', 'anthropic', 'deepmind', 'california', 'new york', 'boston',
    'seattle', 'san francisco', 'cambridge', 'texas', 'georgia', 'illinois',
  ];

  const enrichedAuthors = await Promise.all(
    authors.map(async (author) => {
      try {
        const response = await fetch(
          `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(author.name)}&fields=name,affiliations&limit=1`
        );

        if (!response.ok) {
          return { ...author, location: 'Unknown' as const };
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
          return { ...author, location: 'Unknown' as const };
        }

        const authorData = data.data[0];
        const affiliations = authorData.affiliations || [];

        if (affiliations.length === 0) {
          return { ...author, location: 'Unknown' as const };
        }

        // Check if any affiliation contains USA keywords
        const affiliationText = affiliations.join(' ').toLowerCase();
        const isUSA = USA_KEYWORDS.some(keyword => affiliationText.includes(keyword));

        return {
          ...author,
          location: isUSA ? ('USA' as const) : ('International' as const),
          affiliation: affiliations[0],
        };
      } catch (error) {
        console.error(`Error checking location for ${author.name}:`, error);
        return { ...author, location: 'Unknown' as const };
      }
    })
  );

  return enrichedAuthors;
}

// Step 7: Sort and select top 10
function selectTop10(authors: AuthorCandidate[]): AuthorCandidate[] {
  // Sort: USA first, then Unknown, then International; within each group, by similarity score
  const sorted = authors.sort((a, b) => {
    const locationOrder = { USA: 0, Unknown: 1, International: 2 };
    const locationDiff = locationOrder[a.location || 'Unknown'] - locationOrder[b.location || 'Unknown'];

    if (locationDiff !== 0) return locationDiff;

    return b.similarityScore - a.similarityScore;
  });

  return sorted.slice(0, 10);
}

// Step 8: Generate AI fit reasons for top 10 only
async function generateFitReasons(
  candidates: AuthorCandidate[],
  jobDescription: string,
  keywords: ResearchArea[]
): Promise<TopResearcher[]> {
  const targetAreas = keywords.map(a => a.term).join(', ');
  const topResearchers: TopResearcher[] = [];

  console.log(`Generating AI fit reasons for ${candidates.length} top researchers...`);

  for (const candidate of candidates) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert technical recruiter evaluating researchers for academic/industry positions.

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

Return as JSON: {"score": 75, "reason": "This researcher has extensive experience with X and Y which directly aligns with the position. Their work on Z demonstrates practical application. However, they lack exposure to W mentioned in the job description."}`,
          },
          {
            role: 'user',
            content: `Job Description:
${jobDescription}

Target Research Areas: ${targetAreas}

Research Paper:
Title: ${candidate.paper.title}
Authors: ${candidate.paper.authors.join(', ')}
Abstract: ${candidate.paper.summary.slice(0, 600)}

Evaluate ${candidate.name} for this position.`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      topResearchers.push({
        ...candidate,
        aiRelevanceScore: result.score || 0,
        fitReason: result.reason || 'No reason provided',
      });
    } catch (error) {
      console.error(`Error generating fit reason for ${candidate.name}:`, error);
      topResearchers.push({
        ...candidate,
        aiRelevanceScore: 0,
        fitReason: 'Error generating fit reason',
      });
    }
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

    // Step 1: Extract keywords and create JD embedding
    debugLog.push('🔍 Step 1: Extracting keywords and creating job description embedding...');
    const { keywords, embedding: jdEmbedding } = await extractKeywordsAndEmbedding(jobDescription);
    debugLog.push(`✓ Extracted ${keywords.length} keywords: ${keywords.map(k => k.term).join(', ')}`);

    if (keywords.length === 0) {
      debugLog.push('⚠️  WARNING: No keywords extracted!');
      return NextResponse.json({
        researchAreas: [],
        topResearchers: [],
        additionalCandidates: [],
        debug: debugLog,
        error: 'No research areas could be extracted from the job description',
      });
    }

    // Step 2: Search arXiv
    debugLog.push('📚 Step 2: Searching arXiv for papers...');
    const papers = await searchArxivPapers(keywords);
    debugLog.push(`✓ Found ${papers.length} papers from arXiv`);

    if (papers.length === 0) {
      debugLog.push('⚠️  WARNING: No papers found on arXiv');
      return NextResponse.json({
        researchAreas: keywords,
        topResearchers: [],
        additionalCandidates: [],
        debug: debugLog,
        error: 'No papers found on arXiv for the extracted research areas',
      });
    }

    // Step 3: Create embeddings for papers
    debugLog.push('🧮 Step 3: Creating embeddings for paper abstracts...');
    const papersWithEmbeddings = await createPaperEmbeddings(papers);
    debugLog.push(`✓ Created embeddings for ${papersWithEmbeddings.length} papers`);

    // Step 4: Filter by similarity
    debugLog.push('📊 Step 4: Calculating similarity scores and filtering...');
    const { filtered: filteredPapers, allScores, stats } = filterBySimilarity(jdEmbedding, papersWithEmbeddings, 0.6);

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
        researchAreas: keywords,
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

    // Step 7: Select top 10
    debugLog.push('🏆 Step 7: Selecting top 10 researchers (USA-prioritized)...');
    const top10Candidates = selectTop10(authorsWithLocation);
    debugLog.push(`✓ Selected top 10 researchers`);

    // Step 8: Generate AI fit reasons for top 10 only
    debugLog.push('🤖 Step 8: Generating AI fit reasons for top 10...');
    const topResearchers = await generateFitReasons(top10Candidates, jobDescription, keywords);
    debugLog.push(`✓ Generated AI analysis for all top 10 researchers`);

    // Prepare additional candidates (without AI fit reasons)
    const additionalCandidates = authorsWithLocation
      .filter(a => !top10Candidates.find(t => t.name === a.name))
      .slice(0, 20); // Return up to 20 additional candidates

    debugLog.push('✅ Complete! Returning results.');

    return NextResponse.json({
      researchAreas: keywords,
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
