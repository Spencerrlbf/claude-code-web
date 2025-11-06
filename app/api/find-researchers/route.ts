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
        content: 'You are an expert at analyzing job descriptions and extracting key research areas. Extract 3-5 specific research terms or areas that would be relevant for finding researchers. Return ONLY a JSON object with an "areas" array. Format: {"areas": [{"term": "machine learning", "importance": "high"}, {"term": "deep learning", "importance": "high"}]}',
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
  // Build search query - search in title and abstract
  const searchParts = researchAreas.map(area => {
    const term = area.term.replace(/[()]/g, ''); // Remove special chars
    return `(ti:${term} OR abs:${term})`;
  });
  const searchQuery = searchParts.join(' OR ');
  const encodedQuery = encodeURIComponent(searchQuery);

  // Search arXiv API - get 50 recent papers to have enough to score
  const url = `http://export.arxiv.org/api/query?search_query=${encodedQuery}&start=0&max_results=50&sortBy=submittedDate&sortOrder=descending`;

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
    console.log('Feed data:', JSON.stringify(result.feed, null, 2));
    return [];
  }

  const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
  console.log(`Found ${entries.length} papers from arXiv`);

  return entries
    .filter((entry: any) => entry && entry.title)
    .map((entry: any) => ({
      id: entry.id,
      title: entry.title,
      authors: Array.isArray(entry.author)
        ? entry.author.map((a: any) => a.name)
        : [entry.author?.name || 'Unknown'],
      summary: entry.summary || '',
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

  // Process papers in batches to avoid rate limits
  for (const paper of papers) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at evaluating researcher fit for positions. Given a job description and a research paper, provide:
1. A relevance score (0-100)
2. A brief explanation (2-3 sentences) of why this researcher would be a good fit

Return as JSON: {"score": 85, "reason": "..."}`,
          },
          {
            role: 'user',
            content: `Job Description:\n${jobDescription}\n\nResearch Paper:\nTitle: ${paper.title}\nAuthors: ${paper.authors.join(', ')}\nAbstract: ${paper.summary.slice(0, 500)}...\n\nEvaluate the lead author's fit for this position.`,
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
