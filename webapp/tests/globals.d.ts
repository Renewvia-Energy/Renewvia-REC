// Ambient declarations for globals stubbed via vi.stubGlobal in tests/setup.ts.
// Using `declare global` inside a module (export {}) so these only appear on
// globalThis and do not shadow Nuxt's auto-imported server functions.
declare global {
  // eslint-disable-next-line no-var
  var readBody: unknown
  // eslint-disable-next-line no-var
  var getRouterParam: unknown
  // eslint-disable-next-line no-var
  var requireUserSession: unknown
}

export {}
