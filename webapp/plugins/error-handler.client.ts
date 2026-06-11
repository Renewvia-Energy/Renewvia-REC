export default defineNuxtPlugin((nuxtApp) => {
  const { user } = useUserSession()

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
      userId:    user.value?.id,
      username:  user.value?.username,
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
      userId:    user.value?.id,
      username:  user.value?.username,
      error: {
        message: reason instanceof Error ? reason.message : String(reason),
        stack:   reason instanceof Error ? reason.stack   : undefined,
        name:    reason instanceof Error ? reason.name    : 'Unknown',
      },
      userAgent: navigator.userAgent,
    })
  })
})
