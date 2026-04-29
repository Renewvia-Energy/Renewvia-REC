<template>
  <div class="min-h-screen bg-surface flex">

    <!-- Skip navigation — visible on focus for keyboard users -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-card-md"
    >
      Skip to main content
    </a>

    <!-- Mobile backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-150 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-20 bg-black/40 lg:hidden"
        aria-hidden="true"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar: fixed overlay on mobile, static on desktop -->
    <aside
      id="sidebar"
      class="fixed inset-y-0 left-0 z-30 w-56 shrink-0 border-r border-border bg-surface-raised flex flex-col transition-transform duration-200 ease-out lg:static lg:z-auto motion-reduce:transition-none"
      :class="sidebarOpen ? 'translate-x-0 shadow-card-lg' : '-translate-x-full lg:translate-x-0'"
      aria-label="Site navigation"
    >
      <!-- Logo / wordmark -->
      <div class="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <span class="font-display text-xl font-semibold text-brand tracking-tight">REX</span>
          <span class="block text-2xs text-text-muted font-body mt-0.5">Renewvia Environmental Exchange</span>
        </div>
        <!-- Close button — mobile only -->
        <button
          class="lg:hidden p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
          aria-label="Close navigation"
          @click="sidebarOpen = false"
        >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        <NuxtLink
          to="/dashboard"
          class="nav-link"
          exact-active-class="active"
          :aria-current="isExact('/dashboard') ? 'page' : undefined"
        >
          <IconGrid class="w-4 h-4 shrink-0" aria-hidden="true" />
          Dashboard
        </NuxtLink>

        <template v-if="roles.isGenerator || roles.isAdmin">
          <div class="pt-3 pb-1 px-3 text-2xs font-semibold uppercase tracking-wider text-text-muted" aria-hidden="true">
            Generator
          </div>
          <NuxtLink
            to="/dashboard/generator"
            class="nav-link"
            active-class="active"
            :aria-current="isActive('/dashboard/generator') ? 'page' : undefined"
          >
            <IconChart class="w-4 h-4 shrink-0" aria-hidden="true" />
            Generation
          </NuxtLink>
          <NuxtLink
            to="/onboarding"
            class="nav-link"
            active-class="active"
            :aria-current="isActive('/onboarding') ? 'page' : undefined"
          >
            <IconUpload class="w-4 h-4 shrink-0" aria-hidden="true" />
            Onboarding
          </NuxtLink>
        </template>

        <template v-if="roles.isBuyer || roles.isAdmin">
          <div class="pt-3 pb-1 px-3 text-2xs font-semibold uppercase tracking-wider text-text-muted" aria-hidden="true">
            Buyer
          </div>
          <NuxtLink
            to="/dashboard/buyer"
            class="nav-link"
            active-class="active"
            :aria-current="isActive('/dashboard/buyer') ? 'page' : undefined"
          >
            <IconTarget class="w-4 h-4 shrink-0" aria-hidden="true" />
            Goals & Orders
          </NuxtLink>
        </template>

        <template v-if="roles.isAdmin">
          <div class="pt-3 pb-1 px-3 text-2xs font-semibold uppercase tracking-wider text-text-muted" aria-hidden="true">
            Admin
          </div>
          <NuxtLink
            to="/dashboard/admin"
            class="nav-link"
            active-class="active"
            :aria-current="isExact('/dashboard/admin') ? 'page' : undefined"
          >
            <IconShield class="w-4 h-4 shrink-0" aria-hidden="true" />
            Overview
          </NuxtLink>
          <NuxtLink
            to="/dashboard/admin/onboarding"
            class="nav-link"
            active-class="active"
            :aria-current="isActive('/dashboard/admin/onboarding') ? 'page' : undefined"
          >
            <IconClipboard class="w-4 h-4 shrink-0" aria-hidden="true" />
            Onboarding Queue
          </NuxtLink>
          <NuxtLink
            to="/dashboard/admin/orders"
            class="nav-link"
            active-class="active"
            :aria-current="isActive('/dashboard/admin/orders') ? 'page' : undefined"
          >
            <IconList class="w-4 h-4 shrink-0" aria-hidden="true" />
            Order Queue
          </NuxtLink>
          <NuxtLink
            to="/dashboard/admin/users"
            class="nav-link"
            active-class="active"
            :aria-current="isActive('/dashboard/admin/users') ? 'page' : undefined"
          >
            <IconUsers class="w-4 h-4 shrink-0" aria-hidden="true" />
            Users
          </NuxtLink>
        </template>
      </nav>

      <!-- Footer: user info + logout -->
      <div class="px-3 py-3 border-t border-border space-y-1">
        <div class="px-3 py-1">
          <p class="text-sm font-medium text-text-primary truncate">{{ sessionUser?.username }}</p>
          <p class="text-2xs text-text-muted">{{ roleLabel }}</p>
        </div>
        <button
          class="nav-link w-full text-left"
          @click="authStore.logout()"
        >
          <IconLogout class="w-4 h-4 shrink-0" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>

    <!-- Content column -->
    <div class="flex flex-col flex-1 min-w-0">

      <!-- Mobile topbar (hidden on lg+) -->
      <header class="flex items-center gap-3 h-12 px-4 border-b border-border bg-surface-raised shrink-0 lg:hidden">
        <button
          class="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
          aria-label="Open navigation"
          :aria-expanded="sidebarOpen"
          aria-controls="sidebar"
          @click="sidebarOpen = true"
        >
          <svg class="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <span class="font-display text-base font-semibold text-brand tracking-tight">REX</span>
      </header>

      <!-- Main content -->
      <main id="main-content" class="flex-1 min-w-0 overflow-y-auto">
        <slot />
      </main>
    </div>

  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useContractsStore } from '~/stores/contracts'

const authStore      = useAuthStore()
const contractsStore = useContractsStore()
const config         = useRuntimeConfig()
const route          = useRoute()

const { sessionUser, roles } = storeToRefs(authStore)

const sidebarOpen = ref(false)

/** Close sidebar on navigation (mobile drawer behaviour) */
watch(() => route.path, () => { sidebarOpen.value = false })

/** Exact path match — for routes like /dashboard that shouldn't match /dashboard/buyer */
function isExact(path: string): boolean {
  return route.path === path
}

/** Prefix match — for routes that represent a section */
function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}

const roleLabel = computed(() => {
  const r = roles.value
  const parts: string[] = []
  if (r.isAdmin)     parts.push('Admin')
  if (r.isGenerator) parts.push('Generator')
  if (r.isBuyer)     parts.push('Buyer')
  return parts.join(' · ') || 'Viewer'
})

onMounted(async () => {
  await contractsStore.loadPublicData()
  if (sessionUser.value?.companyWallet) {
    contractsStore.processWallet(
      sessionUser.value.companyWallet,
      config.public.returnWallet,
    )
  }
})
</script>
