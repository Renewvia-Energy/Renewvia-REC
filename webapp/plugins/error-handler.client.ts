export default defineNuxtPlugin((nuxtApp) => {
  const { user } = useUserSession()

  // Cast the opaque nuxt-auth-utils User to the shape this app stores in the session.
  type AppUser = { id: number; username: string }
  const sessionUser = computed(() => user.value as AppUser | null)

  function reportError(payload: Record<string, unknown>) {
    $fetch('/api/logs/client-error', {
      method: 'POST',
      body: payload,
    }).catch(() => {}) // never let the logger throw
  }

  // Vue component errors (render, lifecycle hooks, watchers)
  nuxtApp.hook('vue:error', (error, _instance, info) => {
    reportError({
      type:      'vue',
      route:     nuxtApp.$router.currentRoute.value.fullPath,
      userId:    sessionUser.value?.id,
      username:  sessionUser.value?.username,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack:   error instanceof Error ? error.stack   : undefined,
        name:    error instanceof Error ? error.name    : 'Unknown',
      },
      vueInfo:   info,
      userAgent: navigator.userAgent,
    })
  })

  // Unhandled promise rejections (e.g. unawaited $fetch calls)
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    reportError({
      type:      'unhandledrejection',
      route:     nuxtApp.$router.currentRoute.value?.fullPath,
      userId:    sessionUser.value?.id,
      username:  sessionUser.value?.username,
      error: {
        message: reason instanceof Error ? reason.message : String(reason),
        stack:   reason instanceof Error ? reason.stack   : undefined,
        name:    reason instanceof Error ? reason.name    : 'Unknown',
      },
      userAgent: navigator.userAgent,
    })
  })
})
