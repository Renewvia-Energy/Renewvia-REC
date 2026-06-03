/**
 * contracts store — Holdings, activity, and portfolio data
 *
 * Ported from the vanilla-JS fetchContracts() logic.
 * Source data comes from two public JSON files (companies.json, contracts.json).
 * All wallet address comparisons are case-insensitive (lowercased before compare).
 */
import { defineStore, skipHydrate } from 'pinia'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompanyRecord {
  name: string
  logo: string
  join_date: string
  address: string
}

export interface RawTransaction {
  timeStamp: string
  action: 'mint' | 'transfer' | 'return' | 'retire'
  amount: number
  verification_data: string | null
  to: string
  from: string
  blockNumber: string
  hash?: string
  ignore?: boolean
  note?: string
}

export interface ContractRecord {
  name: string
  abbreviation: string
  superclass: string
  commodity: string
  img: string
  description: string
  address: string | null
  implementation?: string[]
  transactions: RawTransaction[]
}

export interface ActivityItem {
  timeStamp: string
  action: string          // human-readable label
  rawAction: string       // original action
  amount: number
  signedAmount: number
  verification_data: string | null
  to: string
  from: string
  blockNumber: string
  hash?: string
  name: string            // contract name
  abbreviation: string
  date: string            // YYYY-M-D
  contractAddress: string | null
}

export interface AssetHolding {
  name: string
  abbreviation: string
  superclass: string
  address: string | null
  amount: number          // current balance (after all signed transactions)
  img: string
  description: string
  commodity: string
}

// ── Rough tCO2e emission factors per abbreviation (MVP) ──────────────────────
// These are approximate; final values come from AVERT / Ember / AMS-III.BB
const CO2E_FACTORS: Record<string, number> = {
  'RREC-AL':  0.37,  // Alabama — SERC East
  'RREC-GA':  0.37,  // Georgia — SERC East
  'RREC-NC':  0.37,  // North Carolina — SERC Carolinas
  'RREC-VA':  0.40,  // Virginia — PJM
  'SC-REC':   0.37,  // South Carolina
  'RREC-ACM': 0.57,  // Cameroon
  'RREC-ACI': 0.50,  // Côte d'Ivoire
  'RREC-AKE': 0.10,  // Kenya (high renewables)
  'RREC-ACD': 0.05,  // DR Congo (dominated by hydro)
  'RREC-ASN': 0.60,  // Senegal
  'RREC-AZA': 0.90,  // South Africa (coal-heavy grid)
  'RREC-ANG': 0.43,  // Nigeria
}
const DEFAULT_CO2E_FACTOR = 0.50

function co2eFactor(abbreviation: string): number {
  return CO2E_FACTORS[abbreviation] ?? DEFAULT_CO2E_FACTOR
}

// ── Helper ────────────────────────────────────────────────────────────────────

