/**
 * WebMCP Context for Hyperion
 * Provides the DuckDB-WASM engine and tool registry to React components.
 *
 * WebMCP (Web Model Context Protocol) implementation:
 * - Tools are registered in a main-thread registry (handlers close over the live
 *   DuckDB connection) and mirrored to an in-memory agent worker for protocol
 *   facades. invokeTool resolves against the registry so agent calls actually run.
 *
 * DuckDB-WASM v1.32 API notes (do not revert to the old demo API):
 * - AsyncDuckDB is created with `new AsyncDuckDB(logger, worker)`, then
 *   `await db.instantiate(wasmUrl, pthreadWorkerUrl)` and `await db.connect()`.
 * - There is NO `conn.loadCSV()`. Register file text/buffer/handle on the DB,
 *   then call `conn.insertCSVFromPath(name, { name: table, header: true, detect: true })`.
 * - `conn.query()` returns an apache-arrow Table, not plain objects. Convert rows
 *   with `table.toArray().map(r => r.toJSON())` before handing them to the UI.
 */
import React, { useState, createContext, useContext, useCallback, useRef, useEffect } from 'react'
import * as duckdb from '@duckdb/duckdb-wasm'
import ehWasmUrl from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import ehWorkerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import mvpWasmUrl from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvpWorkerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'

const WebMCPContext = createContext(undefined)

// ---------------------------------------------------------------------------
// In-memory WebMCP agent worker (protocol facade)
// ---------------------------------------------------------------------------
const agentScript = `
const tools = {}

self.onmessage = async (event) => {
  const { id, type, name, args } = event.data

  if (type === 'register') {
    self.postMessage({ id, type: 'registered', name })
    return
  }

  if (type === 'invoke') {
    const handler = tools[name]
    if (!handler) {
      self.postMessage({ id, type: 'error', name, error: 'unknown tool: ' + name })
      return
    }
    try {
      const result = await handler(args)
      self.postMessage({ id, type: 'result', name, result })
    } catch (err) {
      self.postMessage({ id, type: 'error', name, error: err.message })
    }
  }
}

self.registerTool = (name, handler) => {
  tools[name] = handler
  self.postMessage({ type: 'tool_registered', name })
}
`

const workerBlob = new Blob([agentScript], { type: 'application/javascript' })
const workerUrl = URL.createObjectURL(workerBlob)

// ---------------------------------------------------------------------------
// Result conversion helpers
// ---------------------------------------------------------------------------
function arrowToRows(table) {
  if (!table || typeof table.toArray !== 'function') return table || []
  return table.toArray().map((row) => {
    if (row && typeof row.toJSON === 'function') return row.toJSON()
    if (row && typeof row === 'object') return { ...row }
    return row
  })
}

