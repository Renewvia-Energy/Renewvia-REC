// Logs unhandled 5xx errors — expected 4xx errors are logged in their routes.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    if (!event) return

    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    if (statusCode < 500) return

    logger.error({
      err: {
        message:    error.message,
        stack:      error.stack,
        statusCode,
      },
      path:   getRequestURL(event).pathname,
      method: event.method,
      ip:     getRequestIP(event, { xForwardedFor: true }),
    }, 'Unhandled server error')
  })
})
