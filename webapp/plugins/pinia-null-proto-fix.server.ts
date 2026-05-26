import { shouldHydrate } from 'pinia'

// Pinia's shouldHydrate calls obj.hasOwnProperty() which throws on null-prototype
// objects (created by h3/ufo internals). Override the payload reducer with a safe version.
export default defineNuxtPlugin({
  name: 'pinia-null-proto-fix',
  enforce: 'post',
  setup() {
    definePayloadReducer(
      'skipHydrate',
      (data: unknown) => {
        if (data !== null && typeof data === 'object' && Object.getPrototypeOf(data) === null) {
          return false
        }
        return !shouldHydrate(data) && 1
      },
    )
  },
})
