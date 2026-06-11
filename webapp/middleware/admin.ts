// Named middleware for admin-only pages
// Usage: definePageMeta({ middleware: 'admin' })

export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  const sessionUser = user.value as { isAdmin?: boolean } | undefined

  if (!sessionUser?.isAdmin) {
    return navigateTo('/dashboard')
  }
})
