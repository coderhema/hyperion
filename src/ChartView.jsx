/**
 * ChartView - renders a chart spec with amCharts 5 (light mode / Astryx neutral palette).
 * spec: { chart_type: 'bar'|'line'|'area'|'pie'|'scatter', title, x_key, y_keys: string[], data: object[] }
 */
import React, { useEffect, useRef } from 'react'
import * as am5 from '@amcharts/amcharts5'
import * as am5xy from '@amcharts/amcharts5/xy'
import * as am5percent from '@amcharts/amcharts5/percent'
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated'

// Astryx neutral categorical data colors (from @astryxdesign/theme-neutral)
const PALETTE = ['#0171e3', '#08a3a3', '#0b991f', '#eb6e00', '#6b1efd', '#f351c0', '#f5394f', '#6f8aff', '#965e03', '#0171a4']
const TEXT_MUTED = am5.color('#525252')
const TEXT_MAIN = am5.color('#171717')
const GRID_COLOR = am5.color('#e6e6e6')

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function ChartView({ spec }) {
  const containerRef = useRef(null)

  const empty =
    !spec || !spec.data || spec.data.length === 0 || !Array.isArray(spec.data)

  // Build the amCharts root whenever the spec changes
  useEffect(() => {
    if (empty || !containerRef.current) return
    const root = am5.Root.new(containerRef.current)
    root.setThemes([am5themes_Animated.new(root)])

    const xKey = spec.x_key
    const yKeys = Array.isArray(spec.y_keys) ? spec.y_keys : [spec.y_keys].filter(Boolean)
    const data = spec.data.map((d) => ({ ...d }))
    const chartType = spec.chart_type

    const makeTooltip = () =>
      am5.Tooltip.new(root, {
        labelText: '{categoryX}: {valueY}',
      })

    const xy = () => {
      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: false,
          wheelX: 'none',
          wheelY: 'none',
          layout: root.verticalLayout,
        }),
      )

      // Series-level data (chart-level data is not reliably propagated to axes/series in this am5 build)
      const chartData = data.map((d) => ({ category: String(d[xKey]), ...d }))

      // Category X (bar / line / area)
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: 'category',
          renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 28 }),
        }),
      )
      xAxis.data.setAll(chartData)
      xAxis.get('renderer').labels.template.setAll({ fontSize: 11, fill: TEXT_MUTED })
      xAxis.get('renderer').grid.template.setAll({ stroke: GRID_COLOR, visible: true })

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
          numberFormat: '#,##0.##',
          min: 0,
        }),
      )
      const yr = yAxis.get('renderer')
      yr.labels.template.setAll({ fontSize: 11, fill: TEXT_MUTED })
      yr.grid.template.setAll({ stroke: GRID_COLOR })
      yr.labels.template.adapters.add('text', (text) => (text === '0' ? '' : text))

      chart.set('cursor', am5xy.XYCursor.new(root, { xAxis, behavior: 'none' }))

      const addSeries = (name, field, color, kind) => {
        let series
        const common = { xAxis, yAxis, name, categoryXField: 'category', valueYField: field, tooltip: makeTooltip() }
        if (kind === 'column') {
          series = am5xy.ColumnSeries.new(root, { ...common, stacked: false })
          series.columns.template.setAll({
            fill: color,
            stroke: color,
            strokeWidth: 0,
            cornerRadiusTL: 3,
            cornerRadiusTR: 3,
            width: am5.percent(58),
            fillOpacity: 0.95,
          })
          series.columns.template.states.create('hover', { fillOpacity: 1 })
        } else {
          series = am5xy.LineSeries.new(root, { ...common, stroke: color, strokeWidth: 2, tension: 0.55 })
          if (kind === 'area') {
            series.fills.template.setAll({ fill: color, fillOpacity: 0.14, visible: true })
          }
        }
        // Push the series BEFORE setting data - in amCharts 5.20.5 (canvas renderer)
        // data set before the series joins chart.series never reaches the axes, leaving
        // category/value axes empty and the plot area blank.
        chart.series.push(series)
        // Coerce the y field to a real number - DuckDB-wasm can return non-JS-number
        // scalars (BigInt, decimal strings) that amCharts silently refuses to plot.
        series.data.setAll(chartData.map((d) => ({ ...d, [field]: num(d[field]) })))
        return series
      }

      if (chartType === 'bar') {
        yKeys.forEach((k, i) => addSeries(k, k, am5.color(PALETTE[i % PALETTE.length]), 'column'))
      } else {
        yKeys.forEach((k, i) => addSeries(k, k, am5.color(PALETTE[i % PALETTE.length]), chartType))
      }

      if (yKeys.length > 1) {
        const legend = am5.Legend.new(root, { centerX: am5.p50, x: am5.p50 })
        legend.labels.template.setAll({ fontSize: 11, fill: TEXT_MAIN })
        legend.markers.template.setAll({ width: 10, height: 10 })
        legend.data.setAll(chart.series.values)
        chart.children.push(legend)
      }

      return chart
    }

    const scatter = () => {
      const chart = root.container.children.push(am5xy.XYChart.new(root, { panX: false, panY: false }))
      const xAxis = chart.xAxes.push(
        am5xy.ValueAxis.new(root, { renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 40 }), numberFormat: '#,##0.##' }),
      )
      const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: am5xy.AxisRendererY.new(root, {}), numberFormat: '#,##0.##' }))
      ;[xAxis, yAxis].forEach((axis) => {
        const renderer = axis.get('renderer')
        renderer.labels.template.setAll({ fontSize: 11, fill: TEXT_MUTED })
        renderer.grid.template.setAll({ stroke: GRID_COLOR })
      })
      const cursor = chart.set('cursor', am5xy.XYCursor.new(root, { xAxis, yAxis, behavior: 'none' }))
      cursor.lineX.set('stroke', GRID_COLOR)
      cursor.lineY.set('stroke', GRID_COLOR)

      const fieldX = xKey
      const fieldY = yKeys[0]
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          xAxis,
          yAxis,
          valueXField: fieldX,
          valueYField: fieldY,
          connect: false,
          stroke: am5.color(PALETTE[0]),
          tooltip: am5.Tooltip.new(root, { labelText: '{valueX}: {valueY}' }),
        }),
      )
      series.bullets.push(() =>
        am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, { radius: 4, fill: am5.color(PALETTE[0]), fillOpacity: 0.75, stroke: am5.color('#ffffff'), strokeWidth: 1 }),
        }),
      )
      series.data.setAll(
        data.map((d) => ({ [fieldX]: num(d[fieldX]), [fieldY]: num(d[fieldY]) })),
      )
      return chart
    }

    const pie = () => {
      const chart = root.container.children.push(am5percent.PieChart.new(root, { layout: root.verticalLayout }))
      const series = chart.series.push(
        am5percent.PieSeries.new(root, {
          valueField: 'value',
          categoryField: 'category',
          innerRadius: am5.percent(55),
          alignLabels: false,
          tooltip: am5.Tooltip.new(root, { labelText: '{category}: {value}' }),
        }),
      )
      series.slices.template.setAll({ stroke: am5.color('#ffffff'), strokeWidth: 1.5, toggleKey: 'none' })
      series.labels.template.set('text', '{category}')
      series.labels.template.setAll({ fontSize: 10, fill: TEXT_MUTED, textAlign: 'center' })
      series.ticks.template.setAll({ stroke: GRID_COLOR })

      const pieData = data
        .map((d) => ({ category: String(d[xKey]), value: num(d[yKeys[0]]) }))
        .filter((d) => d.value > 0)
      if (pieData.length > 6) {
        series.labels.template.set('visible', false)
        series.ticks.template.set('visible', false)
      }
      pieData.forEach((d, i) => series.data.push({ ...d, sliceColor: PALETTE[i % PALETTE.length] }))
      series.slices.template.adapters.add('fill', (_, target) => target.dataItem && target.dataItem.dataContext ? am5.color(target.dataItem.dataContext.sliceColor) : undefined)

      const legend = am5.Legend.new(root, { centerX: am5.p50, x: am5.p50 })
      legend.labels.template.setAll({ fontSize: 11, fill: TEXT_MAIN })
      legend.markers.template.setAll({ width: 10, height: 10 })
      legend.data.setAll(series.dataItems)
      chart.children.push(legend)
      return chart
    }

    try {
      if (chartType === 'pie') pie()
      else if (chartType === 'scatter') scatter()
      else xy()
    } catch (err) {
      console.error('amCharts render error', err)
    }

    return () => {
      root.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec])

  if (empty) {
    return (
      <div className="h-80 w-full flex items-center justify-center rounded-sm border border-dashed border-border bg-muted/20">
        <p className="text-sm text-muted-foreground">Run an analysis to generate a chart</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h3 className="font-medium text-sm text-foreground">{spec.title || 'Untitled Chart'}</h3>
        <span className="text-[10px] text-muted-foreground capitalize shrink-0">{spec.chart_type} chart</span>
      </div>
      <div ref={containerRef} className="h-80 w-full" />
      <p className="mt-3 text-[10px] text-muted-foreground/70">
        <a href="https://www.amcharts.com/javascript-charts/" target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors">
          JavaScript charts by amCharts
        </a>
      </p>
    </div>
  )
}

export default ChartView
