# Hyperion - In-Browser SQL Analytics Engine

**Tagline**: In-browser SQL engine and analytics canvas powered by DuckDB-WASM and WebMCP

## Overview

Hyperion is an enterprise-grade analytics platform that runs entirely in the browser using DuckDB-WASM for lightning-fast SQL processing and WebMCP for AI agent integration. No data leaves your browser - complete privacy, zero server costs.

> **Key Features**
> - 100% client-side processing with DuckDB-WASM
> - WebMCP agent protocol for AI copilot integration
> - Astryx-inspired design system (neutral theme)
> - SQL query execution, charting, pivot views, and metrics
> - Supports CSV, Parquet datasets

## Architecture

```
Browser (Client)
  ├── React + Vite (UI)
  ├── Tailwind CSS (Astryx-inspired design)
  ├── DuckDB-WASM (in-memory SQL engine)
  ├── Recharts (interactive visualizations)
  └── WebMCP (Agent Protocol)
```

## Demo Script (3 minutes)

### 0:00 - 0:30 |Problem Statement
Cloud BI tools are slow, expensive, and leak sensitive PII. Hyperion runs DuckDB in-browser via WebMCP for zero-latency analytics with zero data exfiltration.

### 0:30 - 1:15 |Ingest & SQL
1. Load a 100k-row Stripe/SaaS metrics CSV (drag & drop)
2. Prompt: "Inspect revenue retention and break down churn by customer tier"
3. Agent executes DuckDB SQL in under 50ms

### 1:15 - 2:00 |Dynamic Visualizer
1. Agent calls `render_chart` to plot cohort retention curves
2. Bar charts for churn by tier, line charts for revenue trends
3. Interactive charts rendered directly on Astryx canvas

### 2:00 - 2:40 |Deep Dive / Anomaly Detection
1. Prompt: "Find top 5 outlier accounts driving expansion"
2. Agent computes variance, flags anomalies, updates table view
3. Sensitivity projections built on fly

### 2:40 - 3:00 |Wrap Up
- Zero server costs (all client-side)
- Total privacy (data never leaves browser)
- Open WebMCP extensibility

## WebMCP Tools

| Tool | Description |
|------|-------------|
| `load_dataset` | Loads CSV/Parquet into in-memory DuckDB table |
| `run_sql` | Executes ANSI-SQL queries, returns tabular JSON |
| `render_chart` | Renders interactive charts (bar, line, area, scatter, pie) |
| `compute_metrics` | Calculates mean, median, p95, null count, stddev |
| `create_pivot_view` | Dynamic pivot summary aggregation |

## Quick Start

```bash
# Install dependencies
npm install

# Generate demo dataset (100k rows)
npm run generate-data

# Start dev server
npm run dev
```

## Project Structure

```
hyperion/
├── src/
│   ├── App.tsx                    # Main UI component
│   ├── main.tsx                   # App entry point
│   ├── contexts/
│   │   └── WebMCPContext.tsx      # WebMCP provider and agent
│   ├── lib/
│   │   └── hyperionAgent.ts     # Agent implementation
│   └── index.css                  # Tailwind + styles
├── scripts/
│   └── generate-demo-dataset.cjs  # Dataset generator
├── sample_data/
│   ├── stripe_saaSMetrics_100k.csv
│   └── transactions_50k.csv
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite |
| Styling | Tailwind CSS (Astryx-inspired) |
| Database | DuckDB-WASM |
| Charts | Recharts |
| Agent Protocol | WebMCP |
| Build | TypeScript + Vite |

## Running the Agent

The Hyperion Copilot agent registers 5 WebMCP tools on initialization:

```typescript
const agent = await createHyperionAgent()
await agent.client.registerTool('load_dataset', ..., loadDatasetHandler)
await agent.client.registerTool('run_sql', ..., runSQLHandler)
// ... 3 more tools
```

## Demo Commands

### Start Development
```bash
npm run dev
```

### Generate Sample Data
```bash
npm run generate-data
# Output: sample_data/stripe_saaSMetrics_100k.csv
```

### Build for Production
```bash
npm run build
npm run preview
```

## Browser Compatibility

- Chrome/Edge: Full support (Web Worker + WASM)
- Firefox: Full support
- Safari: Full support
- Minimum: Chrome 91+, Firefox 88+, Safari 14.1+

## License

MIT - for the webmcp-hackathon submission

## Demo Submission

This project was built for the OpenAI WebMCP Challenge.

**Project Name**: Hyperion (or DuckTable WebMCP)  
**Handler**: coderhema (Tolulope Olugbemi)  
**Email**: olugbemiopedepo@gmail.com

## Acknowledgments

- DuckDB team for the incredible WASM implementation
- OpenAI for the WebMCP agent protocol
- Astryx design system for the clean UI patterns
