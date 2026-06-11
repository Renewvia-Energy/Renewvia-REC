/**
 * generation store — Cumulative generation time series
 *
 * Fetches verification_data CSVs for all mint transactions in the active wallet,
 * parses DateTime + Measured kWh columns, and accumulates into a cumulative series.
 *
 * CSV structure (per R-REC Standard):
 *   [header rows]
 *   ,              ← separator line (trim === ',')
 *   DateTime,Measured kWh[,optional columns...]
 *   2024-01-01T00:00:00,123.45
 *   ...
 */
import { defineStore } from 'pinia'
import { useContractsStore } from './contracts'

export interface TimeSeriesPoint {
  date: Date
  cumulativeMwh: number
}

export interface SiteInfo {
  name: string
  lat: number
  lng: number
  dcCapacityKwp: number | null
  dateOfFirstOperation: string | null
  totalEnergyMwh: number
}

// ── Utility: simple bucket-based downsampler ─────────────────────────────────

function downsampleData(
  dates: Date[],
  values: number[],
  maxPoints: number,
): { dates: Date[]; values: number[] } {
  if (dates.length <= maxPoints) return { dates, values }

  const bucketSize = dates.length / maxPoints
  const outDates: Date[] = []
  const outValues: number[] = []

  for (let i = 0; i < maxPoints; i++) {
    const end = Math.min(Math.floor((i + 1) * bucketSize), dates.length)
    // Take the last point in each bucket (most recent cumulative value)
    outDates.push(dates[end - 1])
    outValues.push(values[end - 1])
  }

  return { dates: outDates, values: outValues }
}

// ── CSV parsing ──────────────────────────────────────────────────────────────

function parseSiteInfo(csvText: string): SiteInfo | null {
  const lines = csvText.split('\n')
  const sepIdx = lines.findIndex(l => l.trim() === ',')
  const headerLines = sepIdx === -1 ? lines : lines.slice(0, sepIdx)

  const get = (key: string): string => {
    const line = headerLines.find(l => l.toLowerCase().startsWith(key.toLowerCase() + ','))
    return line ? line.slice(key.length + 1).trim() : ''
  }

  const name    = get('Project Name')
  const lat     = parseFloat(get('Latitude'))
  const lng     = parseFloat(get('Longitude'))

  if (!name || isNaN(lat) || isNaN(lng)) return null

  const dcRaw    = parseFloat(get('DC Capacity (kWp)'))
  const energyRaw = parseFloat(get('Total Energy Production (MWh)'))

  return {
    name,
    lat,
    lng,
    dcCapacityKwp:        isNaN(dcRaw) ? null : dcRaw,
    dateOfFirstOperation: get('Date of First Operation') || null,
    totalEnergyMwh:       isNaN(energyRaw) ? 0 : energyRaw,
  }
}

