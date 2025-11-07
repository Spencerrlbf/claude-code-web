'use client';

import { useState } from 'react';

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

interface TopResearcher {
  name: string;
  similarityScore: number;
  aiRelevanceScore: number;
  fitReason: string;
  location: 'USA' | 'International' | 'Unknown';
  affiliation?: string;
  paper: ArxivPaper;
}

interface AdditionalCandidate {
  name: string;
  similarityScore: number;
  location: 'USA' | 'International' | 'Unknown';
  affiliation?: string;
  paper: ArxivPaper;
}

interface ApiResponse {
  researchAreas: ResearchArea[];
  topResearchers: TopResearcher[];
  additionalCandidates: AdditionalCandidate[];
  totalPapersAnalyzed: number;
  similarityDebug?: {
    stats: { min: number; max: number; avg: number; median: number; };
    topPapers: { title: string; score: number; }[];
  };
  debug?: string[];
  error?: string;
}

// Location badge component
function LocationBadge({ location }: { location: 'USA' | 'International' | 'Unknown' }) {
  const styles = {
    USA: 'bg-blue-100 text-blue-800 border-blue-300',
    International: 'bg-purple-100 text-purple-800 border-purple-300',
    Unknown: 'bg-gray-100 text-gray-600 border-gray-300',
  };

  const icons = {
    USA: '🇺🇸',
    International: '🌍',
    Unknown: '❓',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[location]}`}>
      {icons[location]} {location}
    </span>
  );
}

export default function Home() {
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jobDescription.trim()) {
      setError('Please enter a job description');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/find-researchers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobDescription }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to find researchers');
      }

      const data = await response.json();
      setResults(data);

      // If API returned an error message but still gave us debug info
      if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            AI Researcher Finder
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Find the perfect researchers for your position. Using AI embeddings to semantically match job descriptions with arXiv papers.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <form onSubmit={handleSubmit}>
            <label htmlFor="jobDescription" className="block text-lg font-semibold text-gray-700 mb-3">
              Job Description
            </label>
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste your job description here..."
              className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-gray-800"
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-4 px-6 rounded-lg transition duration-200 text-lg"
            >
              {loading ? 'Finding Researchers...' : 'Find Researchers'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">
              Analyzing papers with AI embeddings and scoring researchers...
              <br />
              <span className="text-sm text-gray-500">This may take 1-2 minutes</span>
            </p>
          </div>
        )}

        {/* Debug Log */}
        {results?.debug && results.debug.length > 0 && (
          <div className="bg-gray-900 rounded-lg shadow-lg p-6 mb-8 font-mono text-sm">
            <h3 className="text-lg font-bold text-green-400 mb-4">📊 Processing Log</h3>
            <div className="space-y-2">
              {results.debug.map((log, idx) => (
                <div key={idx} className="text-gray-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similarity Debug */}
        {results?.similarityDebug && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg shadow-lg p-6 mb-8">
            <h3 className="text-xl font-bold text-yellow-900 mb-4">🔍 Similarity Score Analysis (Debug)</h3>

            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Minimum</div>
                <div className="text-2xl font-bold text-gray-900">
                  {results.similarityDebug.stats.min.toFixed(3)}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Maximum</div>
                <div className="text-2xl font-bold text-gray-900">
                  {results.similarityDebug.stats.max.toFixed(3)}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Average</div>
                <div className="text-2xl font-bold text-gray-900">
                  {results.similarityDebug.stats.avg.toFixed(3)}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Median</div>
                <div className="text-2xl font-bold text-gray-900">
                  {results.similarityDebug.stats.median.toFixed(3)}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">
                Top 10 Papers by Similarity Score:
              </h4>
              <div className="space-y-2">
                {results.similarityDebug.topPapers.slice(0, 10).map((paper, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-3 rounded-lg flex items-start gap-3"
                  >
                    <div className="flex-shrink-0">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                        paper.score >= 0.6
                          ? 'bg-green-100 text-green-800'
                          : paper.score >= 0.5
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {paper.score.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex-1 text-sm text-gray-700">
                      {paper.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 p-4 bg-yellow-100 rounded-lg">
              <p className="text-sm text-yellow-900">
                <strong>What this means:</strong> Similarity scores range from 0 (completely different) to 1 (identical).
                Scores above 0.6 are considered good matches. If all scores are low (below 0.5), the papers may not be
                semantically related to the job description, or the threshold needs adjustment.
              </p>
            </div>
          </div>
        )}

        {/* Results Section */}
        {results && !loading && (
          <div className="space-y-8">
            {/* Research Areas */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Identified Research Areas
              </h2>
              <div className="flex flex-wrap gap-2">
                {results.researchAreas.map((area, idx) => (
                  <span
                    key={idx}
                    className={`px-4 py-2 rounded-full text-sm font-medium ${
                      area.importance === 'high'
                        ? 'bg-indigo-100 text-indigo-800'
                        : area.importance === 'medium'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {area.term}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Analyzed {results.totalPapersAnalyzed} papers from arXiv using semantic similarity
              </p>
            </div>

            {/* Top 10 Researchers */}
            {results.topResearchers.length > 0 && (
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  🏆 Top 10 Researchers
                </h2>
                <div className="space-y-6">
                  {results.topResearchers.map((researcher, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition duration-200 border-l-4 border-indigo-500"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl font-bold text-indigo-600">
                              #{idx + 1}
                            </span>
                            <h3 className="text-xl font-bold text-gray-900">
                              {researcher.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <LocationBadge location={researcher.location} />
                            {researcher.affiliation && (
                              <span className="text-sm text-gray-600">
                                {researcher.affiliation}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                              {researcher.similarityScore}% Similarity
                            </span>
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                              {researcher.aiRelevanceScore}/100 AI Score
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4 p-4 bg-blue-50 rounded-lg border-l-4 border-indigo-500">
                        <p className="text-sm font-semibold text-gray-700 mb-1">
                          Why they're a good fit:
                        </p>
                        <p className="text-gray-700">{researcher.fitReason}</p>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          Recent Paper:
                        </h4>
                        <a
                          href={researcher.paper.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                        >
                          {researcher.paper.title}
                        </a>
                        <p className="text-sm text-gray-500 mt-2">
                          Co-authors: {researcher.paper.authors.slice(1).join(', ') || 'Solo author'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Published: {new Date(researcher.paper.published).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Candidates */}
            {results.additionalCandidates.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  📋 Additional Candidates
                </h2>
                <p className="text-gray-600 mb-4">
                  More researchers with relevant papers (no AI analysis to save costs)
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  {results.additionalCandidates.map((candidate, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-lg shadow p-4 hover:shadow-md transition duration-200"
                    >
                      <div className="mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {candidate.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <LocationBadge location={candidate.location} />
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                            {candidate.similarityScore}% Match
                          </span>
                        </div>
                        {candidate.affiliation && (
                          <p className="text-sm text-gray-600 mt-1">
                            {candidate.affiliation}
                          </p>
                        )}
                      </div>
                      <div className="text-sm">
                        <a
                          href={candidate.paper.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                        >
                          {candidate.paper.title}
                        </a>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(candidate.paper.published).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* How It Works Section */}
        {!results && !loading && (
          <div className="bg-white rounded-lg shadow-lg p-8 mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">How It Works</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl mx-auto mb-3">
                  1
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">AI Embedding</h3>
                <p className="text-sm text-gray-600">
                  Create semantic embedding of your job description using OpenAI
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl mx-auto mb-3">
                  2
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Search 100+ Papers</h3>
                <p className="text-sm text-gray-600">
                  Find recent arXiv papers and compute similarity with your JD
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl mx-auto mb-3">
                  3
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Check Location</h3>
                <p className="text-sm text-gray-600">
                  Verify author affiliations via Semantic Scholar API
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl mx-auto mb-3">
                  4
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">AI Analysis</h3>
                <p className="text-sm text-gray-600">
                  Generate detailed fit reasons for top 10 USA-prioritized candidates
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
