import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useWebMCP } from './contexts/WebMCPContext'
import ChartView from './ChartView'
import {
  ArrowUpTrayIcon,
  BoltIcon,
  ChartBarIcon,
  CircleStackIcon,
  PlayIcon,
  SparklesIcon,
  TableCellsIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'

// ---------------------------------------------------------------------------
// Small UI primitives (Tailwind tokens from tailwind.config.js)
// ---------------------------------------------------------------------------
// Icon map - Heroicons (24px outline set, stroke = currentColor)
const ICONS = {
  database: CircleStackIcon,
  bars: ChartBarIcon,
  bolt: BoltIcon,
  table: TableCellsIcon,
  upload: ArrowUpTrayIcon,
  play: PlayIcon,
  trend: ArrowTrendingUpIcon,
  sparkle: SparklesIcon,
}
function Ic({ name, size = 14, className = '' }) {
  const Cmp = ICONS[name]
  if (!Cmp) return null
  return <Cmp className={className} style={{ width: size, height: size }} aria-hidden="true" />
}

function Card({ children, className = '' }) {
  return <div className={`bg-card text-card-foreground rounded-sm shadow-sm border border-border ${className}`}>{children}</div>
}

function Button({ children, variant = 'default', className = '', onClick, disabled, title }) {
  const baseStyle = 'inline-flex items-center justify-center rounded-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none'
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs',
    ghost: 'hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs',
  }
  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}

