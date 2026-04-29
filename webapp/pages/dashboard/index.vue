<template>
  <div class="p-6 space-y-6 max-w-7xl">
    <DashboardHeaderBar :company="company" :wallet="sessionUser?.companyWallet ?? ''" />

    <div v-if="contractsStore.loading" class="text-sm text-text-muted py-8 text-center">
      Loading market data…
    </div>

    <div v-else-if="contractsStore.error" role="alert" class="rounded border border-danger-subtle bg-danger-subtle px-4 py-3 text-sm text-danger">
      {{ contractsStore.error }}
    </div>

    <template v-else>
      <DashboardMyImpact
        :total-mwh="contractsStore.totalMwh"
        :total-tco2e="contractsStore.totalTco2e"
      >
        <template #action>
          <button
            class="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:border-brand hover:text-brand transition-colors"
            @click="shareOpen = true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>
        </template>
      </DashboardMyImpact>

      <DashboardShareModal v-model="shareOpen" />

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2 space-y-6">
          <DashboardAssetsTable :assets="contractsStore.assets" />
          <DashboardActivityTable :activity="contractsStore.activity" />
        </div>
        <div>
          <DashboardPortfolioPie :slices="contractsStore.portfolioSlices" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useContractsStore } from '~/stores/contracts'

useHead({ title: 'Dashboard' })

const authStore      = useAuthStore()
const contractsStore = useContractsStore()

const { sessionUser } = storeToRefs(authStore)

const shareOpen = ref(false)

const company = computed(() =>
  sessionUser.value?.companyWallet
    ? contractsStore.companyForWallet(sessionUser.value.companyWallet)
    : undefined,
)
</script>
