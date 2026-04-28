<template>
  <div class="card">
    <div class="card-header">
      <h2 class="font-display text-lg font-semibold text-text-primary">Emission reduction goals</h2>
      <button class="text-sm text-brand hover:underline" @click="showForm = !showForm">
        {{ showForm ? 'Cancel' : '+ Add goal' }}
      </button>
    </div>
    <div class="card-body space-y-4">

      <!-- Add goal form -->
      <form v-if="showForm" class="border border-border rounded p-4 space-y-3 bg-surface" @submit.prevent="addGoal">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="goal-scope" class="block text-xs font-medium text-text-secondary mb-1">Scope</label>
            <select id="goal-scope" v-model.number="newGoal.scope" class="rex-select w-full">
              <option :value="0">General</option>
              <option :value="1">Scope 1 — Direct emissions</option>
              <option :value="2">Scope 2 — Energy indirect</option>
              <option :value="3">Scope 3 — Value chain</option>
            </select>
          </div>
          <div>
            <label for="goal-year" class="block text-xs font-medium text-text-secondary mb-1">Target year</label>
            <input id="goal-year" v-model.number="newGoal.targetYear" type="number" min="2024" max="2050" class="rex-input w-full" />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="goal-mwh" class="block text-xs font-medium text-text-secondary mb-1">Target MWh</label>
            <input id="goal-mwh" v-model.number="newGoal.targetMwh" type="number" min="0" step="0.1" class="rex-input w-full" />
          </div>
          <div>
            <label for="goal-tco2e" class="block text-xs font-medium text-text-secondary mb-1">Target tCO₂e</label>
            <input id="goal-tco2e" v-model.number="newGoal.targetTco2e" type="number" min="0" step="0.1" class="rex-input w-full" />
          </div>
        </div>
        <div>
          <label for="goal-desc" class="block text-xs font-medium text-text-secondary mb-1">Description (optional)</label>
          <input id="goal-desc" v-model="newGoal.description" type="text" class="rex-input w-full" placeholder="e.g. 100% renewable electricity by 2030" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="text-sm text-text-secondary hover:text-text-primary" @click="showForm = false">Cancel</button>
          <button type="submit" :disabled="saving" class="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {{ saving ? 'Saving…' : 'Save goal' }}
          </button>
        </div>
      </form>

      <!-- Goals list -->
      <div v-if="goals.length === 0 && !showForm" class="text-center py-8 text-sm text-text-muted">
        No goals set. Add a goal to track progress.
      </div>

      <div v-for="goal in goals" :key="goal.id" class="border border-border rounded p-4 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="badge badge-executed text-2xs">{{ scopeLabel(goal.scope) }}</span>
            <p v-if="goal.description" class="text-sm text-text-primary mt-1">{{ goal.description }}</p>
          </div>
          <div class="text-right text-2xs text-text-muted shrink-0">
            <span v-if="goal.targetYear">Target: {{ goal.targetYear }}</span>
          </div>
        </div>

        <!-- MWh progress — hidden when target is 0 or unset -->
        <div v-if="Number(goal.targetMwh) > 0">
          <div class="flex justify-between text-xs text-text-secondary mb-1">
            <span>MWh progress</span>
            <span class="tabular-nums">
              {{ (totalMwh + totalRetiredMwh).toLocaleString() }} / {{ Number(goal.targetMwh).toLocaleString() }}
              <span v-if="totalRetiredMwh > 0" class="text-text-muted">({{ totalRetiredMwh.toLocaleString() }} retired)</span>
            </span>
          </div>
          <div
            class="relative h-2 rounded-full bg-surface-overlay overflow-hidden"
            role="progressbar"
            :aria-valuenow="Math.min(100, Math.round(((totalMwh + totalRetiredMwh) / Number(goal.targetMwh)) * 100))"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`MWh progress: ${(totalMwh + totalRetiredMwh).toLocaleString()} of ${Number(goal.targetMwh).toLocaleString()} MWh`"
          >
            <div
              class="absolute inset-y-0 left-0 w-full bg-brand origin-left transition-transform duration-500 motion-reduce:transition-none"
              :style="{ transform: `scaleX(${Math.min(1, (totalMwh + totalRetiredMwh) / Number(goal.targetMwh))})` }"
            />
            <div
              v-if="totalRetiredMwh > 0"
              class="absolute inset-y-0 left-0 w-full bg-accent origin-left transition-transform duration-500 motion-reduce:transition-none"
              :style="{ transform: `scaleX(${Math.min(1, totalRetiredMwh / Number(goal.targetMwh))})` }"
            />
          </div>
          <div v-if="totalRetiredMwh > 0" class="flex gap-3 mt-1 text-2xs text-text-muted">
            <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-sm bg-accent" />Retired</span>
            <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-sm bg-brand" />Held</span>
          </div>
        </div>

        <!-- tCO2e progress — hidden when target is 0 or unset -->
        <div v-if="Number(goal.targetTco2e) > 0">
          <div class="flex justify-between text-xs text-text-secondary mb-1">
            <span>tCO₂e progress</span>
            <span class="tabular-nums">
              {{ (totalTco2e + totalRetiredTco2e).toFixed(1) }} / {{ Number(goal.targetTco2e).toLocaleString() }}
              <span v-if="totalRetiredTco2e > 0" class="text-text-muted">({{ totalRetiredTco2e.toFixed(1) }} retired)</span>
            </span>
          </div>
          <div
            class="relative h-2 rounded-full bg-surface-overlay overflow-hidden"
            role="progressbar"
            :aria-valuenow="Math.min(100, Math.round(((totalTco2e + totalRetiredTco2e) / Number(goal.targetTco2e)) * 100))"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`tCO₂e progress: ${(totalTco2e + totalRetiredTco2e).toFixed(1)} of ${Number(goal.targetTco2e).toLocaleString()} tCO₂e`"
          >
            <div
              class="absolute inset-y-0 left-0 w-full bg-brand origin-left transition-transform duration-500 motion-reduce:transition-none"
              :style="{ transform: `scaleX(${Math.min(1, (totalTco2e + totalRetiredTco2e) / Number(goal.targetTco2e))})` }"
            />
            <div
              v-if="totalRetiredTco2e > 0"
              class="absolute inset-y-0 left-0 w-full bg-accent origin-left transition-transform duration-500 motion-reduce:transition-none"
              :style="{ transform: `scaleX(${Math.min(1, totalRetiredTco2e / Number(goal.targetTco2e))})` }"
            />
          </div>
          <div v-if="totalRetiredTco2e > 0" class="flex gap-3 mt-1 text-2xs text-text-muted">
            <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-sm bg-accent" />Retired</span>
            <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-sm bg-brand" />Held</span>
          </div>
        </div>

        <button
          class="px-2 py-1 text-xs text-danger hover:underline mt-1 rounded"
          :aria-label="`Remove ${goal.description || scopeLabel(goal.scope)} goal`"
          @click="deleteGoal(goal.uuid)"
        >
          Remove
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useContractsStore } from '~/stores/contracts'

