import { axiomClient } from '~/server/utils/logger'

export default defineNitroPlugin((nitroApp) => {
  if (!axiomClient) return

  nitroApp.hooks.hook('afterResponse', async () => {
    await axiomClient.flush()
  })
})
