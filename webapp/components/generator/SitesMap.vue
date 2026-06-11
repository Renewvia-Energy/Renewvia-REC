<template>
  <div class="card">
    <div class="card-header">
      <h2 class="font-display text-lg font-semibold text-text-primary">Generation sites</h2>
      <span class="text-sm text-text-muted">{{ sites.length }} site{{ sites.length !== 1 ? 's' : '' }}</span>
    </div>
    <div class="card-body p-0 overflow-hidden rounded-b-xl">
      <div v-if="!generationStore.loaded || generationStore.loading" class="flex items-center justify-center py-16">
        <span class="text-sm text-text-muted">Fetching site data…</span>
      </div>
      <div v-else-if="sites.length === 0" class="text-center py-16 text-sm text-text-muted">
        No site coordinates available
      </div>
      <ClientOnly v-else>
        <div ref="mapEl" class="w-full" style="height: 320px;" />
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGenerationStore } from '~/stores/generation'

const generationStore = useGenerationStore()
const sites = computed(() => generationStore.sites)

const mapEl = ref<HTMLDivElement | null>(null)
let mapInstance: import('leaflet').Map | null = null

async function initMap() {
  if (!mapEl.value || sites.value.length === 0) return

  // Dynamic import — Leaflet must not run on the server
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  // Re-check after async imports — the ref may have been nulled by a re-render
  if (!mapEl.value) return

  // Fix default marker icons (webpack/vite breaks the default paths) — served locally
  const iconUrl    = '/images/marker-icon.png'
  const iconRetinaUrl = '/images/marker-icon-2x.png'
  const shadowUrl  = '/images/marker-shadow.png'
  const DefaultIcon = L.icon({ iconUrl, iconRetinaUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] })
  L.Marker.prototype.options.icon = DefaultIcon

  mapInstance?.remove()

  const lats = sites.value.map(s => s.lat)
  const lngs = sites.value.map(s => s.lng)
  const center = L.latLng(
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
  )

  mapInstance = L.map(mapEl.value, { zoomControl: true }).setView(center, 8)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(mapInstance)

  for (const site of sites.value) {
    const rows = [
      site.dcCapacityKwp != null   ? `<tr><td>DC Capacity</td><td><b>${site.dcCapacityKwp} kWp</b></td></tr>` : '',
      site.dateOfFirstOperation    ? `<tr><td>First operation</td><td><b>${site.dateOfFirstOperation}</b></td></tr>` : '',
      `<tr><td>Total energy</td><td><b>${site.totalEnergyMwh.toFixed(3)} MWh</b></td></tr>`,
    ].join('')

    L.marker([site.lat, site.lng])
      .addTo(mapInstance)
      .bindPopup(
        `<strong style="font-size:13px">${site.name}</strong>
         <table style="margin-top:6px;border-collapse:collapse;font-size:12px;line-height:1.6">
           ${rows}
         </table>`,
      )
  }

  // Fit map to all markers if more than one site
  if (sites.value.length > 1) {
    const bounds = L.latLngBounds(sites.value.map(s => [s.lat, s.lng] as [number, number]))
    mapInstance.fitBounds(bounds, { padding: [32, 32] })
  }
}

watch([() => generationStore.loaded, mapEl], ([loaded, el]) => {
  if (loaded && el) initMap()
}, { immediate: true, flush: 'post' })

onUnmounted(() => {
  mapInstance?.remove()
  mapInstance = null
})
</script>
