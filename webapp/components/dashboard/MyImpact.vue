<template>
  <div class="py-5 border-y border-border">
    <div class="flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-12 sm:justify-between">

      <!-- Primary stat: MWh held — brand color signals this is the real, verified figure -->
      <div>
        <p class="text-2xs font-semibold uppercase tracking-widest text-text-muted mb-1.5">MWh held</p>
        <p class="font-display font-bold text-brand tabular-nums leading-none" style="font-size: clamp(2.25rem, 5vw, 3.5rem)">
          {{ formatNumber(totalMwh) }}
        </p>
        <p class="text-xs text-text-secondary mt-1.5">megawatt-hours</p>
      </div>

      <!-- Visual separator — desktop only -->
      <div class="hidden sm:block w-px self-stretch bg-border my-1" aria-hidden="true" />

      <!-- Secondary stat: tCO₂e — text-primary since it's a calculated estimate -->
      <div>
        <div class="flex items-center gap-2 mb-1.5">
          <p class="text-2xs font-semibold uppercase tracking-widest text-text-muted">Carbon reduction</p>
          <span class="text-2xs font-semibold text-accent tracking-wide">(est.)</span>
        </div>
        <p class="font-display font-bold text-text-primary tabular-nums leading-none" style="font-size: clamp(2.25rem, 5vw, 3.5rem)">
          {{ formatNumber(totalTco2e) }}
        </p>
        <p class="text-xs text-text-secondary mt-1.5">tCO₂e avoided</p>
        <p class="text-2xs text-text-muted mt-3 max-w-sm">
          Rough estimate based on regional grid emission factors.
          Exact values require AVERT / Ember / AMS-III.BB calculation.
        </p>
      </div>

      <!-- Slot for actions (e.g. Share button) — aligned to bottom-right -->
      <div v-if="$slots.action" class="sm:self-end">
        <slot name="action" />
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  totalMwh: number
  totalTco2e: number
}>()

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toFixed(1)
}
</script>