function addrEq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function formatDate(ts: string): string {
  const d = new Date(parseInt(ts) * 1000)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useContractsStore = defineStore('contracts', () => {
  const config = useRuntimeConfig()

  // ── State ──────────────────────────────────────────────────────────────────
  // skipHydrate: these are always populated client-side (onMounted), so they
  // must never be included in the SSR payload — avoids Pinia's shouldHydrate
  // crash on null-prototype objects that can appear in raw JSON fetch results.
  const companies    = ref<CompanyRecord[]>(skipHydrate([]))
  const contractsRaw = ref<ContractRecord[]>(skipHydrate([]))
  const assets       = ref<AssetHolding[]>(skipHydrate([]))
  const activity     = ref<ActivityItem[]>(skipHydrate([]))

  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  // Current wallet — set when switching company context (admin) or on login
  const wallet = ref<string | null>(null)

  // ── Derived ────────────────────────────────────────────────────────────────

  const totalMwh = computed(() =>
    assets.value.reduce((sum, a) => sum + a.amount, 0),
  )

  const totalTco2e = computed(() =>
    assets.value.reduce(
      (sum, a) => sum + a.amount * co2eFactor(a.abbreviation),
      0,
    ),
  )

  // Sum of all retire-action transaction amounts for the current wallet
  const totalRetiredMwh = computed(() =>
    activity.value
      .filter(a => a.rawAction === 'retire')
      .reduce((sum, a) => sum + a.amount, 0),
  )

  const totalRetiredTco2e = computed(() =>
    activity.value
      .filter(a => a.rawAction === 'retire')
      .reduce((sum, a) => sum + a.amount * co2eFactor(a.abbreviation), 0),
  )

  const portfolioSlices = computed(() =>
    assets.value.map(a => ({
      label:  a.abbreviation,
      value:  a.amount,
      name:   a.name,
    })),
  )

  function companyForWallet(addr: string): CompanyRecord | undefined {
    return companies.value.find(c => addrEq(c.address, addr))
  }

  // ── Loaders ────────────────────────────────────────────────────────────────

  async function loadPublicData() {
    if (loaded.value) return
    loading.value = true
    error.value = null
    try {
      const [companiesData, contractsData] = await Promise.all([
        $fetch<CompanyRecord[]>(config.public.companiesUrl, { parseResponse: JSON.parse }),
        $fetch<ContractRecord[]>(config.public.contractsUrl, { parseResponse: JSON.parse }),
      ])
      companies.value    = Array.isArray(companiesData) ? companiesData : []
      contractsRaw.value = Array.isArray(contractsData) ? contractsData : []
      loaded.value = true
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load market data'
    } finally {
      loading.value = false
    }
  }

  /**
   * Compute holdings and activity for a given wallet address.
   * Pass the RETURN_WALLET so transfers from it are labelled "Receipt".
   */
  function processWallet(walletAddr: string, returnWallet: string) {
    wallet.value = walletAddr.toLowerCase()
    const WALLET = walletAddr.toLowerCase()
    const RETURN = returnWallet.toLowerCase()

    const newAssets: AssetHolding[] = []
    const newActivity: ActivityItem[] = []

    for (const contract of contractsRaw.value) {
      for (const trans of contract.transactions ?? []) {
        // Skip explicitly ignored transactions
        if (trans.ignore) continue

        // Skip outgoing mints (when this wallet IS the minter sending to others)
        // This prevents admin/minter wallets from seeing every mint as a debit
        if (
          trans.action === 'mint' &&
          addrEq(trans.from, WALLET) &&
          !addrEq(trans.to, WALLET)
        ) continue

        // Only include transactions that involve this wallet
        const toMe   = addrEq(trans.to, WALLET)
        const fromMe = addrEq(trans.from, WALLET)
        if (!toMe && !fromMe) continue

        const signedAmount = fromMe ? -trans.amount : trans.amount

        // Derive human-readable action label
        let actionLabel: string
        switch (trans.action) {
          case 'mint':
            actionLabel = 'Generation'
            break
          case 'return':
            actionLabel = 'Return'
            break
          case 'retire':
            actionLabel = 'Retirement'
            break
          case 'transfer':
            if (addrEq(trans.from, RETURN)) {
              actionLabel = 'Receipt'
            } else {
              actionLabel = fromMe ? 'Sale' : 'Purchase'
            }
            break
          default: {
            const s = trans.action as string
            actionLabel = s.charAt(0).toUpperCase() + s.slice(1)
          }
        }

        newActivity.push({
          timeStamp:       trans.timeStamp,
          action:          actionLabel,
          rawAction:       trans.action,
          amount:          trans.amount,
          signedAmount,
          verification_data: trans.verification_data,
          to:              trans.to,
          from:            trans.from,
          blockNumber:     trans.blockNumber,
          hash:            trans.hash,
          name:            contract.name,
          abbreviation:    contract.abbreviation,
          date:            formatDate(trans.timeStamp),
          contractAddress: contract.address,
        })

        // Update holdings
        const idx = newAssets.findIndex(a => a.address === contract.address)
        if (idx === -1) {
          newAssets.push({
            name:         contract.name,
            abbreviation: contract.abbreviation,
            superclass:   contract.superclass,
            address:      contract.address,
            amount:       signedAmount,
            img:          contract.img,
            description:  contract.description,
            commodity:    contract.commodity,
          })
        } else {
          newAssets[idx].amount += signedAmount
        }
      }
    }

    // Filter out zero/negative holdings
    assets.value = newAssets.filter(a => a.amount > 0)

    // Sort activity chronologically (oldest first)
    activity.value = newActivity.sort(
      (a, b) => parseInt(a.timeStamp) - parseInt(b.timeStamp),
    )
  }

  function reset() {
    assets.value   = []
    activity.value = []
    wallet.value   = null
    loaded.value   = false
    error.value    = null
  }

  return {
    companies,
    contractsRaw,
    assets,
    activity,
    loading,
    loaded,
    error,
    wallet,
    totalMwh,
    totalTco2e,
    totalRetiredMwh,
    totalRetiredTco2e,
    portfolioSlices,
    companyForWallet,
    loadPublicData,
    processWallet,
    reset,
    co2eFactor,
  }
})
