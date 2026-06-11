<template>
  <div class="p-6 space-y-6 max-w-7xl">
    <h1 class="font-display text-2xl font-semibold text-text-primary">Order Queue</h1>
    <AdminOrdersQueue :orders="orders" @refresh="refresh" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Order Queue' })

const { data, refresh } = await useFetch('/api/orders', { query: { all: 'true' } })
const orders = computed(() => data.value?.orders ?? [])
</script>
