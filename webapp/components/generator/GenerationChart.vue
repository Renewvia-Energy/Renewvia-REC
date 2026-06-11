<template>
  <div class="card">
    <div class="card-header">
      <div>
        <h2 class="font-display text-lg font-semibold text-text-primary">Cumulative generation</h2>
        <p class="text-sm text-text-muted mt-0.5">
          Total verified: <span class="font-semibold text-text-primary tabular-nums">{{ formatMwh(generationStore.totalGeneratedMwh) }} MWh</span>
        </p>
      </div>
      <div v-if="generationStore.loading" class="text-sm text-text-muted flex items-center gap-2">
        <span class="inline-block w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        Loading data… {{ generationStore.progress }}%
      </div>
    </div>
    <div class="card-body">
      <div v-if="generationStore.error" class="text-sm text-danger">
        {{ generationStore.error }}
      </div>
      <div v-else-if="!generationStore.loaded || generationStore.loading" class="flex items-center justify-center py-16">
        <span class="text-sm text-text-muted">Fetching verification data…</span>
      </div>
      <div v-else-if="generationStore.rawDates.length === 0" class="text-center py-16 text-sm text-text-muted">
        No generation data available
      </div>
      <canvas v-else ref="canvasRef" class="w-full" style="height: 300px;" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  TimeScale,
  LinearScale,
  Filler,
  Tooltip,
} from 'chart.js'
import 'chartjs-adapter-date-fns'

Chart.register(LineElement, PointElement, LineController, TimeScale, LinearScale, Filler, Tooltip)

import { useAuthStore } from '~/stores/auth'
import { useGenerationStore } from '~/stores/generation'

const authStore      = useAuthStore()
const generationStore = useGenerationStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart<'line', { x: Date; y: number }[], Date> | null = null
let observer: MutationObserver | null = null

function formatMwh(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toFixed(2)
}

/** Read an actual computed CSS custom property value (not a var() reference). */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function buildChart() {
  if (!canvasRef.value) return
  const { dates, values } = generationStore.chartSeries
  if (dates.length === 0) return

  chart?.destroy()

  // Read colors at build time so Chart.js gets real values, not var() strings
  const colorBrand     = cssVar('--color-brand')
  const colorMuted     = cssVar('--color-text-muted')
  const colorSecondary = cssVar('--color-text-secondary')
  const colorBorder    = cssVar('--color-border')
  const colorSurface   = cssVar('--color-surface-raised')
  const colorPrimary   = cssVar('--color-text-primary')

  chart = new Chart(canvasRef.value, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label:           'Energy Generated',
        data:            values.map((y, i) => ({ x: dates[i], y })),
        borderColor:     colorBrand,
        // backgroundColor: colorBrand + '1f', // ~12% opacity
        borderWidth:     2,
        pointRadius:     0,
        pointHoverRadius: 4,
        fill:            true,
        tension:         0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type:  'time',
          time:  { unit: 'month', tooltipFormat: 'yyyy-MM-dd' },
          title: { display: true, text: 'Date', color: colorSecondary },
          ticks: { maxTicksLimit: 12, color: colorMuted },
          grid:  { color: colorBorder },
        },
        y: {
          title: { display: true, text: 'Cumulative MWh', color: colorSecondary },
          ticks: { color: colorMuted, callback: (v) => formatMwh(v as number) },
          grid:  { color: colorBorder },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colorSurface,
          borderColor:     colorBorder,
          borderWidth:     1,
          titleColor:      colorSecondary,
          bodyColor:       colorPrimary,
          callbacks: {
            title: ctx => (ctx[0]!.raw as { x: Date }).x?.toLocaleDateString(),
            label: ctx => ` ${formatMwh((ctx.raw as { y: number }).y)} MWh cumulative`,
          },
        },
      },
    },
  })
}

// Trigger loading whenever the wallet becomes available (handles delayed session hydration)
watch(
  () => authStore.sessionUser?.companyWallet,
  (wallet) => { if (wallet) generationStore.loadForWallet(wallet) },
  { immediate: true },
)

// Build chart whenever both the canvas and data are ready (covers all navigation cases)
watch(
  [canvasRef, () => generationStore.loaded],
  ([el, loaded]) => { if (el && loaded) buildChart() },
  { immediate: true, flush: 'post' },
)

onMounted(() => {
  // Rebuild chart whenever the dark class toggles on <html>
  observer = new MutationObserver(() => { if (chart) buildChart() })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  chart?.destroy()
  observer?.disconnect()
})
</script>
