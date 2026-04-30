// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Semi+Condensed:wght@400;500;600&display=swap',
        },
      ],
    },
  },

  components: [
    // Icons live in a subdirectory but should resolve without the "Icons" prefix
    { path: '~/components/icons', pathPrefix: false },
    '~/components',
  ],

  modules: [
    '@pinia/nuxt',
    'nuxt-auth-utils',
    '@nuxtjs/tailwindcss',
    '@vercel/analytics'
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Server-only secrets
    databaseUrl: process.env.DATABASE_URL,
    sessionPassword: process.env.NUXT_SESSION_PASSWORD,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: process.env.R2_BUCKET_NAME,
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2UploadUrl: process.env.R2_UPLOAD_URL,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
    // Public (exposed to client)
    public: {
      companiesUrl:  process.env.NUXT_PUBLIC_COMPANIES_URL,
      contractsUrl:  process.env.NUXT_PUBLIC_CONTRACTS_URL,
      r2PublicUrl:   process.env.R2_PUBLIC_URL ?? '',
      polygonscanBase: process.env.NUXT_PUBLIC_POLYGONSCAN_BASE ?? 'https://polygonscan.com',
      returnWallet:     process.env.RETURN_WALLET     ?? '0x6e61b86d97ebe007e09770e6c76271645201fd07',
      retirementWallet: process.env.RETIREMENT_WALLET ?? '0x51475BEdAe21624c5AD8F750cDBDc4c15Ca8F93f',
    },
  },

  // Nuxt auth-utils session config (reads NUXT_SESSION_PASSWORD automatically)
  auth: {
    // Automatically set by nuxt-auth-utils
  },

  nitro: {
    // Use @neondatabase/serverless with Neon's WebSocket pooler
    experimental: {
      wasm: true,
    },
  },

  tailwindcss: {
    configPath: '~/tailwind.config.ts',
  },

  typescript: {
    strict: true,
  },
})
