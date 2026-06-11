<template>
  <div class="p-6 space-y-6 max-w-7xl">
    <h1 class="font-display text-2xl font-semibold text-text-primary">Admin Overview</h1>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card card-body">
        <p class="text-2xs text-text-muted uppercase tracking-wider font-semibold">Pending onboarding</p>
        <p class="font-display text-3xl font-bold text-text-primary mt-1">{{ stats.pendingOnboarding }}</p>
      </div>
      <div class="card card-body">
        <p class="text-2xs text-text-muted uppercase tracking-wider font-semibold">Pending orders</p>
        <p class="font-display text-3xl font-bold text-text-primary mt-1">{{ stats.pendingOrders }}</p>
      </div>
      <div class="card card-body">
        <p class="text-2xs text-text-muted uppercase tracking-wider font-semibold">Total users</p>
        <p class="font-display text-3xl font-bold text-text-primary mt-1">{{ stats.totalUsers }}</p>
      </div>
      <div class="card card-body">
        <p class="text-2xs text-text-muted uppercase tracking-wider font-semibold">Companies</p>
        <p class="font-display text-3xl font-bold text-text-primary mt-1">{{ contractsStore.companies.length }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div class="card">
        <div class="card-header">
          <h2 class="font-display text-lg font-semibold">Quick links</h2>
        </div>
        <div class="card-body space-y-2">
          <NuxtLink to="/dashboard/admin/onboarding" class="block text-sm text-brand hover:underline">
            → Review onboarding submissions ({{ stats.pendingOnboarding }} pending)
          </NuxtLink>
          <NuxtLink to="/dashboard/admin/orders" class="block text-sm text-brand hover:underline">
            → Execute pending orders ({{ stats.pendingOrders }} pending)
          </NuxtLink>
          <NuxtLink to="/dashboard/admin/users" class="block text-sm text-brand hover:underline">
            → Manage users
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useContractsStore } from '~/stores/contracts'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin' })

const contractsStore = useContractsStore()

const [onboardingResp, ordersResp, usersResp] = await Promise.all([
  useFetch('/api/onboarding'),
  useFetch('/api/orders'),
  useFetch('/api/users'),
])

const stats = computed(() => ({
  pendingOnboarding: (onboardingResp.data.value?.submissions ?? []).filter((s: { status: string }) => s.status === 'pending').length,
  pendingOrders:     (ordersResp.data.value?.orders ?? []).filter((o: { status: string }) => o.status === 'pending').length,
  totalUsers:        (usersResp.data.value?.users ?? []).length,
}))

onMounted(() => contractsStore.loadPublicData())
</script>
