<template>
  <div class="space-y-4">
    <!-- Filter -->
    <div class="flex gap-2" role="group" aria-label="Filter submissions by status">
      <button
        v-for="f in filters"
        :key="f.value"
        class="px-3 py-2 rounded text-sm border transition-colors"
        :class="activeFilter === f.value
          ? 'bg-brand border-brand text-white'
          : 'border-border text-text-secondary hover:text-text-primary'"
        :aria-pressed="activeFilter === f.value"
        @click="activeFilter = f.value"
      >
        {{ f.label }}
        <span class="ml-1 font-mono text-2xs">{{ countByStatus(f.value) }}</span>
      </button>
    </div>

    <div v-if="filtered.length === 0" class="card card-body text-center text-text-muted text-sm py-10">
      No submissions with status: {{ activeFilter }}
    </div>

    <div v-for="sub in filtered" :key="sub.uuid" class="card">
      <div class="card-header">
        <div>
          <span class="font-mono text-sm text-text-secondary" :title="sub.uuid">#{{ sub.uuid.slice(0, 8) }}</span>
          <span class="ml-3 font-medium text-text-primary">{{ sub.projectName ?? '(unnamed project)' }}</span>
          <span :class="`badge badge-${sub.status} ml-3`">{{ sub.status }}</span>
        </div>
        <span class="text-sm text-text-muted">{{ formatDate(sub.createdAt) }}</span>
      </div>
      <div class="card-body space-y-4">

        <!-- Project info -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Project type</p>
            <p>{{ sub.projectType ?? '—' }}</p>
          </div>
          <div>
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Expected annual gen.</p>
            <p>{{ sub.expectedAnnualGeneration != null ? `${sub.expectedAnnualGeneration} MWh` : '—' }}</p>
          </div>
        </div>

        <!-- Section summaries -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <!-- Generation type -->
          <div v-if="sub.genGenerationType || sub.genDocUrl">
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Generation type</p>
            <p>{{ sub.genGenerationType ?? '—' }}</p>
            <template v-if="sub.genSecondarySrc">
              <p class="text-2xs text-text-muted mt-1">
                Secondary: {{ sub.genSecondarySrc }}
                <template v-if="sub.genSecondaryDesc"> — {{ sub.genSecondaryDesc }}</template>
              </p>
            </template>
            <template v-if="sub.genTertiarySrc">
              <p class="text-2xs text-text-muted">
                Tertiary: {{ sub.genTertiarySrc }}
                <template v-if="sub.genTertiaryDesc"> — {{ sub.genTertiaryDesc }}</template>
              </p>
            </template>
            <a v-if="sub.genDocUrl" :href="viewUrl(sub.genDocUrl)" target="_blank" class="text-brand text-xs hover:underline">
              {{ sub.genDocType ?? 'View document' }} ↗
            </a>
            <AdminLlmStatus :doc-type-match="sub.genLlmDocTypeMatch" :content-match="sub.genLlmContentMatch" :reason="sub.genLlmReason" />
          </div>

          <!-- Capacity -->
          <div v-if="sub.capCapacity != null || sub.capDocUrl">
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Capacity</p>
            <p>{{ sub.capCapacity != null ? `${sub.capCapacity} kWp` : '—' }}</p>
            <a v-if="sub.capDocUrl" :href="viewUrl(sub.capDocUrl)" target="_blank" class="text-brand text-xs hover:underline">
              {{ sub.capDocType ?? 'View document' }} ↗
            </a>
            <AdminLlmStatus :doc-type-match="sub.capLlmDocTypeMatch" :content-match="sub.capLlmContentMatch" :reason="sub.capLlmReason" />
          </div>

          <!-- Location -->
          <div v-if="sub.locLat != null || sub.locPhysicalAddress || sub.locDocUrl">
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Location</p>
            <p v-if="sub.locPhysicalAddress">{{ sub.locPhysicalAddress }}</p>
            <p v-if="sub.locLat != null" class="font-mono text-2xs text-text-muted">{{ sub.locLat }}, {{ sub.locLon }}</p>
            <a v-if="sub.locDocUrl" :href="viewUrl(sub.locDocUrl)" target="_blank" class="text-brand text-xs hover:underline">
              {{ sub.locDocType ?? 'View document' }} ↗
            </a>
            <AdminLlmStatus :doc-type-match="sub.locLlmDocTypeMatch" :content-match="sub.locLlmContentMatch" :reason="sub.locLlmReason" />
          </div>

          <!-- First operation -->
          <div v-if="sub.dateDateOfFirstOperation || sub.dateDocUrl">
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">First operation</p>
            <p>{{ sub.dateDateOfFirstOperation ?? '—' }}</p>
            <a v-if="sub.dateDocUrl" :href="viewUrl(sub.dateDocUrl)" target="_blank" class="text-brand text-xs hover:underline">
              {{ sub.dateDocType ?? 'View document' }} ↗
            </a>
            <AdminLlmStatus :doc-type-match="sub.dateLlmDocTypeMatch" :content-match="sub.dateLlmContentMatch" :reason="sub.dateLlmReason" />
          </div>
        </div>

        <!-- Equipment photos -->
        <div v-if="sub.photosGen?.length" class="space-y-1">
          <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted">Equipment photos</p>
          <div class="flex gap-2 flex-wrap">
            <a v-for="(p, i) in sub.photosGen" :key="i" :href="viewUrl(p.url)" target="_blank">
              <img :src="viewUrl(p.url)" loading="lazy" class="h-16 w-16 object-cover rounded border border-border" :alt="p.caption" />
            </a>
          </div>
          <AdminLlmStatus :doc-type-match="null" :content-match="sub.photosGenLlmMatch" :reason="sub.photosGenLlmReason" />
        </div>

        <!-- Metering photos -->
        <div v-if="sub.photosMeter?.length" class="space-y-1">
          <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted">Metering photos</p>
          <div class="flex gap-2 flex-wrap">
            <a v-for="(p, i) in sub.photosMeter" :key="i" :href="viewUrl(p.url)" target="_blank">
              <img :src="viewUrl(p.url)" loading="lazy" class="h-16 w-16 object-cover rounded border border-border" :alt="p.caption" />
            </a>
          </div>
          <AdminLlmStatus :doc-type-match="null" :content-match="sub.photosMeterLlmMatch" :reason="sub.photosMeterLlmReason" />
        </div>

        <!-- Review action (pending only) -->
        <template v-if="sub.status === 'pending'">
          <div>
            <label :for="`review-notes-${sub.uuid}`" class="block text-xs font-medium text-text-secondary mb-1">Review notes</label>
            <textarea
              :id="`review-notes-${sub.uuid}`"
              v-model="reviewNotes[sub.uuid]"
              rows="2"
              class="rex-input w-full"
              placeholder="Add notes for the generator…"
            />
          </div>
          <div class="flex gap-2">
            <button
              class="rounded bg-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              @click="review(sub.uuid, 'approved')"
            >
              Approve
            </button>
            <button
              class="rounded bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              @click="review(sub.uuid, 'rejected')"
            >
              Reject
            </button>
          </div>
        </template>

        <template v-else-if="sub.status === 'rejected'">
          <div v-if="sub.reviewNotes" class="text-sm text-text-secondary border-t border-border pt-3">
            <span class="font-medium">Review notes:</span> {{ sub.reviewNotes }}
          </div>
          <div class="border-t border-border pt-3">
            <button
              class="rounded border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              @click="reopen(sub.uuid)"
            >
              Re-open for revision
            </button>
          </div>
        </template>
        <div v-else-if="sub.reviewNotes" class="text-sm text-text-secondary border-t border-border pt-3">
          <span class="font-medium">Review notes:</span> {{ sub.reviewNotes }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OnboardingSubmission } from '~/server/db/schema'

const props = defineProps<{ submissions: OnboardingSubmission[] }>()
const emit  = defineEmits<{ refresh: [] }>()

const activeFilter = ref('pending')
const reviewNotes  = reactive<Record<string, string>>({})

const filters = [
  { label: 'Pending',  value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All',      value: '' },
]

const filtered = computed(() =>
  activeFilter.value
    ? props.submissions.filter(s => s.status === activeFilter.value)
    : props.submissions,
)

function countByStatus(status: string): number {
  return status
    ? props.submissions.filter(s => s.status === status).length
    : props.submissions.length
}

async function review(id: string, status: 'approved' | 'rejected') {
  await $fetch(`/api/onboarding/${id}`, {
    method: 'PATCH',
    body: { status, reviewNotes: reviewNotes[id] ?? '' },
  })
  emit('refresh')
}

async function reopen(id: string) {
  await $fetch(`/api/onboarding/${id}`, { method: 'PATCH', body: { status: 'draft' } })
  emit('refresh')
}

const { formatDate, viewUrl } = useFormatters()
</script>
