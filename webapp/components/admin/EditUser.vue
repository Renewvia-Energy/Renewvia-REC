<template>
  <div class="card">
    <div class="card-header">
      <h2 class="font-display text-lg font-semibold">Edit user: {{ user.username }}</h2>
      <button class="text-sm text-text-muted hover:text-text-primary" @click="emit('cancel')">✕</button>
    </div>
    <div class="card-body">
      <form class="space-y-4" @submit.prevent="save">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="eu-username" class="block text-xs font-medium text-text-secondary mb-1">Username</label>
            <input id="eu-username" v-model="form.username" type="text" required autocomplete="username" class="rex-input w-full" />
          </div>
          <div>
            <label for="eu-password" class="block text-xs font-medium text-text-secondary mb-1">New password</label>
            <input id="eu-password" v-model="form.password" type="password" minlength="12" autocomplete="new-password" class="rex-input w-full" placeholder="Leave blank to keep current" />
          </div>
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
          <label for="eu-wallet" class="block text-xs font-medium text-text-secondary mb-1">Link to company wallet</label>
          <select id="eu-wallet" v-model="form.companyWallet" class="rex-select w-full">
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
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CompanyRecord } from '~/stores/contracts'

interface UserRecord {
  id:            number
  username:      string
  isGenerator:   boolean
  isBuyer:       boolean
  isAdmin:       boolean
  companyWallet: string | null
}

const props = defineProps<{ user: UserRecord; companies: CompanyRecord[] }>()
const emit  = defineEmits<{ saved: []; cancel: [] }>()

const saving   = ref(false)
const errorMsg = ref('')

const form = reactive({
  username:      props.user.username,
  password:      '',
  isGenerator:   props.user.isGenerator,
  isBuyer:       props.user.isBuyer,
  isAdmin:       props.user.isAdmin,
  companyWallet: props.user.companyWallet ?? '',
})

function roleLabel(key: string): string {
  return { isGenerator: 'Generator', isBuyer: 'Buyer', isAdmin: 'Admin' }[key] ?? key
}

async function save() {
  errorMsg.value = ''
  saving.value   = true
  try {
    const body: Record<string, unknown> = {
      username:      form.username,
      isGenerator:   form.isGenerator,
      isBuyer:       form.isBuyer,
      isAdmin:       form.isAdmin,
      companyWallet: form.companyWallet || null,
    }
    if (form.password) body.password = form.password
    await $fetch(`/api/users/${props.user.id}`, { method: 'PATCH', body })
    emit('saved')
  } catch (e: unknown) {
    errorMsg.value = (e as { statusMessage?: string })?.statusMessage ?? 'Failed to save changes'
  } finally {
    saving.value = false
  }
}
</script>
