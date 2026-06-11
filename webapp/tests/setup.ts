import { vi } from 'vitest'
import { createError } from 'h3'

// Stub Nuxt server auto-imports that are not available outside the Nuxt runtime.
// These globals are injected by Nuxt's build pipeline; in Vitest we provide
// lightweight stand-ins so handler modules can be imported and exercised directly.

vi.stubGlobal('createError', createError)

// defineEventHandler is used as a wrapper in every route file. Stubbing it to
// the identity function lets the default export be the raw async handler.
vi.stubGlobal('defineEventHandler', (fn: Function) => fn)

// readBody and getRouterParam are called inside handlers; individual tests
// control their return values via vi.mocked(...).mockResolvedValue / mockReturnValue.
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal('getRouterParam', vi.fn())

// useRuntimeConfig is called by useDb(); tests that exercise DB logic mock
// useDb directly, so this just needs to exist and not throw.
vi.stubGlobal('useRuntimeConfig', vi.fn(() => ({})))

// requireUserSession is provided by nuxt-auth-utils and is auto-imported into
// server/utils/auth.ts. Tests control it via vi.mocked(globalThis.requireUserSession).
vi.stubGlobal('requireUserSession', vi.fn())
