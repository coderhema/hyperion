# Hyperion - In-Browser SQL Analytics Engine

**High-performance SQL analytics running entirely in your browser with DuckDB-WASM**

## 🚀 Tech Stack
- **Database:** DuckDB-WASM (34-40MB WASM files)
- **Query:** WebMCP (Web Model Context Protocol)
- **App Framework:** React 19 + React Router 7
- **Charts:** amCharts 5 (interactive visualizations)
- **Styling:** Tailwind CSS + Astryx Design System
- **Build:** Vite 6 with production optimizations

## ✨ Features

### Core Analytics
- **In-Browser SQL:** Full SQL queries with JOINs, aggregations, and filtering
- **Real-Time Visualization:** Interactive charts that respond to query results
- **Large Dataset Support:** Handles 100k+ rows using efficient DuckDB-WASM processing
- **Multiple Table Support:** Join operations across different schemas

### Smart Features
- **Outlier Detection:** Automatic Z-score analysis for anomaly detection
- **Quick Analysis:** One-click buttons for common analytical queries
- **Responsive Data Tables:** React Table with virtual scrolling and sorting
- **Schema Auto-Discovery:** Automatic table/column scanning on data load

### Demo Experience
- **Pre-loaded Datasets:** 2 demo datasets (100k+ rows each) for immediate testing
- **Interactive Demo Step-by-Step:** "Try the Demo" workflow guides users through features
- **CSV Upload Support:** Users can upload their own CSV files for analysis

### Performance
- **Processed Locally:** All data processing happens in your browser (no server required)
- **Fast Queries:** DuckDB-WASM provides near-native SQL performance
- **Minimal Network:** Only initial assets load, no API calls to backend services

## 📊 Demo Datasets

### SaaS Metrics (100,000 rows)
- Performance metrics and business KPIs
- Columns: various SaaS-related metrics
- Great for trend analysis and outlier detection

### Transactions (50,000 rows) 
- Transaction data for analysis
- Columns: transaction-related fields
- Perfect for join operations and financial analysis

### Sample Queries
```sql
-- Churn rate by segment
SELECT segment, COUNT(*) as customers, 
       AVG(churn_risk) as avg_risk 
FROM saas_metrics 
GROUP BY segment 
ORDER BY avg_risk DESC;

-- Revenue trend over time  
SELECT date_trunc('month', created_at) as month,
       SUM(amount) as revenue
FROM transactions 
GROUP BY month 
ORDER BY month;

-- Top 5 outliers by Z-score
SELECT *, 
       (amount - AVG(amount) OVER()) / STDDEV(amount) OVER() as z_score
FROM transactions 
WHERE amount IS NOT NULL
ORDER BY ABS(z_score) DESC 
LIMIT 5;
```

## 🎯 Use Cases

- **Business Intelligence:** Real-time SQL analytics without bulky BI tools
- **Data Science:** Quick data exploration and visualization in browser
- **Education:** Learn SQL and data analysis with instant feedback
- **Prototyping:** Test analytical queries before implementing in production
- **Privacy-First:** Analyze data locally - nothing leaves your browser

## 🚀 Getting Started

### Quick Start (Pre-built)
1. Download the latest release from GitHub
2. Open `index.html` in any modern browser
3. Start exploring demo datasets or upload your own CSV

### Development Setup
```bash
# Clone repository
git clone https://github.com/coderhema/hyperion.git
cd hyperion

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Generate New Demo Data
```bash
# Generate sample datasets
npm run generate-data
```

## 📦 Deployment

### Self-Contained Bundle
The `npm run build` command generates a complete, self-contained bundle in the `dist/` folder:
- `index.html` - Main application entry point
- `dist/assets/` - All CSS, JS, and WASM files
- No external dependencies required after build

### Deployment Options

#### GitHub Pages (Free)
```bash
# Deploy dist folder to gh-pages branch
git subtree push --prefix dist origin gh-pages
```

#### Netlify (Drag & Drop)
1. Run `npm run build`
2. Drag the `dist/` folder to Netlify dashboard
3. Deploy instantly

#### Static Hosting
The `dist/` folder can be uploaded to any static hosting provider:
- Vercel, Cloudflare Pages, Surge.sh
- AWS S3 + CloudFront
- Your own web server

## 🏗️ Architecture

```
User Interface (React 19)
├── Dashboard View
├── Query Editor  
├── Chart View (amCharts 5)
└── Table View (React Table)

Data Layer (WebMCP + DuckDB-WASM)
├── Schema Scanner
├── SQL Query Engine
├── Data Processor
└── Result Formatter

Supporting Systems
├── CSV Import/Export
├── Responsive Layout (Tailwind)
└── Error Handling
```

## 🔧 Configuration

### Dataset Path
- Demo datasets load from `/sample_data/` relative to app location
- Default files: `saas_metrics.csv`, `transactions.csv`

### Chart Configuration
- amCharts5 auto-scales based on data
- Smart type detection (line, bar, scatter, etc.)
- Responsive resizing for mobile/desktop

## 🎨 Design System

Uses **Astryx Design System** with **Neutral Theme**:
- Modern, clean interface
- High contrast for readability
- Accessible color schemes
- Responsive breakpoints for all screen sizes

## 📱 Responsive Design

- **Desktop:** Full-width dashboard with sidebar
- **Tablet:** Adaptive layout with collapsible panels
- **Mobile:** Stacked layout with hamburger menu
- **Touch:** Optimized for mobile interactions

## 🚧 Performance Notes

### Initial Load
- Pre-bundled assets: ~2.5MB JS + 74MB WASM files
- Training DuckDB-WASM workers: ~2-5 seconds on first load
- Subsequent queries: Near-instant response

### Optimization Status
- ⚠️ Large WASM chunks (>500KB) - consider code-splitting for production
- ✅ React 19 and Vite 6 optimizations active
- ✅ Tree-shaking and minification enabled
- ✅ Lazy loading for large datasets

## 🏆 Hackathon Highlights

✨ **Zero Backend Required** - Everything runs in the browser  
🚀 **Fast Performance** - DuckDB-WASM provides near-native speed  
🔍 **Advanced Analytics** - JOINs, aggregations, outlier detection  
🎨 **Beautiful UI** - Modern design with interactive charts  
📱 **Mobile Ready** - Fully responsive interface  
🔒 **Privacy First** - Data never leaves your browser

## 📝 Technical Details

### Database Features
- DuckDB SQL dialect
- Window functions
- Aggregations (COUNT, SUM, AVG, MAX, MIN, STDDEV)
- GROUP BY, ORDER BY, HAVING
- Transactions and multiple schemas

### Chart Types
- Line charts (time series)
- Bar charts (categorical data)
- Scatter plots (correlations)
- Mixed charts (combinations)

### File Support
- CSV import with auto-detection
- Schema inference
- Data type mapping
- Error handling for invalid formats

## 🔒 Privacy & Security

- **Client-Side Only:** All data processing happens in browser memory
- **No Data Transmission:** Your data never leaves your device
- **Local Storage:** Temporary state only, no persistent storage of user data
- **Open Source:** Code is transparent and auditable

## 🤝 Contributing

This project was developed for a hackathon. Feel free to fork and extend!

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Credits

Built by Tolulope Olugbemi (@coderhema) for the [Hackathon Name]

Technologies:
- [DuckDB-WASM](https://duckdb.org/docs/api/wasm)
- [WebMCP](https://github.com/yourusername/webmcp) 
- [amCharts 5](https://www.amcharts.com/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Ready to ship! 🚀** Use the tag `v1.0.0` for hackathon submission.