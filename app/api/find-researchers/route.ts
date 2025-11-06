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

interface ScoredResearcher {
  name: string;
  paper: ArxivPaper;
  relevanceScore: number;
  fitReason: string;
}

// Step 1: Extract key research areas from job description
async function extractResearchAreas(jobDescription: string): Promise<ResearchArea[]> {
  const completion = await openai.chat.completions.create({
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

  const result = JSON.parse(completion.choices[0].message.content || '{}');
  console.log('Extracted research areas:', result);
  return result.areas || [];
}

// Step 2: Search arXiv for papers using research terms
async function searchArxivPapers(researchAreas: ResearchArea[]): Promise<ArxivPaper[]> {
  // Build search query using arXiv API format
  // Combine terms with AND to find papers covering multiple areas
  const searchParts = researchAreas.slice(0, 3).map(area => {
    // Clean the term and replace spaces with +
    const term = area.term.replace(/[^\w\s]/g, '').replace(/\s+/g, '+');
    return `abs:${term}`;
  });

  // Use AND to find papers that cover multiple research areas
  const searchQuery = searchParts.join(' AND ');

  // Search arXiv API - get recent papers, sorted by submission date
  const url = `http://export.arxiv.org/api/query?search_query=${searchQuery}&start=0&max_results=30&sortBy=submittedDate&sortOrder=descending`;

  console.log('arXiv search query:', searchQuery);
  console.log('arXiv search URL:', url);

  const response = await fetch(url);
  const xmlData = await response.text();

  console.log('arXiv response length:', xmlData.length);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const result = parser.parse(xmlData);

  // Check if we got any results
  if (!result.feed || !result.feed.entry) {
    console.log('No entries found in arXiv response');
    console.log('Feed total results:', result.feed?.['opensearch:totalResults']);

    // Try a fallback with OR instead of AND if AND returned nothing
    const fallbackQuery = searchParts.join(' OR ');
    const fallbackUrl = `http://export.arxiv.org/api/query?search_query=${fallbackQuery}&start=0&max_results=30&sortBy=submittedDate&sortOrder=descending`;

    console.log('Trying fallback query with OR:', fallbackQuery);

    const fallbackResponse = await fetch(fallbackUrl);
    const fallbackXmlData = await fallbackResponse.text();
    const fallbackResult = parser.parse(fallbackXmlData);

    if (!fallbackResult.feed || !fallbackResult.feed.entry) {
      return [];
    }

    const fallbackEntries = Array.isArray(fallbackResult.feed.entry)
      ? fallbackResult.feed.entry
      : [fallbackResult.feed.entry];
    console.log(`Fallback found ${fallbackEntries.length} papers from arXiv`);

    return fallbackEntries
      .filter((entry: any) => entry && entry.title)
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

  const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
  console.log(`Found ${entries.length} papers from arXiv`);

  return entries
    .filter((entry: any) => entry && entry.title)
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

// Step 3: Score papers and generate fit reasons
async function scoreAndRankPapers(
  papers: ArxivPaper[],
  jobDescription: string,
  researchAreas: ResearchArea[]
): Promise<ScoredResearcher[]> {
  const scoredResearchers: ScoredResearcher[] = [];
  const targetAreas = researchAreas.map(a => a.term).join(', ');

  // Process papers in batches to avoid rate limits
  for (const paper of papers) {
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
Title: ${paper.title}
Authors: ${paper.authors.join(', ')}
Abstract: ${paper.summary.slice(0, 600)}

Evaluate the lead author (${paper.authors[0]}) for this position.`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      scoredResearchers.push({
        name: paper.authors[0], // Lead author
        paper: paper,
        relevanceScore: result.score || 0,
        fitReason: result.reason || 'No reason provided',
      });
    } catch (error) {
      console.error(`Error scoring paper ${paper.id}:`, error);
      // Continue with next paper
    }
  }

  // Sort by relevance score and return top 10
  return scoredResearchers
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);
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

    // Step 1: Extract research areas
    debugLog.push('🔍 Step 1: Extracting research areas from job description...');
    const researchAreas = await extractResearchAreas(jobDescription);
    debugLog.push(`✓ Extracted ${researchAreas.length} research areas: ${researchAreas.map(a => a.term).join(', ')}`);
    console.log('Research areas:', researchAreas);

    if (researchAreas.length === 0) {
      debugLog.push('⚠️  WARNING: No research areas extracted! Cannot search arXiv.');
      return NextResponse.json({
        researchAreas: [],
        researchers: [],
        totalPapersAnalyzed: 0,
        debug: debugLog,
        error: 'No research areas could be extracted from the job description',
      });
    }

    // Step 2: Search arXiv papers
    debugLog.push('📚 Step 2: Searching arXiv for relevant papers...');
    const papers = await searchArxivPapers(researchAreas);
    debugLog.push(`✓ Found ${papers.length} papers from arXiv`);
    console.log(`Found ${papers.length} papers`);

    if (papers.length === 0) {
      debugLog.push('⚠️  WARNING: No papers found on arXiv matching those research areas.');
      return NextResponse.json({
        researchAreas,
        researchers: [],
        totalPapersAnalyzed: 0,
        debug: debugLog,
        error: 'No papers found on arXiv for the extracted research areas',
      });
    }

    // Step 3: Score and rank papers
    debugLog.push(`🤖 Step 3: Scoring ${papers.length} papers with AI (this may take 1-2 minutes)...`);
    const topResearchers = await scoreAndRankPapers(papers, jobDescription, researchAreas);
    debugLog.push(`✓ Scored all papers, selected top ${topResearchers.length} researchers`);
    console.log(`Scored ${topResearchers.length} researchers`);

    // Step 4: Return results
    debugLog.push('✅ Complete! Returning results.');
    return NextResponse.json({
      researchAreas,
      researchers: topResearchers,
      totalPapersAnalyzed: papers.length,
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
