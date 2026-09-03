const fs = require('fs')

// Demo dataset generator for HyperSheet
// Generates a 100k-row SaaS metrics CSV for the 3-minute demo

const ROWS = 100000
const OUTPUT_FILE = './sample_data/stripe_saaSMetrics_100k.csv'

// Sample data arrays
const tiers = ['bronze', 'silver', 'gold', 'platinum']
const regions = ['NA', 'EU', 'APAC', 'LATAM']
const plans = ['starter', 'professional', 'enterprise', 'unlimited']
const industries = ['tech', 'retail', 'finance', 'healthcare', 'manufacturing', 'media']

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function generateDataset() {
  const headers = [
    'customer_id',
    'customer_tier',
    'region',
    'plan',
    'industry',
    'monthly_revenue',
    'mrr',
    'arr',
    'customer_since',
    'churn_flag',
    'renewal_date',
    'account_age_days',
    'usage_score',
    'support_tickets',
    'nps_score',
  ]

  const rows = [headers.join(',')]

  const startDate = new Date('2023-01-01')
  const endDate = new Date('2024-12-31')

  for (let i = 1; i <= ROWS; i++) {
    const customerSince = new Date(
      startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()),
    )
    const accountAgeDays = Math.floor(
      (new Date().getTime() - customerSince.getTime()) / (1000 * 60 * 60 * 24),
    )
    const renewalDate = new Date(customerSince)
    renewalDate.setFullYear(renewalDate.getFullYear() + 1)

    const tier = randomItem(tiers)
    const baseRevenue = {
      bronze: 100,
      silver: 500,
      gold: 2000,
      platinum: 10000,
    }[tier]

    const revenueMultiplier = 0.5 + Math.random() * 2 // 0.5x to 2.5x
    const monthlyRevenue = Math.round(baseRevenue * revenueMultiplier)
    const mrr = monthlyRevenue
    const arr = monthlyRevenue * 12

    const churnFlag = Math.random() < 0.2 // 20% churn
    const usageScore = Math.round(30 + Math.random() * 70) // 30-100
    const supportTickets = Math.round(Math.random() * 15)
    const npsScore = Math.round(0 + Math.random() * 10)

    const row = [
      `CUS-${String(i).padStart(6, '0')}`,
      tier,
      randomItem(regions),
      randomItem(plans),
      randomItem(industries),
      monthlyRevenue,
      mrr,
      arr,
      formatDate(customerSince),
      churnFlag,
      formatDate(renewalDate),
      accountAgeDays,
      usageScore,
      supportTickets,
      npsScore,
    ]

    rows.push(row.join(','))
  }

  return rows
}

function generateAnomalyDataset() {
  // Extra dataset with anomalies for the demo
  const headers = [
    'transaction_id',
    'customer_id',
    'transaction_date',
    'amount',
    'type',
    'region',
    'flagged',
  ]

  const rows = [headers.join(',')]

  for (let i = 1; i <= 50000; i++) {
    const types = ['subscription', 'upgrade', 'downgrade', 'Add-on', 'refund']
    const amounts = [99, 199, 499, 999, 1999, 4999, 9999, 19999, 49999, 99999]
    const flagged = Math.random() < 0.05 // 5% anomalies

    const row = [
      `TXN-${String(i).padStart(8, '0')}`,
      `CUS-${String(randomInt(1, 100000)).padStart(6, '0')}`,
      formatDate(new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)),
      randomItem(amounts),
      randomItem(types),
      randomItem(['NA', 'EU', 'APAC']),
      flagged,
    ]

    rows.push(row.join(','))
  }

  return rows
}

function main() {
  console.log('Generating HyperSheet demo dataset...')

  // Create output directory
  if (!fs.existsSync('./sample_data')) {
    fs.mkdirSync('./sample_data')
  }

  // Generate main dataset
  console.log(`Generating ${ROWS.toLocaleString()} rows...`)
  const mainData = generateDataset()
  fs.writeFileSync(OUTPUT_FILE, mainData.join('\n'))
  console.log(`Main dataset saved to ${OUTPUT_FILE} (${(mainData.length * 150 / 1024).toFixed(1)} KB)`)

  // Generate anomaly dataset
  const anomalyData = generateAnomalyDataset()
  fs.writeFileSync('./sample_data/transactions_50k.csv', anomalyData.join('\n'))
  console.log(`Anomaly dataset saved (50k rows)`)

  console.log('\nDemo complete! Files ready:')
  console.log(`  - ${OUTPUT_FILE}`)
  console.log('  - ./sample_data/transactions_50k.csv')
}

main()
