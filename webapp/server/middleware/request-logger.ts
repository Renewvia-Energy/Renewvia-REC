export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return

  const start = Date.now()
  const ip    = getRequestIP(event, { xForwardedFor: true })
  const method = event.method

  event.node.res.once('finish', () => {
    logger.info({
      method,
      path,
      status:   event.node.res.statusCode,
      duration: Date.now() - start,
      ip,
    }, 'api request')
  })
})
