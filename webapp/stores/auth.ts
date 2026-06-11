import { defineStore } from 'pinia'
import { useContractsStore } from './contracts'
import { useGenerationStore } from './generation'

export interface SessionUser {
  id: number
  username: string
  email: string
  companyWallet: string | null
  isGenerator: boolean
  isBuyer: boolean
  isAdmin: boolean
}

export const useAuthStore = defineStore('auth', () => {
  // nuxt-auth-utils composable provides reactivity automatically
  const { user, loggedIn, fetch: fetchSession, clear } = useUserSession()

  const sessionUser = computed<SessionUser | null>(() =>
    loggedIn.value ? (user.value as SessionUser) : null,
  )

  const roles = computed(() => ({
    isGenerator: sessionUser.value?.isGenerator ?? false,
    isBuyer:     sessionUser.value?.isBuyer ?? false,
    isAdmin:     sessionUser.value?.isAdmin ?? false,
  }))

  async function login(username: string, password: string) {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    await fetchSession()
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clear()
    useContractsStore().reset()
    useGenerationStore().reset()
    clearNuxtData()
    await navigateTo('/login')
  }

  return { sessionUser, loggedIn, roles, login, logout }
})
