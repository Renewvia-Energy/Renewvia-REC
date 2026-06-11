<template>
  <div class="w-full max-w-sm">
    <!-- Wordmark -->
    <div class="mb-8 text-center">
      <span class="font-display text-3xl font-bold text-brand">REX</span>
      <p class="text-sm text-text-secondary mt-1">Renewvia Environmental Exchange</p>
    </div>

    <!-- Card -->
    <div class="card">
      <div class="card-body space-y-5">
        <h1 class="font-display text-xl font-semibold text-text-primary">Sign in</h1>

        <form class="space-y-4" @submit.prevent="handleLogin">
          <div>
            <label for="username" class="block text-sm font-medium text-text-secondary mb-1">
              Username
            </label>
            <input
              id="username"
              v-model="username"
              type="text"
              autocomplete="username"
              required
              class="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="your-username"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-text-secondary mb-1">
              Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div v-if="errorMsg" role="alert" aria-live="assertive" class="rounded border border-danger-subtle bg-danger-subtle px-3 py-2 text-sm text-danger">
            {{ errorMsg }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full rounded bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <span v-if="loading">Signing in…</span>
            <span v-else>Sign in</span>
          </button>
        </form>
      </div>
    </div>

    <p class="mt-4 text-center text-2xs text-text-muted">
      Accounts are provisioned by REX staff.
    </p>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Sign in' })

const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const loading  = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  errorMsg.value = ''
  loading.value  = true
  try {
    await authStore.login(username.value, password.value)
    await navigateTo('/dashboard')
  } catch (e: unknown) {
    errorMsg.value = (e as { statusMessage?: string })?.statusMessage ?? 'Invalid credentials'
  } finally {
    loading.value = false
  }
}
</script>