function parseVerificationCsv(csvText: string): Array<{ date: Date; kWh: number }> {
  let lines = csvText.split('\n')

  // Find the separator line (trim === ',') then skip it + the column header
  const sepIdx = lines.findIndex(l => l.trim() === ',')
  if (sepIdx === -1) return []

  lines = lines.slice(sepIdx + 2) // skip separator + "DateTime,Measured kWh" header

  const points: Array<{ date: Date; kWh: number }> = []
  for (const line of lines) {
    const parts = line.split(',')
    if (parts.length < 2) continue

    const date = new Date(parts[0].trim())
    const kWh  = parseFloat(parts[1].trim())

    if (isNaN(date.getTime()) || isNaN(kWh)) continue
    points.push({ date, kWh })
  }

  return points
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGenerationStore = defineStore('generation', () => {
  // Raw time series (kWh per interval, sorted by date)
  const rawDates  = ref<Date[]>([])
  const rawKwh    = ref<number[]>([])
  const sites     = ref<SiteInfo[]>([])

  const loading      = ref(false)
  const loaded       = ref(false)
  const loadedWallet = ref<string | null>(null)
  const error        = ref<string | null>(null)
  const progress     = ref(0)   // 0–100 during fetch

  // Computed: cumulative MWh series
  const cumulativeMwhSeries = computed<number[]>(() => {
    let running = 0
    return rawKwh.value.map(kWh => {
      running += kWh / 1000 // kWh → MWh
      return running
    })
  })

  // Downsampled for chart rendering (max 100 points)
  const chartSeries = computed(() =>
    downsampleData(rawDates.value, cumulativeMwhSeries.value, 100),
  )

  const totalGeneratedMwh = computed(() => {
    const series = cumulativeMwhSeries.value
    return series.length > 0 ? series[series.length - 1]! : 0
  })

  /**
   * Load generation data for the given wallet.
   * Fetches all verification_data CSVs for mint transactions sent to this wallet.
   */
  async function loadForWallet(walletAddr: string) {
    if (loaded.value && loadedWallet.value === walletAddr.toLowerCase()) return

    const contractsStore = useContractsStore()
    await contractsStore.loadPublicData()

    loading.value  = true
    error.value    = null
    progress.value = 0

    try {
      // Collect all verification_data URLs for mint transactions to this wallet
      const mintUrls: string[] = []
      for (const contract of contractsStore.contractsRaw) {
        for (const trans of contract.transactions ?? []) {
          if (
            !trans.ignore &&
            trans.action === 'mint' &&
            trans.to.toLowerCase() === walletAddr.toLowerCase() &&
            trans.verification_data
          ) {
            mintUrls.push(trans.verification_data)
          }
        }
      }

      if (mintUrls.length === 0) {
        loaded.value = true
        return
      }

      // Fetch all CSVs in parallel (with individual error tolerance)
      const results = await Promise.allSettled(
        mintUrls.map(url => fetch(url).then(r => r.text())),
      )

      const siteMap = new Map<string, SiteInfo>()

      // Collect all points into plain local arrays (avoids O(n²) reactive splices)
      const allPoints: Array<{ t: number; kWh: number }> = []

      let completed = 0
      for (const result of results) {
        completed++
        progress.value = Math.round((completed / mintUrls.length) * 100)

        if (result.status !== 'fulfilled') continue

        const siteInfo = parseSiteInfo(result.value)
        if (siteInfo) {
          const existing = siteMap.get(siteInfo.name)
          if (existing) {
            existing.totalEnergyMwh += siteInfo.totalEnergyMwh
          } else {
            siteMap.set(siteInfo.name, { ...siteInfo })
          }
        }

        const points = parseVerificationCsv(result.value)
        for (const { date, kWh } of points) {
          allPoints.push({ t: date.getTime(), kWh })
        }
      }

      // Sort by timestamp, then merge duplicate timestamps
      allPoints.sort((a, b) => a.t - b.t)

      const mergedDates: Date[]   = []
      const mergedKwh:   number[] = []
      for (const { t, kWh } of allPoints) {
        if (mergedDates.length > 0 && mergedDates[mergedDates.length - 1]!.getTime() === t) {
          mergedKwh[mergedKwh.length - 1]! += kWh
        } else {
          mergedDates.push(new Date(t))
          mergedKwh.push(kWh)
        }
      }

      // Single reactive assignment — no incremental splice churn
      rawDates.value     = mergedDates
      rawKwh.value       = mergedKwh
      sites.value        = Array.from(siteMap.values())
      loadedWallet.value = walletAddr.toLowerCase()
      loaded.value       = true
    } finally {
      loading.value = false
    }
  }

  function reset() {
    rawDates.value     = []
    rawKwh.value       = []
    sites.value        = []
    loadedWallet.value = null
    loaded.value       = false
    error.value        = null
    progress.value     = 0
  }

  return {
    rawDates,
    rawKwh,
    sites,
    cumulativeMwhSeries,
    chartSeries,
    totalGeneratedMwh,
    loading,
    loaded,
    error,
    progress,
    loadForWallet,
    reset,
  }
})
