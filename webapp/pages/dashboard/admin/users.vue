<template>
  <div class="p-6 space-y-6 max-w-7xl">
    <div class="flex items-center justify-between">
      <h1 class="font-display text-2xl font-semibold text-text-primary">Users</h1>
      <button
        class="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        @click="showCreate = true"
      >
        + Create user
      </button>
    </div>

    <AdminCreateUser
      v-if="showCreate"
      :companies="companies"
      @created="onCreated"
      @cancel="showCreate = false"
    />

    <AdminEditUser
      v-if="editingUser"
      :user="editingUser"
      :companies="companies"
      @saved="onSaved"
      @cancel="editingUser = null"
    />

    <div class="card">
      <div class="card-body p-0">
        <table class="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Company wallet</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="users.length === 0">
              <td colspan="6" class="text-center text-text-muted py-8">No users found</td>
            </tr>
            <tr v-for="u in users" :key="u.id">
              <td class="font-medium">{{ u.username }}</td>
              <td class="text-text-secondary">{{ u.email }}</td>
              <td>
                <span v-if="u.isAdmin"     class="badge badge-approved mr-1">Admin</span>
                <span v-if="u.isGenerator" class="badge badge-executed mr-1">Generator</span>
                <span v-if="u.isBuyer"     class="badge badge-pending">Buyer</span>
              </td>
              <td>
                <span v-if="u.companyWallet" class="font-mono text-xs text-text-secondary">
                  {{ u.companyWallet.slice(0, 8) }}…{{ u.companyWallet.slice(-6) }}
                </span>
                <span v-else class="text-text-muted">—</span>
              </td>
              <td>{{ formatDate(u.createdAt) }}</td>
              <td class="text-right pr-4">
                <button
                  class="text-xs text-brand hover:underline"
                  @click="editingUser = u"
                >
                  Edit
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useContractsStore } from '~/stores/contracts'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Users' })

const contractsStore = useContractsStore()
const showCreate  = ref(false)
const editingUser = ref<typeof users.value[number] | null>(null)

const { data, refresh } = await useFetch('/api/users')
const users = computed(() => data.value?.users ?? [])

const companies = computed(() => contractsStore.companies)

const { formatDate } = useFormatters()

async function onCreated() {
  showCreate.value = false
  await refresh()
}

async function onSaved() {
  editingUser.value = null
  await refresh()
}

onMounted(() => contractsStore.loadPublicData())
</script>