function Badge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    warning: 'bg-destructive text-destructive-foreground',
  }
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-sm text-[10px] font-semibold ${variants[variant]}`}>
      {children}
    </span>
  )
}

function SectionTitle({ icon, children }) {
  return (
    <div className="flex items-center space-x-2 mb-4">
      <span className="h-6 w-6 rounded-sm bg-secondary flex items-center justify-center text-muted-foreground">
        <Ic name={icon} size={13} />
      </span>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">{children}</h3>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column inference helpers (adaptive analysis over any loaded CSV)
// ---------------------------------------------------------------------------
const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]|$)/
const DIM_PREFS = ['customer_tier', 'region', 'plan', 'industry', 'type', 'category', 'segment', 'channel', 'country', 'status', 'product', 'source']
const MEASURE_PREFS = ['monthly_revenue', 'revenue', 'arr', 'mrr', 'amount', 'total', 'value', 'sales', 'profit', 'nps_score']
const DATE_PREFS = ['customer_since', 'created_date', 'created_at', 'transaction_date', 'order_date', 'date', 'renewal_date', 'signup_date', 'month']
const BOOL_PREFS = ['churn_flag', 'flagged', 'churned', 'is_churn', 'is_churned', 'active']

const q = (ident) => '"' + String(ident).replace(/"/g, '""') + '"'

// DuckDB-WASM serializes DATE columns as epoch-day/ms NUMBERS, so a numeric
// value alone cannot prove a column is a real measure. If the column name
// looks like a date/time field, trust the name and treat it as a date.
// Tokenized to avoid false positives like 'monthly_revenue' or 'yearly_spend'.
const DATE_NAME_RE = /(^|_)(date|day|month|year|time)(_|$)|(^|_)(at|on|since)$/i

function classifyValue(v) {
  if (v instanceof Date) return 'date'
  if (typeof v === 'number') return 'numeric'
  if (typeof v === 'boolean') return 'boolean'
  const s = String(v)
  if (s === 'true' || s === 'false') return 'boolean'
  if (DATE_RE.test(s)) return 'date'
  if (v === null || v === undefined || s === '') return 'null'
  return 'categorical'
}

function inferColumns(sampleRow) {
  const cols = { numeric: [], date: [], boolean: [], categorical: [] }
  if (!sampleRow) return cols
  for (const [name, value] of Object.entries(sampleRow)) {
    const base = classifyValue(value)
    // Epoch numbers from DuckDB DATE columns masquerade as numeric - the
    // column name is the only reliable signal in the sample-row fallback.
    const kind = base === 'numeric' && DATE_NAME_RE.test(name) ? 'date' : base
    if (cols[kind]) cols[kind].push(name)
  }
  return cols
}

function pickByPreference(candidates, prefs) {
  if (!candidates || candidates.length === 0) return null
  for (const p of prefs) {
    const hit = candidates.find((c) => c.toLowerCase() === p || c.toLowerCase().includes(p))
    if (hit) return hit
  }
  return candidates[0]
}

// A measure is only trustworthy if it is a real numeric column. Guards every
// SUM()/ROUND() call from aggregating DATE/epoch or categorical columns.
const numericMeasureOrNull = (schema) => {
  const m = schema && schema.measureCol
  return m && schema.numeric && schema.numeric.includes(m) ? m : null
}

function buildSchema(row) {
  const cols = inferColumns(row)
  return {
    ...cols,
    dimCol: pickByPreference(cols.categorical, DIM_PREFS),
    measureCol: pickByPreference(cols.numeric, MEASURE_PREFS),
    dateCol: pickByPreference(cols.date, DATE_PREFS),
    boolCol: pickByPreference(cols.boolean, BOOL_PREFS) || cols.boolean[0] || null,
    secondNumeric: cols.numeric.length >= 2 ? cols.numeric.find((c) => c !== pickByPreference(cols.numeric, MEASURE_PREFS)) || cols.numeric[1] : null,
  }
}

// Schema from DuckDB's real type system (information_schema/duckdb_columns) -
// reliable vs JS-sample sniffing, which misreads DATE columns typed as epoch-ms numbers.
const NUMERIC_DB_TYPES = new Set(['TINYINT', 'SMALLINT', 'INTEGER', 'BIGINT', 'HUGEINT', 'DECIMAL', 'DOUBLE', 'REAL', 'FLOAT', 'NUMERIC', 'UBIGINT', 'UINTEGER'])
const groupByDbType = (t) => {
  const ty = String(t || '').toUpperCase().split('(')[0].trim()
  if (NUMERIC_DB_TYPES.has(ty)) return 'numeric'
  if (ty.startsWith('DATE') || ty.startsWith('TIMESTAMP') || ty === 'TIME') return 'date'
  if (ty === 'BOOLEAN') return 'boolean'
  return 'categorical'
}

function buildSchemaFromColumns(cols) {
  const grouped = { numeric: [], date: [], boolean: [], categorical: [] }
  for (const c of cols || []) grouped[groupByDbType(c && c.type)].push(c.name)
  return {
    ...grouped,
    dimCol: pickByPreference(grouped.categorical, DIM_PREFS),
    measureCol: pickByPreference(grouped.numeric, MEASURE_PREFS),
    dateCol: pickByPreference(grouped.date, DATE_PREFS),
    boolCol: pickByPreference(grouped.boolean, BOOL_PREFS) || grouped.boolean[0] || null,
    secondNumeric: grouped.numeric.length >= 2 ? grouped.numeric.find((c) => c !== pickByPreference(grouped.numeric, MEASURE_PREFS)) || grouped.numeric[1] : null,
  }
}

const ROW_DISPLAY_CAP = 500

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function App() {
  const {
    isLoading,
    error,
    registerAgent,
    runSQL,
    loadDataset,
    tables,
    chartSpec,
    setChartSpec,
  } = useWebMCP()

  const [activeTab, setActiveTab] = useState('query')
  const [query, setQuery] = useState('')
  const [queryResult, setQueryResult] = useState([])
  const [resultCount, setResultCount] = useState(null)
  const [selectedTable, setSelectedTable] = useState('')
  const [agentEnabled, setAgentEnabled] = useState(false)
  const [busy, setBusy] = useState('')
  const [schemas, setSchemas] = useState({})
  const [notice, setNotice] = useState('')
  const fileInputRef = useRef(null)

  // Start the engine + tool registry once (registerAgent is stable in the context)
  useEffect(() => {
    let cancelled = false
    registerAgent()
      .then(() => {
        if (!cancelled) setAgentEnabled(true)
      })
      .catch(() => {
        if (!cancelled) setAgentEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [registerAgent])

  const showRows = useCallback((rows) => {
    if (!Array.isArray(rows)) {
      setQueryResult([])
      setResultCount(null)
      return
    }
    setResultCount(rows.length)
    setQueryResult(rows.slice(0, ROW_DISPLAY_CAP))
  }, [])

  const previewTable = useCallback(
    async (table) => {
      if (!table) return
      try {
        const rows = await runSQL('SELECT * FROM ' + q(table) + ' LIMIT 5')
        showRows(rows)
        setActiveTab('data')
      } catch (err) {
        console.error('preview error', err)
      }
    },
    [runSQL, showRows],
  )

  // Infer + cache schema whenever a table is selected
  const refreshSchema = useCallback(
    async (table) => {
      if (schemas[table]) return schemas[table]
      try {
        const cols = await runSQL(
          "SELECT column_name AS name, data_type AS type FROM duckdb_columns() WHERE table_name = '" +
            table.replace(/'/g, "''") +
            "' ORDER BY column_index",
        )
        if (Array.isArray(cols) && cols.length > 0) {
          const s = buildSchemaFromColumns(cols)
          setSchemas((prev) => ({ ...prev, [table]: s }))
          return s
        }
      } catch (err) {
        console.error('schema type scan failed', err)
      }
      // Fallback: infer from a single sample row
      try {
        const rows = await runSQL('SELECT * FROM ' + q(table) + ' LIMIT 1')
        const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
        const s = row ? buildSchema(row) : buildSchema(null)
        setSchemas((prev) => ({ ...prev, [table]: s }))
        return s
      } catch (err) {
        console.error('schema fallback failed', err)
        setNotice('Could not scan schema for ' + table + ': ' + (err instanceof Error ? err.message : err))
        return null
      }
    },
    [runSQL, schemas, setNotice],
  )

  useEffect(() => {
    if (selectedTable) refreshSchema(selectedTable)
  }, [selectedTable, refreshSchema])

  const schema = selectedTable ? schemas[selectedTable] : null

  // -------------------------------------------------------------------------
  // Loading datasets
  // -------------------------------------------------------------------------
  const handleFileUpload = async (file) => {
    if (!file) return
    const rawName = file.name.replace(/\.csv$/i, '')
    const tableName = rawName.replace(/[^A-Za-z0-9_]/g, '_').toLowerCase()
    setBusy('Loading ' + file.name + '...')
    setNotice('')
    try {
      await loadDataset({ tableName, file })
      setSelectedTable(tableName)
      setNotice('Loaded ' + file.name + ' (' + tableName + ')')
      await previewTable(tableName)
    } catch (err) {
      console.error('upload error', err)
      setNotice('Upload failed: ' + (err instanceof Error ? err.message : err))
    } finally {
      setBusy('')
    }
  }

  const handleLoadDemo = async (label, url, tableName) => {
    setBusy(label)
    setNotice('')
    try {
      await loadDataset({ tableName, csvUrl: url })
      setSelectedTable(tableName)
      const countRows = await runSQL('SELECT COUNT(*) AS n FROM ' + q(tableName))
      const n = Array.isArray(countRows) && countRows[0] ? Number(countRows[0].n) : 0
      setNotice('Loaded ' + n.toLocaleString() + ' rows into ' + tableName)
      await previewTable(tableName)
    } catch (err) {
      console.error('demo load error', err)
      setNotice('Load failed: ' + (err instanceof Error ? err.message : err))
    } finally {
      setBusy('')
    }
  }

  const handleLoadSample = async () => {
    const sampleCSV = ['customer_id,customer_tier,revenue,churn_flag,created_date']
      .concat(
        [5000, 2500, 1000, 7500, 3000, 6000, 1200, 8000, 2800, 5500].map((rev, i) => {
          const tiers = ['gold', 'silver', 'bronze']
          const flags = [false, true, true, false, false, false, false, true, false, false]
          const d = new Date(2024, (i % 10) + 0, 15)
          const dateStr = d.toISOString().slice(0, 10)
          return i + 1 + ',' + tiers[i % 3] + ',' + rev + ',' + flags[i] + ',' + dateStr
        }),
      )
      .join('\n')
    setBusy('Loading sample...')
    try {
      await loadDataset({ tableName: 'revenue', rawCSV: sampleCSV })
      setSelectedTable('revenue')
      await previewTable('revenue')
      setNotice('Loaded 10-row sample into revenue')
    } catch (err) {
      console.error('sample load error', err)
      setNotice('Load failed: ' + (err instanceof Error ? err.message : err))
    } finally {
      setBusy('')
    }
  }

  // -------------------------------------------------------------------------
  // SQL execution
  // -------------------------------------------------------------------------
  const handleExecuteQuery = async () => {
    if (!query.trim() || busy) return
    setBusy('Running query...')
    try {
      const rows = await runSQL(query)
      showRows(rows)
      setActiveTab('data')
    } catch (err) {
      console.error('SQL Error:', err)
      setQueryResult([{ error: err instanceof Error ? err.message : 'Unknown error' }])
      setResultCount(null)
    } finally {
      setBusy('')
    }
  }

  // -------------------------------------------------------------------------
  // Quick analyses (adaptive to whatever columns the selected table has)
  // -------------------------------------------------------------------------
  const churnBoolExpr = () => {
    const col = schema.boolCol
    if (!col) return null
    // DuckDB parses 'true'/'false' text as BOOLEAN when detect=true; keep both safe
    return 'CASE WHEN ' + q(col) + " = 'true' OR " + q(col) + ' = true THEN 1 ELSE 0 END'
  }

  const handleAnalyzeChurn = async () => {
    const dim = schema.dimCol
    const churn = churnBoolExpr()
    if (!dim || !churn) {
      setNotice('This table has no boolean flag column for churn analysis')
      return
    }
    const measure = numericMeasureOrNull(schema)
    setBusy('Analyzing churn...')
    try {
      const selectParts = [
        q(dim) + ' AS dim',
        'COUNT(*) AS customer_count',
        'ROUND(100.0 * SUM(' + churn + ') / COUNT(*), 2) AS churn_rate_pct',
      ]
      if (measure) selectParts.push('ROUND(SUM(' + q(measure) + '), 2) AS revenue')
      const sqlText =
        'SELECT\n  ' + selectParts.join(',\n  ') + '\nFROM ' + q(selectedTable) + '\n' +
        'GROUP BY ' + q(dim) + '\n' +
        'ORDER BY churn_rate_pct DESC\n' +
        'LIMIT 10'
      const rows = await runSQL(sqlText)
      showRows(rows)
      setChartSpec({
        chart_type: 'bar',
        title: 'Churn Rate by ' + dim,
        x_key: 'dim',
        y_keys: ['churn_rate_pct'],
        data: rows,
      })
      setActiveTab('charts')
    } catch (err) {
      setNotice('Analysis failed: ' + (err instanceof Error ? err.message : err))
    } finally {
      setBusy('')
    }
  }

  const handleRevenueTrends = async () => {
    const dateCol = schema.dateCol
    if (!dateCol) {
      setNotice('This table has no date column for a revenue trend')
      return
    }
    const measure = numericMeasureOrNull(schema)
    setBusy('Building trend...')
    try {
      const valueExpr = measure
        ? 'ROUND(SUM(' + q(measure) + '), 2) AS revenue'
        : 'COUNT(*) AS records'
      const sqlText =
        'SELECT substr(CAST(' + q(dateCol) + ' AS VARCHAR), 1, 7) AS month,\n' +
        '  ' + valueExpr + '\n' +
        'FROM ' + q(selectedTable) + '\n' +
        'GROUP BY 1\n' +
        'ORDER BY 1\n' +
        'LIMIT 36'
      const rows = await runSQL(sqlText)
      showRows(rows)
      setChartSpec({
        chart_type: 'line',
        title: measure ? 'Monthly Revenue Trend (' + measure + ')' : 'Records per Month',
        x_key: 'month',
        y_keys: [measure ? 'revenue' : 'records'],
        data: rows,
      })
      setActiveTab('charts')
    } catch (err) {
      setNotice('Trend failed: ' + (err instanceof Error ? err.message : err))
    } finally {
      setBusy('')
    }
  }

  const handleTopOutliers = async () => {
    const measure = numericMeasureOrNull(schema)
    if (!measure) {
      setNotice('This table has no numeric measure column')
      return
    }
    const dim = schema.dimCol
    setBusy('Finding outliers...')
    try {
      const sqlText =
        'SELECT ' +
        (dim ? q(dim) + ' AS entity, ROUND(SUM(' + q(measure) + '), 2) AS value' : q(measure) + ' AS value') +
        '\nFROM ' +
        q(selectedTable) +
        '\n' +
        (dim ? 'GROUP BY ' + q(dim) + '\n' : '') +
        'ORDER BY value DESC\n' +
        'LIMIT 5'
      const rows = await runSQL(sqlText)
      showRows(rows)
      setChartSpec({
        chart_type: 'bar',
        title: 'Top 5 Outliers by ' + measure,
        x_key: dim ? 'entity' : 'value',
        y_keys: ['value'],
        data: rows,
      })
      setActiveTab('charts')
    } catch (err) {
      setNotice('Outlier scan failed: ' + (err instanceof Error ? err.message : err))
    } finally {
      setBusy('')
    }
  }

  const handleAutoChart = async (type) => {
    const measure = numericMeasureOrNull(schema)
    const dim = schema.dimCol
    const dateCol = schema.dateCol
    setBusy('Rendering ' + type + ' chart...')
    try {
      let rows = []
      let title = ''
      let xKey = ''
      let yKeys = []
      if (type === 'scatter') {
        const c1 = measure || schema.numeric[0]
        const c2 = schema.secondNumeric
        if (!c1 || !c2) {
          setNotice('Need two numeric columns for a scatter plot')
          return
        }
        rows = await runSQL('SELECT ' + q(c1) + ', ' + q(c2) + ' FROM ' + q(selectedTable) + ' LIMIT 300')
        title = c1 + ' vs ' + c2
        xKey = c1
        yKeys = [c2]
      } else if (type === 'line' || type === 'area') {
        if (!dateCol) {
          setNotice('Need a date column for line/area charts')
          return
        }
        const valueExpr = measure
          ? 'ROUND(SUM(' + q(measure) + '), 2) AS value'
          : 'COUNT(*) AS value'
        rows = await runSQL(
          'SELECT substr(CAST(' + q(dateCol) + ' AS VARCHAR), 1, 7) AS month, ' + valueExpr + '\n' +
          'FROM ' + q(selectedTable) + '\nGROUP BY 1\nORDER BY 1\nLIMIT 36',
        )
        title = measure ? measure + ' over time' : 'Records over time'
        xKey = 'month'
        yKeys = ['value']
      } else {
        // bar or pie - if the table has no real numeric measure, chart record
        // counts per category instead of failing on SUM(<non-numeric>).
        if (!dim) {
          setNotice('Need a categorical column for ' + type + ' charts')
          return
        }
        const valueExpr = measure
          ? 'ROUND(SUM(' + q(measure) + '), 2) AS value, COUNT(*) AS count'
          : 'COUNT(*) AS value, COUNT(*) AS count'
        rows = await runSQL(
          'SELECT ' + q(dim) + ' AS label, ' + valueExpr + '\n' +
          'FROM ' + q(selectedTable) + '\nGROUP BY ' + q(dim) + '\nORDER BY value DESC\nLIMIT 10',
        )
        title = measure ? measure + ' by ' + dim : 'Records by ' + dim
        xKey = 'label'
        yKeys = ['value']
      }
      showRows(rows)
      setChartSpec({ chart_type: type, title, x_key: xKey, y_keys: yKeys, data: rows })
      setActiveTab('charts')
    } catch (err) {
      setNotice('Chart failed: ' + (err instanceof Error ? err.message : err))
    } finally {
      setBusy('')
    }
  }

  const selectTable = (table) => {
    setSelectedTable(table)
    previewTable(table)
  }

  // -------------------------------------------------------------------------
  // Derived UI state
  // -------------------------------------------------------------------------
  const hasNum = (schema && schema.numeric.length > 0) || false
  const hasDate = (schema && schema.dateCol) || false
  const hasDim = (schema && schema.dimCol) || false
  const hasBool = (schema && schema.boolCol) || false
  const canTwoNum = (schema && schema.numeric.length >= 2) || false
  const busyFlag = busy !== '' || isLoading

  const engineBadge = agentEnabled
    ? <Badge variant="default">WebMCP Agent Ready</Badge>
    : isLoading
      ? <Badge variant="secondary">Starting engine...</Badge>
      : <Badge variant="warning">Engine offline</Badge>

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center space-x-3">
            <img src="/hyperion-logo.png" alt="Hyperion logo" className="h-8 w-8 rounded-sm object-cover shadow-xs" />
            <div>
              <h1 className="text-[15px] font-bold leading-tight tracking-tight">Hyperion</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">DuckDB-WASM analytics in your browser - zero servers</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {engineBadge}
            <Button variant="outline" onClick={handleLoadSample} disabled={!agentEnabled || busyFlag} title="Load a 10-row sample CSV">
              <Ic name="sparkle" className="mr-1.5 text-muted-foreground" />
              Load Sample
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!agentEnabled || busyFlag} title="Upload your own CSV file">
              <Ic name="upload" className="mr-1.5" />
              Upload CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files && e.target.files[0]
                if (f) handleFileUpload(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 rounded-sm border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded-sm border border-border bg-muted/20 px-4 py-2">
            <p className="text-xs text-muted-foreground">{notice}</p>
          </div>
        )}
        {busy && (
          <div className="mb-4 flex items-center space-x-2 text-xs text-muted-foreground">
            <span className="inline-block h-3 w-3 rounded-full border border-primary border-t-transparent animate-spin" />
            <span>{busy}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-4">
              <SectionTitle icon="table">Tables</SectionTitle>
              {tables.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tables loaded yet</p>
              ) : (
                <div className="space-y-1">
                  {tables.map((table) => (
                    <button
                      key={table}
                      onClick={() => selectTable(table)}
                      className={`w-full text-left px-3 py-2 rounded-sm text-xs font-mono transition-colors ${
                        selectedTable === table ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {table}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-3 border-t border-border space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Demo datasets</p>
                <Button variant="outline" className="w-full justify-start text-xs" onClick={() => handleLoadDemo('Loading SaaS 100k...', '/datasets/stripe_saaSMetrics_100k.csv', 'saas_100k')} disabled={!agentEnabled || busyFlag}>
                  SaaS metrics (100k rows)
                </Button>
                <Button variant="outline" className="w-full justify-start text-xs" onClick={() => handleLoadDemo('Loading Txns 50k...', '/datasets/transactions_50k.csv', 'transactions_50k')} disabled={!agentEnabled || busyFlag}>
                  Transactions (50k rows)
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle icon="bolt">Quick Analysis</SectionTitle>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start text-xs" onClick={handleAnalyzeChurn} disabled={!selectedTable || !hasBool || busyFlag} title={hasBool ? 'Churn rate by tier/segment' : 'Needs a boolean flag column (e.g. churn_flag)'}>
                  Churn rate by segment
                </Button>
                <Button variant="outline" className="w-full justify-start text-xs" onClick={handleRevenueTrends} disabled={!selectedTable || !hasDate || busyFlag} title="Needs a date column">
                  Revenue trend over time
                </Button>
                <Button variant="outline" className="w-full justify-start text-xs" onClick={handleTopOutliers} disabled={!selectedTable || !hasNum || busyFlag} title="Top 5 by largest measure">
                  Top 5 outliers
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle icon="bars">Auto Chart</SectionTitle>
              <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                Picks sensible columns from {selectedTable || 'the selected table'} automatically.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="text-xs" onClick={() => handleAutoChart('bar')} disabled={!selectedTable || !hasDim || busyFlag}>Bar</Button>
                <Button variant="outline" className="text-xs" onClick={() => handleAutoChart('pie')} disabled={!selectedTable || !hasDim || busyFlag}>Pie</Button>
                <Button variant="outline" className="text-xs" onClick={() => handleAutoChart('line')} disabled={!selectedTable || !hasDate || busyFlag}>Line</Button>
                <Button variant="outline" className="text-xs" onClick={() => handleAutoChart('area')} disabled={!selectedTable || !hasDate || busyFlag}>Area</Button>
                <Button variant="outline" className="text-xs" onClick={() => handleAutoChart('scatter')} disabled={!selectedTable || !canTwoNum || busyFlag}>Scatter</Button>
              </div>
              {selectedTable && schema && (
                <div className="mt-3 text-[10px] text-muted-foreground space-y-0.5 font-mono">
                  <p>dim: {schema.dimCol || '-'}</p>
                  <p>measure: {schema.measureCol || '-'}</p>
                  <p>date: {schema.dateCol || '-'}</p>
                  <p>flag: {schema.boolCol || '-'}</p>
                </div>
              )}
            </Card>
          </div>

          {/* Main panel */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center space-x-1 border-b border-border">
              {[
                ['query', 'SQL Query'],
                ['data', 'Results'],
                ['charts', 'Visualizations'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === 'query' && (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <label htmlFor="sql-query" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    SQL Query
                  </label>
                  {selectedTable && (
                    <span className="text-[11px] text-muted-foreground font-mono">on {selectedTable}</span>
                  )}
                </div>
                <textarea
                  id="sql-query"
                  className="flex min-h-[160px] w-full rounded-sm border border-input bg-card px-3 py-2.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 font-mono text-foreground placeholder:text-muted-foreground/60 resize-y"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleExecuteQuery()
                  }}
                  placeholder={'SELECT * FROM ' + (selectedTable || 'saas_100k') + ' LIMIT 10'}
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[11px] text-muted-foreground/80 font-mono hidden sm:block">
                    {selectedTable ? 'Hint: SELECT * FROM ' + selectedTable + ' WHERE ' + (schema?.boolCol || 'churn_flag') + " = true LIMIT 20" : 'Load a table to query'}
                    <span className="ml-2 text-muted-foreground/50">Ctrl+Enter to run</span>
                  </p>
                  <Button onClick={handleExecuteQuery} disabled={!query.trim() || busyFlag} className="shrink-0">
                    <Ic name="play" className="mr-1.5" />
                    Execute Query
                  </Button>
                </div>
              </Card>
            )}

            {activeTab === 'data' && (
              <Card className="p-0 overflow-hidden">
                {queryResult.length > 0 ? (
                  <>
                    <div className="px-4 py-2 border-b border-border bg-secondary/40 text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>
                        {resultCount !== null && resultCount > ROW_DISPLAY_CAP
                          ? 'Showing ' + ROW_DISPLAY_CAP.toLocaleString() + ' of ' + resultCount.toLocaleString() + ' rows'
                          : (resultCount !== null ? resultCount.toLocaleString() : '') + ' row' + (resultCount === 1 ? '' : 's')}
                      </span>
                      {selectedTable && <span className="font-mono">{selectedTable}</span>}
                    </div>
                    <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                      <table className="w-full text-sm text-left dense-table">
                        <thead className="sticky top-0">
                          <tr className="bg-muted">
                            {Object.keys(queryResult[0]).map((key) => (
                              <th key={key} className="px-4 py-3 font-medium border-b border-border">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {queryResult.map((row, idx) => (
                            <tr key={idx} className="hover:bg-muted/30 transition-colors">
                              {Object.values(row).map((value, cellIdx) => (
                                <td key={cellIdx} className="px-4 py-2">
                                  {String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center">
                    <div className="mx-auto mb-3 h-10 w-10 rounded-sm bg-secondary flex items-center justify-center text-muted-foreground/60">
                      <Ic name="table" size={18} />
                    </div>
                    <p className="text-sm text-muted-foreground">No results to display - run a query or pick a table</p>
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'charts' && (
              <div className="space-y-6">
                {chartSpec ? (
                  <Card className="p-5">
                    <ChartView spec={chartSpec} />
                  </Card>
                ) : (
                  <Card className="p-10 text-center">
                    <div className="mx-auto mb-3 h-10 w-10 rounded-sm bg-secondary flex items-center justify-center text-muted-foreground/60">
                      <Ic name="bars" size={18} />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Generate a chart from the Quick Analysis panel, or type into SQL and click a chart button
                    </p>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Tables Loaded</p>
            <p className="text-2xl font-bold mt-1.5 tracking-tight">{tables.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Engine</p>
            <p className="text-2xl font-bold mt-1.5 tracking-tight">DuckDB-WASM</p>
          </Card>
          <Card className="p-4">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Processing</p>
            <p className="text-2xl font-bold mt-1.5 tracking-tight">Client-side</p>
          </Card>
          <Card className="p-4">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Privacy</p>
            <p className="text-2xl font-bold mt-1.5 tracking-tight">0% exfil</p>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default App