// Safe identifier quoting for DuckDB (user CSV headers can contain spaces etc.)
const q = (ident) => '"' + String(ident).replace(/"/g, '""') + '"'

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function Provider({ children }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tables, setTables] = useState([])
  const [chartSpec, setChartSpec] = useState(null)

  // Refs hold mutable engine/tool state so callbacks stay stable (no re-render loops)
  const dbRef = useRef(null)          // AsyncDuckDB
  const connRef = useRef(null)        // AsyncDuckDBConnection
  const agentWorkerRef = useRef(null) // WebMCP agent worker
  const toolsRef = useRef(new Map())  // name -> handler (main-thread registry)
  const messageIdRef = useRef(0)
  const pendingRef = useRef(new Map())
  const initPromiseRef = useRef(null) // memoized engine init

  // Create + register the WebMCP agent worker once
  useEffect(() => {
    const worker = new Worker(workerUrl)
    agentWorkerRef.current = worker

    worker.onmessage = (event) => {
      const { id, type, error: workerError, result } = event.data
      if (type === 'result' || type === 'error') {
        const pending = pendingRef.current.get(id)
        if (pending) {
          pendingRef.current.delete(id)
          clearTimeout(pending.timeout)
          if (workerError) pending.reject(new Error(workerError))
          else pending.resolve(result)
        }
      }
    }

    return () => {
      worker.terminate()
      URL.revokeObjectURL(workerUrl)
      if (dbRef.current) {
        try { dbRef.current.terminate?.() } catch { /* noop */ }
      }
    }
  }, [])

  // -------------------------------------------------------------------------
  // Engine initialization (lazy, memoized, runs exactly once)
  // -------------------------------------------------------------------------
  const ensureEngine = useCallback(async () => {
    if (connRef.current) return connRef.current
    if (!initPromiseRef.current) {
      initPromiseRef.current = (async () => {
        const bundles = { mvp: { mainModule: mvpWasmUrl, mainWorker: mvpWorkerUrl }, eh: { mainModule: ehWasmUrl, mainWorker: ehWorkerUrl } }
        const bundle = await duckdb.selectBundle(bundles)
        const worker = new Worker(bundle.mainWorker)
        const logger = new duckdb.ConsoleLogger()
        const db = new duckdb.AsyncDuckDB(logger, worker)
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
        const conn = await db.connect()
        dbRef.current = db
        connRef.current = conn
        return conn
      })()
    }
    return initPromiseRef.current
  }, [])

  // -------------------------------------------------------------------------
  // Tool registry
  // -------------------------------------------------------------------------
  const registerTool = useCallback(async (name, description, parameters, handler) => {
    toolsRef.current.set(name, handler)
    agentWorkerRef.current?.postMessage({ id: ++messageIdRef.current, type: 'register', name, args: { tools: {} } })
    return { success: true, name, description, parameters }
  }, [])

  const invokeTool = useCallback(async (name, args = {}) => {
    const handler = toolsRef.current.get(name)
    if (!handler) throw new Error('unknown tool: ' + name)
    return await handler(args)
  }, [])

  // -------------------------------------------------------------------------
  // Direct data-plane helpers used by the UI
  // -------------------------------------------------------------------------
  const runSQL = useCallback(async (query) => {
    const conn = await ensureEngine()
    return arrowToRows(await conn.query(query))
  }, [ensureEngine])

  const loadDataset = useCallback(async ({ tableName, csvUrl, rawCSV, file }) => {
    const conn = await ensureEngine()
    const db = dbRef.current
    if (!tableName) throw new Error('tableName is required')
    const safeName = String(tableName).replace(/[^A-Za-z0-9_]/g, '_')
    const fileName = 'upload_' + safeName + '.csv'

    if (file) {
      await db.registerFileHandle(fileName, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true)
    } else if (csvUrl) {
      const res = await fetch(csvUrl)
      const text = await res.text()
      await db.registerFileText(fileName, text)
    } else if (rawCSV) {
      await db.registerFileText(fileName, rawCSV)
    } else {
      throw new Error('Provide one of: file, csvUrl, rawCSV')
    }

    await conn.insertCSVFromPath(fileName, { name: safeName, header: true, detect: true })

    setTables((prev) => (prev.includes(safeName) ? prev : [...prev, safeName]))
    return { success: true, tableName: safeName }
  }, [ensureEngine])

  // -------------------------------------------------------------------------
  // Tool definitions (the WebMCP agent surface)
  // -------------------------------------------------------------------------
  const registerAgent = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await ensureEngine()

      const register = (name, description, properties, required, handler) =>
        registerTool(name, description, { type: 'object', properties, required }, handler)

      await register(
        'load_dataset',
        'loads a csv or parquet dataset into an in-memory duckdb table',
        { table_name: { type: 'string' }, csv_url: { type: 'string' }, raw_csv: { type: 'string' } },
        ['table_name'],
        async ({ table_name, csv_url, raw_csv }) =>
          loadDataset({ tableName: table_name, csvUrl: csv_url, rawCSV: raw_csv }),
      )

      await register(
        'run_sql',
        'executes any sql query against loaded duckdb tables and returns tabular json results',
        { query: { type: 'string' } },
        ['query'],
        async ({ query }) => {
          const conn = await ensureEngine()
          return arrowToRows(await conn.query(query))
        },
      )

      await register(
        'render_chart',
        'plots an interactive visual chart on the hyperion canvas',
        {
          chart_type: { type: 'string', enum: ['bar', 'line', 'area', 'scatter', 'pie'] },
          title: { type: 'string' },
          x_key: { type: 'string' },
          y_keys: { type: 'array', items: { type: 'string' } },
          data_query: { type: 'string' },
        },
        ['chart_type', 'title', 'x_key', 'y_keys'],
        async ({ chart_type, title, x_key, y_keys, data_query }) => {
          let data = []
          if (data_query) {
            const conn = await ensureEngine()
            data = arrowToRows(await conn.query(data_query))
          }
          const spec = { chart_type, title, x_key, y_keys, data }
          setChartSpec(spec)
          return spec
        },
      )

      await register(
        'compute_metrics',
        'calculates summary statistics (mean, median, p95, null count, stddev) for specific numeric columns',
        { table_name: { type: 'string' }, columns: { type: 'array', items: { type: 'string' } } },
        ['table_name', 'columns'],
        async ({ table_name, columns }) => {
          const metrics = {}
          for (const col of columns) {
            const sql = [
              'SELECT',
              '  COUNT(*) as count,',
              '  AVG(' + q(col) + ') as mean,',
              '  MEDIAN(' + q(col) + ') as median,',
              '  APPROX_PERCENTILE(' + q(col) + ', 0.95) as p95,',
              '  COUNT(*) - COUNT(' + q(col) + ') as null_count,',
              '  STDDEV(' + q(col) + ') as stddev',
              'FROM ' + q(table_name),
            ].join(' ')
            const conn = await ensureEngine()
            const result = arrowToRows(await conn.query(sql))
            metrics[col] = result[0] || null
          }
          return metrics
        },
      )

      await register(
        'create_pivot_view',
        'generates dynamic pivot summary aggregation',
        { table_name: { type: 'string' }, row_group: { type: 'string' }, column_group: { type: 'string' }, aggregate_expr: { type: 'string' } },
        ['table_name', 'row_group', 'aggregate_expr'],
        async ({ table_name, row_group, column_group, aggregate_expr }) => {
          let query = 'SELECT ' + q(row_group) + ', ' + aggregate_expr + ' FROM ' + q(table_name)
          if (column_group) query += ' GROUP BY ' + q(row_group) + ', ' + q(column_group)
          else query += ' GROUP BY ' + q(row_group)
          const conn = await ensureEngine()
          return arrowToRows(await conn.query(query))
        },
      )

      await register(
        'list_tables',
        'lists all tables currently loaded in the hyperion engine',
        {},
        [],
        async () => {
          const conn = await ensureEngine()
          return arrowToRows(await conn.query('SHOW TABLES'))
        },
      )

      return { success: true, client: 'hyperion-copilot', tools: [...toolsRef.current.keys()] }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start engine')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [ensureEngine, registerTool, loadDataset])

  const value = {
    isLoading,
    error,
    tables,
    setTables,
    chartSpec,
    setChartSpec,
    registerAgent,
    registerTool,
    invokeTool,
    runSQL,
    loadDataset,
  }

  return <WebMCPContext.Provider value={value}>{children}</WebMCPContext.Provider>
}

export function useWebMCP() {
  const context = useContext(WebMCPContext)
  if (context === undefined) throw new Error('useWebMCP must be used within a Provider')
  return context
}

export default WebMCPContext
