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
          <span class="ml-2 text-xs text-text-muted font-mono bg-surface-alt px-2 py-0.5 rounded">futures</span>
        </div>
        <span class="text-sm text-text-muted">{{ formatDate(sub.createdAt) }}</span>
      </div>
      <div class="card-body space-y-4">

        <!-- Project info -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Project type</p>
            <p>{{ sub.projectType ?? '—' }}</p>
          </div>
          <div>
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Expected annual gen.</p>
            <p>{{ sub.expectedAnnualGeneration != null ? `${sub.expectedAnnualGeneration} MWh` : '—' }}</p>
          </div>
          <div>
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Expected commissioning</p>
            <p>{{ sub.expectedCompletionDate ?? '—' }}</p>
          </div>
        </div>

        <!-- Document sections -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">

          <!-- Development License -->
          <div v-if="sub.devLicenseDocUrl">
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Development license / permissions</p>
            <a :href="viewUrl(sub.devLicenseDocUrl)" target="_blank" class="text-brand text-xs hover:underline">
              {{ sub.devLicenseDocType ?? 'View document' }} ↗
            </a>
            <AdminLlmStatus :doc-type-match="null" :content-match="sub.devLicenseLlmMatch" :reason="sub.devLicenseLlmReason" />
          </div>

          <!-- Land Rights -->
          <div v-if="sub.landRightsDocUrl">
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Land rights</p>
            <a :href="viewUrl(sub.landRightsDocUrl)" target="_blank" class="text-brand text-xs hover:underline">
              {{ sub.landRightsDocType ?? 'View document' }} ↗
            </a>
            <AdminLlmStatus :doc-type-match="null" :content-match="sub.landRightsLlmMatch" :reason="sub.landRightsLlmReason" />
          </div>

          <!-- Equipment Procurement -->
          <div v-if="sub.equipProcurementDocUrl">
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Equipment procurement</p>
            <a :href="viewUrl(sub.equipProcurementDocUrl)" target="_blank" class="text-brand text-xs hover:underline">
              {{ sub.equipProcurementDocType ?? 'View document' }} ↗
            </a>
            <AdminLlmStatus :doc-type-match="null" :content-match="sub.equipProcurementLlmMatch" :reason="sub.equipProcurementLlmReason" />
          </div>

          <!-- Project Timeline -->
          <div v-if="sub.projTimelineDocUrl">
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Project timeline</p>
            <a :href="viewUrl(sub.projTimelineDocUrl)" target="_blank" class="text-brand text-xs hover:underline">
              {{ sub.projTimelineDocType ?? 'View document' }} ↗
            </a>
            <AdminLlmStatus :doc-type-match="null" :content-match="sub.projTimelineLlmMatch" :reason="sub.projTimelineLlmReason" />
          </div>

          <!-- Engineering Specifications -->
          <div v-if="sub.engSpecsDocUrl">
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Engineering specifications</p>
            <a :href="viewUrl(sub.engSpecsDocUrl)" target="_blank" class="text-brand text-xs hover:underline">
              {{ sub.engSpecsDocType ?? 'View document' }} ↗
            </a>
            <AdminLlmStatus :doc-type-match="null" :content-match="sub.engSpecsLlmMatch" :reason="sub.engSpecsLlmReason" />
          </div>

          <!-- Funding Commitment -->
          <div v-if="sub.fundingCommitmentDocUrl">
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Funding commitment</p>
            <a :href="viewUrl(sub.fundingCommitmentDocUrl)" target="_blank" class="text-brand text-xs hover:underline">
              {{ sub.fundingCommitmentDocType ?? 'View document' }} ↗
            </a>
            <AdminLlmStatus :doc-type-match="null" :content-match="sub.fundingCommitmentLlmMatch" :reason="sub.fundingCommitmentLlmReason" />
          </div>

          <!-- Grid Connection (only shown if present) -->
          <div v-if="sub.gridConnectionDocUrl">
            <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Grid connection / offtake agreement</p>
            <a :href="viewUrl(sub.gridConnectionDocUrl)" target="_blank" class="text-brand text-xs hover:underline">
              {{ sub.gridConnectionDocType ?? 'View document' }} ↗
            </a>
            <AdminLlmStatus :doc-type-match="null" :content-match="sub.gridConnectionLlmMatch" :reason="sub.gridConnectionLlmReason" />
          </div>

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
import type { FuturesSubmission } from '~/server/db/schema'

const props = defineProps<{ submissions: FuturesSubmission[] }>()
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
  await $fetch(`/api/futures/${id}`, {
    method: 'PATCH',
    body: { status, reviewNotes: reviewNotes[id] ?? '' },
  })
  emit('refresh')
}

async function reopen(id: string) {
  await $fetch(`/api/futures/${id}`, { method: 'PATCH', body: { status: 'draft' } })
  emit('refresh')
}

const { formatDate, viewUrl } = useFormatters()
</script>
