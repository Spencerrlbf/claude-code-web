# AI Researcher Finder

A Next.js application that uses AI embeddings and semantic search to match research papers from arXiv with job descriptions, helping you find the perfect researchers for academic or industry positions.

## Getting Started

### Prerequisites
- Node.js 20+
- npm/yarn/pnpm/bun
- OpenAI API key

### Installation

1. Clone the repository
```bash
git clone git@github.com:Spencerrlbf/claude-code-web.git
cd claude-code-web
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your OpenAI API key:
```env
OPENAI_API_KEY=sk-...
```

4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## How It Works

1. **Paste a job description** - Input the requirements for your position
2. **AI generates search strategies** - Creates 3-5 intelligent search approaches
3. **Multi-source paper search** - Finds 100-200+ relevant papers from arXiv
4. **Semantic matching** - Uses embeddings to calculate relevance
5. **Location enrichment** - Identifies USA-based researchers via Semantic Scholar
6. **AI evaluation** - Generates detailed fit analysis for top 10 candidates

## Technology Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Modern styling
- **OpenAI API** - Embeddings and chat completions
- **arXiv API** - Research paper source
- **Semantic Scholar API** - Author metadata and citations

## Development

```bash
# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

## Project Status

🚧 **Active Development** - Currently in refactoring phase to improve modularity and matching algorithms.

See `TODO.md` for detailed roadmap and `CLAUDE.md` for comprehensive project documentation.

## License

Private project - All rights reserved
