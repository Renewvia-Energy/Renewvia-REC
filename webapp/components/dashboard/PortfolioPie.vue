<template>
  <div class="card">
    <div class="card-header">
      <h2 class="font-display text-lg font-semibold text-text-primary">Portfolio</h2>
    </div>
    <div class="card-body">
      <div v-if="slices.length === 0" class="text-center text-text-muted py-8 text-sm">
        No holdings to display
      </div>
      <template v-else>
        <canvas ref="canvasRef" class="w-full max-w-xs mx-auto" height="220" />
        <!-- Legend -->
        <ul class="mt-4 space-y-1">
          <li
            v-for="(slice, i) in slices"
            :key="slice.label"
            class="flex items-center gap-2 text-sm"
          >
            <span
              class="w-3 h-3 rounded-sm shrink-0"
              :style="{ backgroundColor: legendColors[i] }"
            />
            <span class="text-text-secondary truncate flex-1">{{ slice.label }}</span>
            <span class="font-mono text-text-primary tabular-nums">{{ slice.value.toLocaleString() }}</span>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Chart, ArcElement, Tooltip, DoughnutController } from 'chart.js'

Chart.register(ArcElement, Tooltip, DoughnutController)

interface Slice { label: string; value: number; name: string }

const props = defineProps<{ slices: Slice[] }>()

/** Read a computed CSS custom property value (not a var() reference). */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Build palette from design tokens at render time so theme changes are reflected. */
function buildPalette(): string[] {
  return [
    cssVar('--color-brand'),
    cssVar('--color-accent'),
    cssVar('--color-brand-light'),
    cssVar('--color-accent-light'),
    cssVar('--color-brand-muted'),
    cssVar('--color-text-secondary'),
    // Extended range for portfolios with many assets
    cssVar('--color-info'),
    cssVar('--color-success'),
    cssVar('--color-warning'),
    cssVar('--color-danger'),
  ]
}

const canvasRef    = ref<HTMLCanvasElement | null>(null)
const legendColors = ref<string[]>([])
let chart: Chart | null = null

function buildChart() {
  if (!canvasRef.value || props.slices.length === 0) return

  chart?.destroy()

  const palette      = buildPalette()
  legendColors.value = props.slices.map((_, i) => palette[i % palette.length])
  const colorSurface = cssVar('--color-surface-raised')
  const colorBorder  = cssVar('--color-border')
  const colorSecondary = cssVar('--color-text-secondary')
  const colorPrimary   = cssVar('--color-text-primary')

  chart = new Chart(canvasRef.value, {
    type: 'doughnut',
    data: {
      labels:   props.slices.map(s => s.label),
      datasets: [{
        data:            props.slices.map(s => s.value),
        backgroundColor: props.slices.map((_, i) => palette[i % palette.length]),
        borderWidth:     1,
        borderColor:     colorSurface,
        hoverBorderWidth:2,
      }],
    },
    options: {
      responsive: true,
      cutout: '60%',
      plugins: {
        tooltip: {
          backgroundColor: colorSurface,
          borderColor:     colorBorder,
          borderWidth:     1,
          titleColor:      colorSecondary,
          bodyColor:       colorPrimary,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${(ctx.raw as number).toLocaleString()} MWh`,
          },
        },
        legend: { display: false },
      },
    },
  })
}

let observer: MutationObserver | null = null

onMounted(() => {
  buildChart()
  // Rebuild when dark mode toggles so palette reads updated CSS vars
  observer = new MutationObserver(() => { if (chart) buildChart() })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
watch(() => props.slices, async () => { await nextTick(); buildChart() }, { deep: true })
onUnmounted(() => {
  chart?.destroy()
  observer?.disconnect()
})
</script>
