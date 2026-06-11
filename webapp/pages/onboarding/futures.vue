<template>
  <div class="p-6 max-w-3xl mx-auto space-y-6">
    <div class="flex items-center gap-4">
      <NuxtLink to="/dashboard/generator" class="text-sm text-text-secondary hover:text-text-primary">
        ← Back
      </NuxtLink>
      <h1 class="font-display text-2xl font-semibold text-text-primary">Future generation onboarding</h1>
    </div>

    <!-- Submission complete -->
    <template v-if="submitted">
      <div class="card card-body text-center space-y-3 py-12">
        <div class="text-4xl">✓</div>
        <h2 class="font-display text-xl font-semibold text-text-primary">Submission received</h2>
        <p class="text-sm text-text-secondary max-w-sm mx-auto">
          Your futures project has been submitted for review. REX staff will assess your submission and contact you within 5 business days. Upon commissioning, you will need to complete a full project verification before R-RECs can be issued.
        </p>
        <NuxtLink
          to="/dashboard/generator"
          class="inline-block mt-4 rounded bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Back to dashboard
        </NuxtLink>
      </div>
    </template>

    <!-- Main form -->
    <template v-else>
      <!-- Step indicator -->
      <nav aria-label="Onboarding steps">
        <ol class="flex items-center gap-0" role="list">
          <template v-for="(step, idx) in steps" :key="idx">
            <li class="flex items-center">
              <button
                class="flex items-center justify-center p-2 transition-colors motion-reduce:transition-none"
                :disabled="idx > currentStep"
                :aria-current="currentStep === idx ? 'step' : undefined"
                :aria-label="`Step ${idx + 1} of ${steps.length}: ${step.label}${idx < currentStep ? ' (completed)' : idx === currentStep ? ' (current)' : ''}`"
                @click="idx <= currentStep && (currentStep = idx)"
              >
                <span
                  class="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 transition-colors"
                  :class="idx < currentStep
                    ? stepComplete[idx]
                      ? 'bg-brand border-brand text-white'
                      : 'bg-warning border-warning text-white'
                    : idx === currentStep
                      ? 'border-brand text-brand bg-brand/5'
                      : 'border-border text-text-muted'"
                  aria-hidden="true"
                >
                  {{ idx < currentStep ? (stepComplete[idx] ? '✓' : '!') : idx + 1 }}
                </span>
              </button>
            </li>
            <li v-if="idx < steps.length - 1" class="flex-1 h-px bg-border min-w-2" aria-hidden="true" />
          </template>
        </ol>
      </nav>

      <!-- Step content -->
      <div class="card">
        <div class="card-header">
          <h2 class="font-display text-lg font-semibold">{{ steps[currentStep]?.label }}</h2>
          <span class="text-sm text-text-muted">Step {{ currentStep + 1 }} of {{ steps.length }}</span>
        </div>
        <div class="card-body space-y-5">

          <!-- Step 1: Project info -->
          <template v-if="currentStepKey === 'projectInfo'">
            <p class="text-sm text-text-secondary">Tell us about your project under development. This information helps us classify your futures listing and estimate your R-REC eligibility upon commissioning.</p>
            <div class="space-y-4">
              <div>
                <label for="ft-project-name" class="block text-sm font-medium text-text-secondary mb-1">Project name</label>
                <input id="ft-project-name" v-model="form.projectName" type="text" class="rex-input w-full" placeholder="e.g. Kisegi Solar Farm" />
              </div>
              <div>
                <label for="ft-project-type" class="block text-sm font-medium text-text-secondary mb-1">Project type</label>
                <select id="ft-project-type" v-model="form.projectType" class="rex-select w-full">
                  <option value="">Select type</option>
                  <option value="Utility">Utility</option>
                  <option value="Grid-Connected C&I">Grid-Connected C&amp;I</option>
                  <option value="Off-Grid Mini-Grid/Mesh-Grid">Off-Grid Mini-Grid/Mesh-Grid</option>
                  <option value="Home System">Home System</option>
                </select>
              </div>
              <div>
                <label for="ft-annual-gen" class="block text-sm font-medium text-text-secondary mb-1">Expected annual generation (MWh)</label>
                <input id="ft-annual-gen" v-model.number="form.expectedAnnualGeneration" type="number" min="0" step="0.001" class="rex-input w-full" />
              </div>
              <div>
                <label for="ft-completion-date" class="block text-sm font-medium text-text-secondary mb-1">Expected commissioning date</label>
                <input id="ft-completion-date" v-model="form.expectedCompletionDate" type="date" class="rex-input w-60" />
                <p class="mt-1 text-xs text-text-muted">Per the R-REC Standard, this must be within 18 months of submission.</p>
              </div>
            </div>
          </template>

          <!-- Step 2: Development License and Permissions -->
          <template v-if="currentStepKey === 'devLicense'">
            <p class="text-sm text-text-secondary">Upload a development license or equivalent permission for your project. Acceptable documents include a municipal building permit, environmental clearance certificate, or equivalent regulatory approval specific to renewable energy development. If no such regulatory requirement exists in your jurisdiction, a legal reference confirming this is acceptable.</p>
            <div class="space-y-4">
              <OnboardingDocUpload
                v-model:document-type="form.devLicenseDocType"
                v-model:document-url="form.devLicenseDocUrl"
                folder="futures/dev-license"
                :hide-document-type="true"
                :previous-docs="previousDocs(currentStep)"
              />
              <OnboardingLlmStatus :status="llmStatus.devLicense" :result="llmResults.devLicense" :retryable="llmDirty.devLicense" @retry="analyzeSection('devLicense')" />
            </div>
          </template>

          <!-- Step 3: Land Rights -->
          <template v-if="currentStepKey === 'landRights'">
            <p class="text-sm text-text-secondary">Upload documentation confirming your right to use the land for this project. A property deed, land lease agreement of sufficient duration, or land use rights certificate covering the project area are all acceptable.</p>
            <div class="space-y-4">
              <OnboardingDocUpload
                v-model:document-type="form.landRightsDocType"
                v-model:document-url="form.landRightsDocUrl"
                folder="futures/land-rights"
                :hide-document-type="true"
                :previous-docs="previousDocs(currentStep)"
              />
              <OnboardingLlmStatus :status="llmStatus.landRights" :result="llmResults.landRights" :retryable="llmDirty.landRights" @retry="analyzeSection('landRights')" />
            </div>
          </template>

          <!-- Step 4: Equipment Procurement -->
          <template v-if="currentStepKey === 'equipProcurement'">
            <p class="text-sm text-text-secondary">Upload documentation confirming you have committed to procuring the major generation components. Equipment supplier quotations, memoranda of understanding with suppliers, or conditional purchase agreements for major components such as solar panels, wind turbines, or inverters from recognized manufacturers are acceptable.</p>
            <div class="space-y-4">
              <OnboardingDocUpload
                v-model:document-type="form.equipProcurementDocType"
                v-model:document-url="form.equipProcurementDocUrl"
                folder="futures/equip-procurement"
                :hide-document-type="true"
                :previous-docs="previousDocs(currentStep)"
              />
              <OnboardingLlmStatus :status="llmStatus.equipProcurement" :result="llmResults.equipProcurement" :retryable="llmDirty.equipProcurement" @retry="analyzeSection('equipProcurement')" />
            </div>
          </template>

          <!-- Step 5: Project Timeline -->
          <template v-if="currentStepKey === 'projTimeline'">
            <p class="text-sm text-text-secondary">Upload an implementation schedule showing key milestones and an expected commissioning date within 18 months of submission.</p>
            <div class="space-y-4">
              <OnboardingDocUpload
                v-model:document-type="form.projTimelineDocType"
                v-model:document-url="form.projTimelineDocUrl"
                folder="futures/proj-timeline"
                :hide-document-type="true"
                :previous-docs="previousDocs(currentStep)"
              />
              <OnboardingLlmStatus :status="llmStatus.projTimeline" :result="llmResults.projTimeline" :retryable="llmDirty.projTimeline" @retry="analyzeSection('projTimeline')" />
            </div>
          </template>

          <!-- Step 6: Engineering Specifications -->
          <template v-if="currentStepKey === 'engSpecs'">
            <p class="text-sm text-text-secondary">Upload a technical summary document showing your project's projected capacity, technology type, and basic system design parameters.</p>
            <div class="space-y-4">
              <OnboardingDocUpload
                v-model:document-type="form.engSpecsDocType"
                v-model:document-url="form.engSpecsDocUrl"
                folder="futures/eng-specs"
                :hide-document-type="true"
                :previous-docs="previousDocs(currentStep)"
              />
              <OnboardingLlmStatus :status="llmStatus.engSpecs" :result="llmResults.engSpecs" :retryable="llmDirty.engSpecs" @retry="analyzeSection('engSpecs')" />
            </div>
          </template>

          <!-- Step 7: Funding Commitment -->
          <template v-if="currentStepKey === 'fundingCommitment'">
            <p class="text-sm text-text-secondary">Upload documentation confirming your funding commitment. A bank commitment letter, term sheet, investment agreement, or evidence of available capital covering at least 70% of total project costs are all acceptable.</p>
            <div class="space-y-4">
              <OnboardingDocUpload
                v-model:document-type="form.fundingCommitmentDocType"
                v-model:document-url="form.fundingCommitmentDocUrl"
                folder="futures/funding-commitment"
                :hide-document-type="true"
                :previous-docs="previousDocs(currentStep)"
              />
              <OnboardingLlmStatus :status="llmStatus.fundingCommitment" :result="llmResults.fundingCommitment" :retryable="llmDirty.fundingCommitment" @retry="analyzeSection('fundingCommitment')" />
            </div>
          </template>

          <!-- Step 8: Grid Connection (Utility / Grid-Connected C&I only) -->
          <template v-if="currentStepKey === 'gridConnection'">
            <p class="text-sm text-text-secondary">Upload documentation confirming grid connection or an offtake agreement for your project. A grid connection agreement or utility letter of intent are acceptable.</p>
            <div class="space-y-4">
              <OnboardingDocUpload
                v-model:document-type="form.gridConnectionDocType"
                v-model:document-url="form.gridConnectionDocUrl"
                folder="futures/grid-connection"
                :hide-document-type="true"
                :previous-docs="previousDocs(currentStep)"
              />
              <OnboardingLlmStatus :status="llmStatus.gridConnection" :result="llmResults.gridConnection" :retryable="llmDirty.gridConnection" @retry="analyzeSection('gridConnection')" />
            </div>
          </template>

          <!-- Review & Submit -->
          <template v-if="currentStepKey === 'review'">
            <div class="space-y-4">
              <p class="text-sm text-text-secondary">We use AI to check each uploaded document against the R-REC Standard requirements for futures trading. Green checks mean the document appears to match. Warnings mean a reviewer may ask for clarification. AI is not perfect and may have made a mistake. You can still submit with warnings; a REX staff member makes the final determination.</p>

              <ul class="space-y-2">
                <li
                  v-for="section in activeSections"
                  :key="section"
                  class="flex items-start gap-3 rounded border border-border px-4 py-3"
                >
                  <!-- Status icon -->
                  <span class="mt-0.5 shrink-0 text-sm">
                    <template v-if="llmStatus[section] === 'idle'">–</template>
                    <template v-else-if="llmStatus[section] === 'running'">⋯</template>
                    <template v-else-if="llmStatus[section] === 'error' || llmStatus[section] === 'unavailable'">–</template>
                    <template v-else-if="llmStatus[section] === 'done' && llmResults[section]?.contentMatches !== false">✓</template>
                    <template v-else>⚠</template>
                  </span>

                  <div class="flex-1 min-w-0 space-y-0.5">
                    <p
                      class="text-sm font-medium"
                      :class="{
                        'text-text-primary': llmStatus[section] === 'idle' || llmStatus[section] === 'error' || llmStatus[section] === 'unavailable',
                        'text-text-muted':   llmStatus[section] === 'running',
                        'text-success':      llmStatus[section] === 'done' && llmResults[section]?.contentMatches !== false,
                        'text-warning-text': llmStatus[section] === 'done' && llmResults[section]?.contentMatches === false,
                      }"
                    >{{ SECTION_LABELS[section] }}</p>
                    <p v-if="llmStatus[section] === 'running'" class="text-xs text-text-muted">Verifying…</p>
                    <p v-else-if="llmStatus[section] === 'idle'" class="text-xs text-text-muted">Not uploaded</p>
                    <template v-else-if="llmStatus[section] === 'unavailable'">
                      <p class="text-xs text-text-muted">Verification service temporarily unavailable</p>
                      <button type="button" class="text-xs text-brand hover:underline" @click="analyzeSection(section)">Retry</button>
                    </template>
                    <template v-else-if="llmStatus[section] === 'error'">
                      <p class="text-xs text-text-muted">Verification unavailable</p>
                      <button type="button" class="text-xs text-brand hover:underline" @click="analyzeSection(section)">Retry</button>
                    </template>
                    <template v-else-if="llmResults[section]?.contentMatches === false">
                      <p class="text-xs text-warning-text opacity-80">{{ llmResults[section]?.reasonForFalse ?? 'Does not match the required description' }}</p>
                      <button v-if="llmDirty[section]" type="button" class="text-xs text-brand hover:underline" @click="analyzeSection(section)">Retry verification</button>
                      <p v-else class="text-xs text-text-muted italic">Update your document to retry</p>
                    </template>
                  </div>
                </li>
              </ul>

              <!-- Override acknowledgement — only shown when there are warnings -->
              <div v-if="llmWarningItems.length" class="rounded border border-warning-subtle bg-warning-subtle px-4 py-3 space-y-2">
                <p class="text-xs text-warning-text opacity-80">
                  The reviewer will make the final determination. You may still submit, but flagged documents may delay approval.
                </p>
                <label class="flex items-start gap-2 cursor-pointer select-none">
                  <input v-model="llmOverrideAcknowledged" type="checkbox" class="mt-0.5 shrink-0" />
                  <span class="text-sm text-warning-text">I understand and want to submit anyway</span>
                </label>
              </div>
            </div>
          </template>

        </div>

        <!-- Navigation -->
        <div class="px-5 py-4 border-t border-border flex items-center justify-between">
          <button
            v-if="currentStep > 0"
            class="rounded border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            @click="currentStep--"
          >
            Previous
          </button>
          <span v-else />

          <div class="flex flex-col items-end gap-2">
            <p v-if="submitError && currentStepKey === 'review'" role="alert" aria-live="assertive" class="text-xs text-danger text-right">
              {{ submitError }}
            </p>
            <div class="flex gap-3">
              <button
                class="rounded border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                :disabled="saving"
                @click="saveDraft"
              >
                Save draft
              </button>
              <button
                v-if="currentStepKey !== 'review'"
                class="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                @click="goNext"
              >
                Continue
              </button>
              <button
                v-else
                class="rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                :disabled="saving"
                @click="submitForm"
              >
                {{ saving ? 'Submitting…' : 'Submit for review' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Future Generation Onboarding' })

// ── Types ─────────────────────────────────────────────────────────────────────

type Section =
  | 'devLicense'
  | 'landRights'
  | 'equipProcurement'
  | 'projTimeline'
  | 'engSpecs'
  | 'fundingCommitment'
  | 'gridConnection'

type StepKey = 'projectInfo' | Section | 'review'

type LlmStatus = 'idle' | 'running' | 'done' | 'error' | 'unavailable'

interface LlmResult {
  documentTypeMatches: boolean | null
  contentMatches: boolean
  reasonForFalse: string | null
}

// ── Draft resume ──────────────────────────────────────────────────────────────

interface SavedSubmission {
  id: number; uuid: string; status: string
  projectName: string | null; projectType: string | null
  expectedAnnualGeneration: string | null; expectedCompletionDate: string | null
  devLicenseDocUrl: string | null; devLicenseDocType: string | null
  devLicenseLlmMatch: boolean | null; devLicenseLlmReason: string | null
  landRightsDocUrl: string | null; landRightsDocType: string | null
  landRightsLlmMatch: boolean | null; landRightsLlmReason: string | null
  equipProcurementDocUrl: string | null; equipProcurementDocType: string | null
  equipProcurementLlmMatch: boolean | null; equipProcurementLlmReason: string | null
  projTimelineDocUrl: string | null; projTimelineDocType: string | null
  projTimelineLlmMatch: boolean | null; projTimelineLlmReason: string | null
  engSpecsDocUrl: string | null; engSpecsDocType: string | null
  engSpecsLlmMatch: boolean | null; engSpecsLlmReason: string | null
  fundingCommitmentDocUrl: string | null; fundingCommitmentDocType: string | null
  fundingCommitmentLlmMatch: boolean | null; fundingCommitmentLlmReason: string | null
  gridConnectionDocUrl: string | null; gridConnectionDocType: string | null
  gridConnectionLlmMatch: boolean | null; gridConnectionLlmReason: string | null
}

const route = useRoute()

onMounted(async () => {
  const rawId = route.query.id
  if (!rawId || typeof rawId !== 'string') return

  let sub: SavedSubmission
  try {
    const res = await $fetch<{ submission: SavedSubmission }>(`/api/futures/${rawId}`)
    sub = res.submission
  } catch {
    return
  }

  if (sub.status !== 'draft') {
    submitError.value = `This submission is currently ${sub.status} and cannot be edited.`
    return
  }

  draftId.value = sub.uuid

  form.projectName              = sub.projectName ?? ''
  form.projectType              = sub.projectType ?? ''
  form.expectedAnnualGeneration = sub.expectedAnnualGeneration ? parseFloat(sub.expectedAnnualGeneration) : null
  form.expectedCompletionDate   = sub.expectedCompletionDate ?? ''
  form.devLicenseDocUrl         = sub.devLicenseDocUrl ?? ''
  form.devLicenseDocType        = sub.devLicenseDocType || 'Development license'
  form.landRightsDocUrl         = sub.landRightsDocUrl ?? ''
  form.landRightsDocType        = sub.landRightsDocType || 'Land rights'
  form.equipProcurementDocUrl   = sub.equipProcurementDocUrl ?? ''
  form.equipProcurementDocType  = sub.equipProcurementDocType || 'Equipment procurement'
  form.projTimelineDocUrl       = sub.projTimelineDocUrl ?? ''
  form.projTimelineDocType      = sub.projTimelineDocType || 'Project timeline'
  form.engSpecsDocUrl           = sub.engSpecsDocUrl ?? ''
  form.engSpecsDocType          = sub.engSpecsDocType || 'Engineering specifications'
  form.fundingCommitmentDocUrl  = sub.fundingCommitmentDocUrl ?? ''
  form.fundingCommitmentDocType = sub.fundingCommitmentDocType || 'Funding commitment'
  form.gridConnectionDocUrl     = sub.gridConnectionDocUrl ?? ''
  form.gridConnectionDocType    = sub.gridConnectionDocType || 'Grid connection'

  // Restore LLM results
  function restoreResult(section: Section, match: boolean | null, reason: string | null) {
    if (match === null) return
    llmResults[section] = { documentTypeMatches: null, contentMatches: match, reasonForFalse: reason }
    llmStatus[section] = 'done'
  }

  restoreResult('devLicense',        sub.devLicenseLlmMatch,        sub.devLicenseLlmReason)
  restoreResult('landRights',        sub.landRightsLlmMatch,        sub.landRightsLlmReason)
  restoreResult('equipProcurement',  sub.equipProcurementLlmMatch,  sub.equipProcurementLlmReason)
  restoreResult('projTimeline',      sub.projTimelineLlmMatch,      sub.projTimelineLlmReason)
  restoreResult('engSpecs',          sub.engSpecsLlmMatch,          sub.engSpecsLlmReason)
  restoreResult('fundingCommitment', sub.fundingCommitmentLlmMatch, sub.fundingCommitmentLlmReason)
  restoreResult('gridConnection',    sub.gridConnectionLlmMatch,    sub.gridConnectionLlmReason)
})

// ── Steps (dynamic — includes grid connection only for Utility / Grid-Connected C&I) ───

const ALL_DOC_STEPS: Array<{ key: StepKey; label: string; section?: Section }> = [
  { key: 'devLicense',        label: 'Development license',    section: 'devLicense' },
  { key: 'landRights',        label: 'Land rights',            section: 'landRights' },
  { key: 'equipProcurement',  label: 'Equipment',              section: 'equipProcurement' },
  { key: 'projTimeline',      label: 'Timeline',               section: 'projTimeline' },
  { key: 'engSpecs',          label: 'Engineering',            section: 'engSpecs' },
  { key: 'fundingCommitment', label: 'Funding',                section: 'fundingCommitment' },
  { key: 'gridConnection',    label: 'Grid connection',        section: 'gridConnection' },
]

const requiresGridConnection = computed(() =>
  form.projectType === 'Utility' || form.projectType === 'Grid-Connected C&I',
)

const steps = computed(() => {
  const docSteps = requiresGridConnection.value
    ? ALL_DOC_STEPS
    : ALL_DOC_STEPS.filter(s => s.key !== 'gridConnection')

  return [
    { key: 'projectInfo' as StepKey, label: 'Project info' },
    ...docSteps,
    { key: 'review' as StepKey, label: 'Review & Submit' },
  ]
})

// Sections that are active for this project type (used in review step)
const activeSections = computed<Section[]>(() => {
  const base: Section[] = ['devLicense', 'landRights', 'equipProcurement', 'projTimeline', 'engSpecs', 'fundingCommitment']
  if (requiresGridConnection.value) base.push('gridConnection')
  return base
})

const currentStep = ref(0)
const currentStepKey = computed(() => steps.value[currentStep.value]?.key ?? 'projectInfo')

const saving      = ref(false)
const submitted   = ref(false)
const draftId     = ref<string | null>(null)
const submitError = ref('')

// ── LLM document verification ─────────────────────────────────────────────────

const llmStatus = reactive<Record<Section, LlmStatus>>({
  devLicense:        'idle',
  landRights:        'idle',
  equipProcurement:  'idle',
  projTimeline:      'idle',
  engSpecs:          'idle',
  fundingCommitment: 'idle',
  gridConnection:    'idle',
})
const llmResults = reactive<Partial<Record<Section, LlmResult>>>({})
const llmDirty   = reactive<Record<Section, boolean>>({
  devLicense:        false,
  landRights:        false,
  equipProcurement:  false,
  projTimeline:      false,
  engSpecs:          false,
  fundingCommitment: false,
  gridConnection:    false,
})
const llmOverrideAcknowledged = ref(false)

// ── Form state ────────────────────────────────────────────────────────────────

const form = reactive({
  // Step 1 — Project info
  projectName:              '',
  projectType:              '',
  expectedAnnualGeneration: null as number | null,
  expectedCompletionDate:   '',

  // Step 2 — Development License
  devLicenseDocUrl:  '',
  devLicenseDocType: 'Development license',

  // Step 3 — Land Rights
  landRightsDocUrl:  '',
  landRightsDocType: 'Land rights',

  // Step 4 — Equipment Procurement
  equipProcurementDocUrl:  '',
  equipProcurementDocType: 'Equipment procurement',

  // Step 5 — Project Timeline
  projTimelineDocUrl:  '',
  projTimelineDocType: 'Project timeline',

  // Step 6 — Engineering Specifications
  engSpecsDocUrl:  '',
  engSpecsDocType: 'Engineering specifications',

  // Step 7 — Funding Commitment
  fundingCommitmentDocUrl:  '',
  fundingCommitmentDocType: 'Funding commitment',

  // Step 8 — Grid Connection (conditional)
  gridConnectionDocUrl:  '',
  gridConnectionDocType: 'Grid connection',
})

// ── Step completion ───────────────────────────────────────────────────────────

const stepComplete = computed(() =>
  steps.value.map((step) => {
    switch (step.key) {
      case 'projectInfo':       return !!(form.projectName?.trim() && form.projectType && form.expectedAnnualGeneration && form.expectedCompletionDate)
      case 'devLicense':        return !!(form.devLicenseDocUrl && form.devLicenseDocType)
      case 'landRights':        return !!(form.landRightsDocUrl && form.landRightsDocType)
      case 'equipProcurement':  return !!(form.equipProcurementDocUrl && form.equipProcurementDocType)
      case 'projTimeline':      return !!(form.projTimelineDocUrl && form.projTimelineDocType)
      case 'engSpecs':          return !!(form.engSpecsDocUrl && form.engSpecsDocType)
      case 'fundingCommitment': return !!(form.fundingCommitmentDocUrl && form.fundingCommitmentDocType)
      case 'gridConnection':    return !!(form.gridConnectionDocUrl && form.gridConnectionDocType)
      case 'review':            return true
      default:                  return false
    }
  }),
)

// ── Analyze section ───────────────────────────────────────────────────────────

async function analyzeSection(section: Section) {
  const urlMap: Record<Section, string> = {
    devLicense:        form.devLicenseDocUrl,
    landRights:        form.landRightsDocUrl,
    equipProcurement:  form.equipProcurementDocUrl,
    projTimeline:      form.projTimelineDocUrl,
    engSpecs:          form.engSpecsDocUrl,
    fundingCommitment: form.fundingCommitmentDocUrl,
    gridConnection:    form.gridConnectionDocUrl,
  }
  const url = urlMap[section]
  if (!url) return

  llmDirty[section]  = false
  llmStatus[section] = 'running'
  try {
    const result = await $fetch<LlmResult>('/api/futures/analyze', {
      method: 'POST',
      body: { section, urls: [url], submissionId: draftId.value ?? undefined },
    })
    llmResults[section] = result
    llmStatus[section] = 'done'
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode
      ?? (err as { status?: number })?.status
    llmStatus[section] = (statusCode === 503 || statusCode === 429) ? 'unavailable' : 'error'
  }
}

// Map step key to section for auto-triggering on Continue
const STEP_KEY_TO_SECTION: Partial<Record<StepKey, Section>> = {
  devLicense:        'devLicense',
  landRights:        'landRights',
  equipProcurement:  'equipProcurement',
  projTimeline:      'projTimeline',
  engSpecs:          'engSpecs',
  fundingCommitment: 'fundingCommitment',
  gridConnection:    'gridConnection',
}

function goNext() {
  const section = STEP_KEY_TO_SECTION[currentStepKey.value]
  if (section && llmStatus[section] === 'idle') analyzeSection(section)
  currentStep.value++
}

// Auto-analyze when a document URL is first set
watch(() => form.devLicenseDocUrl,        (url) => { if (url && llmStatus.devLicense        === 'idle') analyzeSection('devLicense') })
watch(() => form.landRightsDocUrl,        (url) => { if (url && llmStatus.landRights        === 'idle') analyzeSection('landRights') })
watch(() => form.equipProcurementDocUrl,  (url) => { if (url && llmStatus.equipProcurement  === 'idle') analyzeSection('equipProcurement') })
watch(() => form.projTimelineDocUrl,      (url) => { if (url && llmStatus.projTimeline      === 'idle') analyzeSection('projTimeline') })
watch(() => form.engSpecsDocUrl,          (url) => { if (url && llmStatus.engSpecs          === 'idle') analyzeSection('engSpecs') })
watch(() => form.fundingCommitmentDocUrl, (url) => { if (url && llmStatus.fundingCommitment === 'idle') analyzeSection('fundingCommitment') })
watch(() => form.gridConnectionDocUrl,    (url) => { if (url && llmStatus.gridConnection    === 'idle') analyzeSection('gridConnection') })

// Mark section dirty when its inputs change after analysis has run
const sectionInputs: Record<Section, () => unknown> = {
  devLicense:        () => [form.devLicenseDocUrl,        form.devLicenseDocType],
  landRights:        () => [form.landRightsDocUrl,        form.landRightsDocType],
  equipProcurement:  () => [form.equipProcurementDocUrl,  form.equipProcurementDocType],
  projTimeline:      () => [form.projTimelineDocUrl,      form.projTimelineDocType],
  engSpecs:          () => [form.engSpecsDocUrl,          form.engSpecsDocType],
  fundingCommitment: () => [form.fundingCommitmentDocUrl, form.fundingCommitmentDocType],
  gridConnection:    () => [form.gridConnectionDocUrl,    form.gridConnectionDocType],
}

for (const [sec, getter] of Object.entries(sectionInputs) as [Section, () => unknown][]) {
  watch(getter, () => {
    if (llmStatus[sec] !== 'idle' && llmStatus[sec] !== 'running') {
      llmDirty[sec] = true
    }
  })
}

const SECTION_LABELS: Record<Section, string> = {
  devLicense:        'Development license / permissions',
  landRights:        'Land rights',
  equipProcurement:  'Equipment procurement',
  projTimeline:      'Project timeline',
  engSpecs:          'Engineering specifications',
  fundingCommitment: 'Funding commitment',
  gridConnection:    'Grid connection / offtake agreement',
}

const llmWarningItems = computed(() =>
  activeSections.value.filter((section) => {
    const r = llmResults[section]
    return r && r.contentMatches === false
  }).map((section) => ({
    section,
    label:  SECTION_LABELS[section],
    reason: llmResults[section]!.reasonForFalse ?? 'Does not match the required description',
  })),
)

const hasLlmWarnings = computed(() => llmWarningItems.value.length > 0)

// ── previousDocs helper ───────────────────────────────────────────────────────

/** Returns already-uploaded docs from all earlier doc steps for reuse. */
function previousDocs(forStepIndex: number): Array<{ label: string; docUrl: string; docType: string }> {
  const docs: Array<{ label: string; docUrl: string; docType: string }> = []
  const docFieldPairs: Array<[string, string, string]> = [
    [form.devLicenseDocUrl,        form.devLicenseDocType,        'Development license'],
    [form.landRightsDocUrl,        form.landRightsDocType,        'Land rights'],
    [form.equipProcurementDocUrl,  form.equipProcurementDocType,  'Equipment procurement'],
    [form.projTimelineDocUrl,      form.projTimelineDocType,      'Project timeline'],
    [form.engSpecsDocUrl,          form.engSpecsDocType,          'Engineering specs'],
    [form.fundingCommitmentDocUrl, form.fundingCommitmentDocType, 'Funding commitment'],
    [form.gridConnectionDocUrl,    form.gridConnectionDocType,    'Grid connection'],
  ]
  // Steps 1 (index 0) is project info; doc steps start at index 1.
  // We expose docs from all steps before the current one.
  for (let i = 0; i < forStepIndex - 1 && i < docFieldPairs.length; i++) {
    const [docUrl, docType, fallbackLabel] = docFieldPairs[i]
    if (docUrl && docType) {
      docs.push({ label: docType || fallbackLabel, docUrl, docType })
    }
  }
  return docs
}

// ── Payload / save / submit ───────────────────────────────────────────────────

function buildPayload(status: 'draft' | 'pending') {
  return {
    status,
    projectName:              form.projectName || undefined,
    projectType:              form.projectType || undefined,
    expectedAnnualGeneration: form.expectedAnnualGeneration ?? undefined,
    expectedCompletionDate:   form.expectedCompletionDate || undefined,
    devLicenseDocUrl:         form.devLicenseDocUrl || undefined,
    devLicenseDocType:        form.devLicenseDocType || undefined,
    landRightsDocUrl:         form.landRightsDocUrl || undefined,
    landRightsDocType:        form.landRightsDocType || undefined,
    equipProcurementDocUrl:   form.equipProcurementDocUrl || undefined,
    equipProcurementDocType:  form.equipProcurementDocType || undefined,
    projTimelineDocUrl:       form.projTimelineDocUrl || undefined,
    projTimelineDocType:      form.projTimelineDocType || undefined,
    engSpecsDocUrl:           form.engSpecsDocUrl || undefined,
    engSpecsDocType:          form.engSpecsDocType || undefined,
    fundingCommitmentDocUrl:  form.fundingCommitmentDocUrl || undefined,
    fundingCommitmentDocType: form.fundingCommitmentDocType || undefined,
    gridConnectionDocUrl:     form.gridConnectionDocUrl || undefined,
    gridConnectionDocType:    form.gridConnectionDocType || undefined,
  }
}

async function saveDraft() {
  saving.value = true
  try {
    const payload = buildPayload('draft')
    if (draftId.value) {
      await $fetch(`/api/futures/${draftId.value}`, { method: 'PATCH', body: payload })
    } else {
      const resp = await $fetch('/api/futures', { method: 'POST', body: payload })
      draftId.value = (resp as { submission: { uuid: string } }).submission.uuid
    }
  } finally {
    saving.value = false
  }
}

function validateSubmit(): string {
  if (!form.projectName?.trim())          return 'Project name is required (step 1)'
  if (!form.projectType)                  return 'Project type is required (step 1)'
  if (!form.expectedAnnualGeneration)     return 'Expected annual generation is required (step 1)'
  if (!form.expectedCompletionDate)       return 'Expected commissioning date is required (step 1)'
  if (!form.devLicenseDocUrl)             return 'Development license document is required (step 2)'
  if (!form.landRightsDocUrl)             return 'Land rights document is required (step 3)'
  if (!form.equipProcurementDocUrl)       return 'Equipment procurement document is required (step 4)'
  if (!form.projTimelineDocUrl)           return 'Project timeline document is required (step 5)'
  if (!form.engSpecsDocUrl)              return 'Engineering specifications document is required (step 6)'
  if (!form.fundingCommitmentDocUrl)      return 'Funding commitment document is required (step 7)'
  if (requiresGridConnection.value && !form.gridConnectionDocUrl) {
    return 'Grid connection or offtake agreement document is required (step 8)'
  }
  return ''
}

async function submitForm() {
  submitError.value = ''
  const validationMsg = validateSubmit()
  if (validationMsg) {
    submitError.value = validationMsg
    return
  }
  if (hasLlmWarnings.value && !llmOverrideAcknowledged.value) {
    submitError.value = 'Please review the document verification warnings above and check the acknowledgement box to proceed.'
    return
  }
  saving.value = true
  try {
    const payload = buildPayload('pending')
    if (draftId.value) {
      await $fetch(`/api/futures/${draftId.value}`, { method: 'PATCH', body: payload })
    } else {
      await $fetch('/api/futures', { method: 'POST', body: payload })
    }
    submitted.value = true
  } finally {
    saving.value = false
  }
}
</script>
