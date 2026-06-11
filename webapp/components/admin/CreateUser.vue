<template>
  <div class="card">
    <div class="card-header">
      <h2 class="font-display text-lg font-semibold">Create user account</h2>
      <button class="text-sm text-text-muted hover:text-text-primary" @click="emit('cancel')">✕</button>
    </div>
    <div class="card-body">
      <form class="space-y-4" @submit.prevent="create">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="cu-username" class="block text-xs font-medium text-text-secondary mb-1">Username</label>
            <input id="cu-username" v-model="form.username" type="text" required autocomplete="username" class="rex-input w-full" placeholder="jane-doe" />
          </div>
          <div>
            <label for="cu-email" class="block text-xs font-medium text-text-secondary mb-1">Email address</label>
            <input id="cu-email" v-model="form.email" type="email" required autocomplete="email" class="rex-input w-full" />
          </div>
        </div>

        <div>
          <label for="cu-password" class="block text-xs font-medium text-text-secondary mb-1">Initial password (≥12 chars)</label>
          <input id="cu-password" v-model="form.password" type="password" required minlength="12" autocomplete="new-password" class="rex-input w-full" />
        </div>

        <!-- Roles -->
        <div class="flex gap-5">
          <label v-for="role in ['isGenerator', 'isBuyer', 'isAdmin']" :key="role" class="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input v-model="(form as Record<string, unknown>)[role]" type="checkbox" class="rounded border-border" />
            {{ roleLabel(role) }}
          </label>
        </div>

        <!-- Company wallet -->
        <div>
          <label for="cu-wallet" class="block text-xs font-medium text-text-secondary mb-1">Link to company wallet</label>
          <select id="cu-wallet" v-model="form.companyWallet" class="rex-select w-full">
            <option value="">— No company link —</option>
            <option
              v-for="c in companies.toSorted((a, b) => {
                if (a.name < b.name) return -1;
                if (a.name > b.name) return 1;
                return 0;
              })"
              :key="c.address"
              :value="c.address.toLowerCase()"
            >
              {{ c.name }} ({{ c.address.slice(0, 8) }}…)
            </option>
          </select>
        </div>

        <div v-if="errorMsg" role="alert" aria-live="assertive" class="rounded border border-danger-subtle bg-danger-subtle px-3 py-2 text-sm text-danger">
          {{ errorMsg }}
        </div>

        <div class="flex gap-3 justify-end">
          <button type="button" class="text-sm text-text-secondary hover:text-text-primary" @click="emit('cancel')">Cancel</button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {{ saving ? 'Creating…' : 'Create account' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CompanyRecord } from '~/stores/contracts'

defineProps<{ companies: CompanyRecord[] }>()
const emit = defineEmits<{ created: []; cancel: [] }>()

const saving   = ref(false)
const errorMsg = ref('')

const form = reactive({
  username:      '',
  email:         '',
  password:      '',
  isGenerator:   false,
  isBuyer:       false,
  isAdmin:       false,
  companyWallet: '',
})

function roleLabel(key: string): string {
  return { isGenerator: 'Generator', isBuyer: 'Buyer', isAdmin: 'Admin' }[key] ?? key
}

async function create() {
  errorMsg.value = ''
  saving.value   = true
  try {
    await $fetch('/api/users', { method: 'POST', body: { ...form } })
    emit('created')
  } catch (e: unknown) {
    errorMsg.value = (e as { statusMessage?: string })?.statusMessage ?? 'Failed to create user'
  } finally {
    saving.value = false
  }
}
</script>

