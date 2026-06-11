// Global auth guard — runs on every navigation
// Public routes: /login only
// Everything else requires a valid session cookie

const PUBLIC_ROUTES = ['/login']

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  if (PUBLIC_ROUTES.includes(to.path)) {
    // If already logged in, redirect away from login
    if (loggedIn.value) {
      return navigateTo('/dashboard')
    }
    return
  }

  // Any other route requires auth
  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
