// Named middleware for generator-only pages
// Usage: definePageMeta({ middleware: 'generator' })

export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  const sessionUser = user.value as { isGenerator?: boolean; isAdmin?: boolean } | undefined

  if (!sessionUser?.isGenerator && !sessionUser?.isAdmin) {
    return navigateTo('/dashboard')
  }
})