const contractsStore    = useContractsStore()
const totalMwh          = computed(() => contractsStore.totalMwh)
const totalTco2e        = computed(() => contractsStore.totalTco2e)
const totalRetiredMwh   = computed(() => contractsStore.totalRetiredMwh)
const totalRetiredTco2e = computed(() => contractsStore.totalRetiredTco2e)

const { data, refresh } = await useFetch('/api/goals')
const goals = computed(() => data.value?.goals ?? [])

const showForm = ref(false)
const saving   = ref(false)

const newGoal = reactive({
  scope:       2 as 0 | 1 | 2 | 3,
  targetYear:  2030,
  targetMwh:   null as number | null,
  targetTco2e: null as number | null,
  description: '',
})

function scopeLabel(scope: number | null): string {
  const labels: Record<number, string> = { 0: 'General', 1: 'Scope 1', 2: 'Scope 2', 3: 'Scope 3' }
  return labels[scope ?? -1] ?? 'Unknown'
}

async function addGoal() {
  saving.value = true
  try {
    await $fetch('/api/goals', { method: 'POST', body: { ...newGoal } })
    showForm.value = false
    Object.assign(newGoal, { scope: 2, targetYear: 2030, targetMwh: null, targetTco2e: null, description: '' })
    await refresh()
  } finally {
    saving.value = false
  }
}

async function deleteGoal(id: string) {
  await $fetch(`/api/goals/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

