<template>
  <div class="card">
    <div class="card-header">
      <h2 class="font-display text-lg font-semibold text-text-primary">Holdings</h2>
      <span class="text-sm text-text-muted">{{ assets.length }} asset{{ assets.length !== 1 ? 's' : '' }}</span>
    </div>
    <div class="card-body p-0">
      <table class="data-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Commodity</th>
            <th class="text-right">Balance (MWh)</th>
            <th class="text-right">Est. tCO₂e</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="assets.length === 0">
            <tr>
              <td colspan="5" class="text-center text-text-muted py-10">No holdings</td>
            </tr>
          </template>
          <template v-for="asset in assets" :key="asset.address">
            <tr
              class="cursor-pointer"
              @click="toggle(asset.address)"
            >
              <td>
                <div class="flex items-center gap-2.5">
                  <div>
                    <p class="font-medium text-text-primary">{{ asset.abbreviation }}</p>
                    <p class="text-2xs text-text-muted">{{ asset.name }}</p>
                  </div>
                </div>
              </td>
              <td class="text-text-secondary max-w-xs truncate">{{ asset.commodity }}</td>
              <td class="numeric font-semibold">{{ asset.amount.toLocaleString() }}</td>
              <td class="numeric text-text-secondary">
                {{ (asset.amount * contractsStore.co2eFactor(asset.abbreviation)).toFixed(1) }}
              </td>
              <td class="text-right pr-4">
                <span class="text-text-muted text-xs">{{ expanded.has(asset.address ?? '') ? '▲' : '▼' }}</span>
              </td>
            </tr>
            <!-- Expanded detail row -->
            <tr v-if="expanded.has(asset.address ?? '')" class="bg-surface-raised">
              <td colspan="5" class="px-5 py-4">
                <div class="space-y-2 text-sm">
                  <p class="text-text-secondary">{{ asset.description }}</p>
                  <div class="flex gap-6 text-2xs font-mono text-text-muted mt-2">
                    <span v-if="asset.address">
                      Contract:
                      <a
                        :href="`${config.public.polygonscanBase}/token/${asset.address}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-brand hover:underline"
                      >
                        {{ asset.address.slice(0, 8) }}…{{ asset.address.slice(-6) }} ↗
                      </a>
                    </span>
                    <span>Superclass: {{ asset.superclass }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useContractsStore } from '~/stores/contracts'
import type { AssetHolding } from '~/stores/contracts'

defineProps<{ assets: AssetHolding[] }>()

const config = useRuntimeConfig()
const contractsStore = useContractsStore()

const expanded = ref<Set<string>>(new Set())

function toggle(address: string | null) {
  const key = address ?? ''
  if (expanded.value.has(key)) expanded.value.delete(key)
  else expanded.value.add(key)
}
</script>
