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

interface ScoredResearcher {
  name: string;
  paper: ArxivPaper;
  relevanceScore: number;
  fitReason: string;
}

interface ApiResponse {
  researchAreas: ResearchArea[];
  researchers: ScoredResearcher[];
  totalPapersAnalyzed: number;
  debug?: string[];
  error?: string;
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
            Find the perfect researchers for your position. Paste a job description and we'll analyze arXiv papers to match you with top talent.
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
            <p className="mt-4 text-gray-600">Analyzing papers and scoring researchers...</p>
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
                Analyzed {results.totalPapersAnalyzed} papers from arXiv
              </p>
            </div>

            {/* Top Researchers */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Top 10 Researchers
              </h2>
              <div className="space-y-6">
                {results.researchers.map((researcher, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition duration-200"
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
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                            {researcher.relevanceScore}% Match
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
                <h3 className="font-semibold text-gray-900 mb-2">Paste Job Description</h3>
                <p className="text-sm text-gray-600">
                  Enter your job posting or research position description
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl mx-auto mb-3">
                  2
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Extract Research Areas</h3>
                <p className="text-sm text-gray-600">
                  AI identifies key research topics and technical areas
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl mx-auto mb-3">
                  3
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Search arXiv Papers</h3>
                <p className="text-sm text-gray-600">
                  Find recent publications matching those research areas
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl mx-auto mb-3">
                  4
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Score & Rank</h3>
                <p className="text-sm text-gray-600">
                  AI evaluates fit and generates personalized summaries
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
