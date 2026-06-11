// Named middleware for buyer-only pages
// Usage: definePageMeta({ middleware: 'buyer' })

export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  const sessionUser = user.value as { isBuyer?: boolean; isAdmin?: boolean } | undefined

  if (!sessionUser?.isBuyer && !sessionUser?.isAdmin) {
    return navigateTo('/dashboard')
  }
})
