<template>
  <div class="p-6 max-w-3xl mx-auto space-y-6">
    <div class="flex items-center gap-4">
      <NuxtLink to="/dashboard/generator" class="text-sm text-text-secondary hover:text-text-primary">
        ← Back
      </NuxtLink>
      <h1 class="font-display text-2xl font-semibold text-text-primary">New project onboarding</h1>
    </div>

    <!-- Submission complete -->
    <template v-if="submitted">
      <div class="card card-body text-center space-y-3 py-12">
        <div class="text-4xl">✓</div>
        <h2 class="font-display text-xl font-semibold text-text-primary">Submission received</h2>
        <p class="text-sm text-text-secondary max-w-sm mx-auto">
          Your project has been submitted for review. REX staff will assess your submission and contact you within 5 business days.
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
                class="flex items-center justify-center p-1 transition-colors motion-reduce:transition-none"
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
                      : 'bg-amber-400 border-amber-400 text-white'
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
          <template v-if="currentStep === 0">
            <p class="text-sm text-text-secondary">Tell us about your project. This basic information helps us classify your submission and estimate your R-REC eligibility.</p>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1">Project name</label>
                <input v-model="form.projectName" type="text" class="rex-input w-full" placeholder="e.g. Kisegi Solar Farm" />
              </div>
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1">Project type</label>
                <select v-model="form.projectType" class="rex-select w-full">
                  <option value="">Select type</option>
                  <option value="Utility">Utility</option>
                  <option value="Grid-Connected C&I">Grid-Connected C&amp;I</option>
                  <option value="Off-Grid Mini-Grid/Mesh-Grid">Off-Grid Mini-Grid/Mesh-Grid</option>
                  <option value="Home System">Home System</option>
                </select>
                <p v-if="form.projectType === 'Home System'" class="mt-2 text-sm text-text-muted">
                  You can register an entire country-wide fleet of home systems as a single project. You don't need to submit a separate form for each individual unit.
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1">Expected annual generation (MWh)</label>
                <input v-model.number="form.expectedAnnualGeneration" type="number" min="0" step="0.001" class="rex-input w-full" />
              </div>
            </div>
          </template>

          <!-- Step 2: Generation type -->
          <template v-if="currentStep === 1">
            <p class="text-sm text-text-secondary">Upload a document that confirms your project's energy source: solar, wind, hydro, etc. Any commissioning report, off-taker agreement, equipment purchase contract, operating license, or environmental permit is acceptable.<span v-if="form.projectType === 'Home System'"> For a home system fleet, a sample equipment purchase contract or a representative supplier agreement covering your units is sufficient.</span></p>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1">Primary energy source</label>
                <select v-model="form.genGenerationType" class="rex-select w-full">
                  <option value="">Select source</option>
                  <option value="solar">Solar</option>
                  <option value="wind">Wind</option>
                  <option value="hydro">Hydro</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <!-- Secondary source -->
              <div v-if="!showSecondary">
                <button type="button" class="text-sm text-brand hover:underline" @click="showSecondary = true">
                  + Add secondary energy source
                </button>
              </div>
              <template v-else>
                <div class="space-y-3 rounded border border-border p-4">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-text-secondary">Secondary energy source</span>
                    <button type="button" class="text-xs text-danger hover:underline" @click="removeSecondary">Remove</button>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-text-secondary mb-1">Source type</label>
                    <input v-model="form.genSecondarySrc" type="text" class="rex-input w-full" placeholder="e.g. Diesel, Grid, Wind" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-text-secondary mb-1">Short description</label>
                    <input v-model="form.genSecondaryDesc" type="text" class="rex-input w-full" placeholder="Brief description" />
                  </div>
                </div>

                <!-- Tertiary source -->
                <div v-if="!showTertiary">
                  <button type="button" class="text-sm text-brand hover:underline" @click="showTertiary = true">
                    + Add tertiary energy source
                  </button>
                </div>
                <div v-else class="space-y-3 rounded border border-border p-4">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-text-secondary">Tertiary energy source</span>
                    <button type="button" class="text-xs text-danger hover:underline" @click="removeTertiary">Remove</button>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-text-secondary mb-1">Source type</label>
                    <input v-model="form.genTertiarySrc" type="text" class="rex-input w-full" placeholder="e.g. Diesel, Grid, Wind" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-text-secondary mb-1">Short description</label>
                    <input v-model="form.genTertiaryDesc" type="text" class="rex-input w-full" placeholder="Brief description" />
                  </div>
                </div>
              </template>

              <OnboardingDocUpload
                v-model:document-type="form.genDocType"
                v-model:document-url="form.genDocUrl"
                folder="onboarding/generation-type"
                :previous-docs="previousDocs(1)"
              />
              <OnboardingLlmStatus :status="llmStatus.gen" :result="llmResults.gen" :retryable="llmDirty.gen" @retry="analyzeSection('gen')" />
            </div>
          </template>

          <!-- Step 3: Capacity -->
          <template v-if="currentStep === 2">
            <p class="text-sm text-text-secondary">Upload a document that confirms your system's installed generation capacity in kilowatts-peak (kWp). Equipment purchase contracts, technical inspection certificates, or commissioning reports work well here. You may reuse a document uploaded in a previous step if it also specifies your system's capacity.<span v-if="form.projectType === 'Home System'"> For a home system fleet, enter the combined total capacity across all units and upload documentation that reflects the full fleet size, such as a bulk purchase order.</span></p>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1">Installed capacity (kWp)</label>
                <input v-model.number="form.capCapacity" type="number" min="0" step="0.001" class="rex-input w-full" />
              </div>
              <OnboardingDocUpload
                v-model:document-type="form.capDocType"
                v-model:document-url="form.capDocUrl"
                folder="onboarding/capacity"
                :previous-docs="previousDocs(2)"
              />
              <OnboardingLlmStatus :status="llmStatus.cap" :result="llmResults.cap" :retryable="llmDirty.cap" @retry="analyzeSection('cap')" />
            </div>
          </template>

          <!-- Step 4: Location -->
          <template v-if="currentStep === 3">
            <p class="text-sm text-text-secondary">Provide GPS coordinates and a document that confirms your project's physical location. Land lease agreements, grid connection agreements, or any document referencing the site address are all acceptable. Coordinates must include at least 2 decimal places. The document does not need to include the GPS coordinates; a physical address will do just fine.<span v-if="form.projectType === 'Home System'"> For a home system fleet, provide coordinates for your primary operating location or country headquarters, and upload any business registration or deployment agreement that confirms your area of operation.</span></p>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1">
                  Physical address
                  <span class="ml-1 font-normal text-text-muted">(optional)</span>
                </label>
                <input v-model="form.locPhysicalAddress" type="text" class="rex-input w-full" />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-text-secondary mb-1">Latitude</label>
                  <input
                    v-model="form.locLatStr"
                    type="text"
                    inputmode="decimal"
                    class="rex-input w-full"
                    :class="latError ? 'border-danger' : ''"
                    placeholder="e.g. -0.12"
                    @blur="validateLatLon"
                  />
                  <p v-if="latError" class="mt-1 text-xs text-danger">{{ latError }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-secondary mb-1">Longitude</label>
                  <input
                    v-model="form.locLonStr"
                    type="text"
                    inputmode="decimal"
                    class="rex-input w-full"
                    :class="lonError ? 'border-danger' : ''"
                    placeholder="e.g. 34.57"
                    @blur="validateLatLon"
                  />
                  <p v-if="lonError" class="mt-1 text-xs text-danger">{{ lonError }}</p>
                </div>
              </div>
              <OnboardingDocUpload
                v-model:document-type="form.locDocType"
                v-model:document-url="form.locDocUrl"
                folder="onboarding/location"
                :previous-docs="previousDocs(3)"
              />
              <OnboardingLlmStatus :status="llmStatus.loc" :result="llmResults.loc" :retryable="llmDirty.loc" @retry="analyzeSection('loc')" />
            </div>
          </template>

          <!-- Step 5: Date of first operation -->
          <template v-if="currentStep === 4">
            <p class="text-sm text-text-secondary">Provide the date your project first generated renewable energy. A project commissioning report is ideal, but any document that establishes when operations began, including an equipment installation contract or grid connection agreement, is acceptable.<span v-if="form.projectType === 'Home System'"> For a home system fleet, use the date the first units in the fleet were deployed and generating energy.</span></p>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1">Date of first operation</label>
                <input v-model="form.dateDateOfFirstOperation" type="date" class="rex-input w-60" />
              </div>
              <p class="text-sm text-text-muted">
                If commissioning documentation is unavailable, an owner declaration with metering data showing initial generation is acceptable per the R-REC Standard.
              </p>
              <OnboardingDocUpload
                v-model:document-type="form.dateDocType"
                v-model:document-url="form.dateDocUrl"
                folder="onboarding/date-of-first-operation"
                :allow-owner-declaration="true"
                :previous-docs="previousDocs(4)"
              />
              <OnboardingLlmStatus :status="llmStatus.date" :result="llmResults.date" :retryable="llmDirty.date" @retry="analyzeSection('date')" />
            </div>
          </template>

          <!-- Step 6: Generation equipment photos -->
          <template v-if="currentStep === 5">
            <div class="space-y-4">
              <p class="text-sm text-text-secondary">The R-REC Standard requires clear photographs of all installed generation equipment. Upload photos of your solar panels, wind turbines, inverters, or other primary generation hardware. At least one photo is required.<span v-if="form.projectType === 'Home System'"> For a home system fleet, a representative photo showing typical installed units is sufficient. You do not need to photograph every home.</span></p>
              <OnboardingPhotoUpload
                v-model="form.photosGen"
                folder="onboarding/equipment-photos"
                label="generation equipment"
              />
              <OnboardingLlmStatus :status="llmStatus.photosGen" :result="llmResults.photosGen" :retryable="llmDirty.photosGen" @retry="analyzeSection('photosGen')" />
            </div>
          </template>

          <!-- Step 7: Metering photos -->
          <template v-if="currentStep === 6">
            <div class="space-y-4">
              <p class="text-sm text-text-secondary">Upload clear photographs of your metering and monitoring equipment as it is installed. In the absence of a traditional smart meter, a photo of an inverter or other device with built-in metrology equipment is acceptable. The Standard requires this to confirm the metering system used to record generation data. Include the meter display and any data loggers if visible.<span v-if="form.projectType === 'Home System'"> For a home system fleet, a representative photo of the meters used across your units is sufficient.</span></p>
              <OnboardingPhotoUpload
                v-model="form.photosMeter"
                folder="onboarding/metering-photos"
                label="metering equipment"
              />
              <OnboardingLlmStatus :status="llmStatus.photosMeter" :result="llmResults.photosMeter" :retryable="llmDirty.photosMeter" @retry="analyzeSection('photosMeter')" />
            </div>
          </template>

          <!-- Step 8: Review & Submit -->
          <template v-if="currentStep === 7">
            <div class="space-y-4">
              <p class="text-sm text-text-secondary">We use AI to check each uploaded document against your submitted details. Green checks mean the document appears to match. Warnings mean a reviewer may ask for clarification. AI is not perfect, and it may have made a mistake. You can still submit with warnings; a REX staff member makes the final determination.</p>

              <ul class="space-y-2">
                <li
                  v-for="section in (Object.keys(SECTION_LABELS) as Section[])"
                  :key="section"
                  class="flex items-start gap-3 rounded border border-border px-4 py-3"
                >
                  <!-- Status icon -->
                  <span class="mt-0.5 shrink-0 text-sm">
                    <template v-if="llmStatus[section] === 'idle'">–</template>
                    <template v-else-if="llmStatus[section] === 'running'">⋯</template>
                    <template v-else-if="llmStatus[section] === 'error' || llmStatus[section] === 'unavailable'">–</template>
                    <template v-else-if="llmStatus[section] === 'done' && llmResults[section]?.documentTypeMatches !== false && llmResults[section]?.contentMatches !== false">✓</template>
                    <template v-else>⚠</template>
                  </span>

                  <div class="flex-1 min-w-0 space-y-0.5">
                    <p
                      class="text-sm font-medium"
                      :class="{
                        'text-text-primary': llmStatus[section] === 'idle' || llmStatus[section] === 'error' || llmStatus[section] === 'unavailable',
                        'text-text-muted':   llmStatus[section] === 'running',
                        'text-success':      llmStatus[section] === 'done' && llmResults[section]?.documentTypeMatches !== false && llmResults[section]?.contentMatches !== false,
                        'text-amber-700':    llmStatus[section] === 'done' && (llmResults[section]?.documentTypeMatches === false || llmResults[section]?.contentMatches === false),
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
                    <template v-else-if="llmResults[section]?.documentTypeMatches === false || llmResults[section]?.contentMatches === false">
                      <p class="text-xs text-amber-700">{{ llmResults[section]?.reasonForFalse ?? 'Does not match submission' }}</p>
                      <button v-if="llmDirty[section]" type="button" class="text-xs text-brand hover:underline" @click="analyzeSection(section)">Retry verification</button>
                      <p v-else class="text-xs text-text-muted italic">Update your document or inputs to retry</p>
                    </template>
                  </div>
                </li>
              </ul>

              <!-- Override acknowledgement — only shown when there are warnings -->
              <div v-if="llmWarningItems.length" class="rounded border border-amber-300 bg-amber-50 px-4 py-3 space-y-2">
                <p class="text-xs text-amber-800">
                  The reviewer will make the final determination. You may still submit, but flagged documents may delay approval.
                </p>
                <label class="flex items-start gap-2 cursor-pointer select-none">
                  <input v-model="llmOverrideAcknowledged" type="checkbox" class="mt-0.5 shrink-0" />
                  <span class="text-sm text-amber-900">I understand and want to submit anyway</span>
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
            <p v-if="submitError && currentStep === steps.length - 1" role="alert" aria-live="assertive" class="text-xs text-danger text-right">
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
                v-if="currentStep < steps.length - 1"
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
useHead({ title: 'Project Onboarding' })

// ── Draft resume ──────────────────────────────────────────────────────────────

interface SavedSubmission {
  id: number; uuid: string; status: string
  projectName: string | null; projectType: string | null
  expectedAnnualGeneration: string | null
  genGenerationType: string | null
  genDocUrl: string | null; genDocType: string | null
  genSecondarySrc: string | null; genSecondaryDesc: string | null
  genTertiarySrc: string | null; genTertiaryDesc: string | null
  capCapacity: string | null; capDocUrl: string | null; capDocType: string | null
  locPhysicalAddress: string | null
  locLat: number | null; locLon: number | null
  locDocUrl: string | null; locDocType: string | null
  dateDateOfFirstOperation: string | null
  dateDocUrl: string | null; dateDocType: string | null
  photosGen: Array<{ url: string; caption: string }> | null
  photosMeter: Array<{ url: string; caption: string }> | null
  genLlmDocTypeMatch: boolean | null; genLlmContentMatch: boolean | null; genLlmReason: string | null
  capLlmDocTypeMatch: boolean | null; capLlmContentMatch: boolean | null; capLlmReason: string | null
  locLlmDocTypeMatch: boolean | null; locLlmContentMatch: boolean | null; locLlmReason: string | null
  dateLlmDocTypeMatch: boolean | null; dateLlmContentMatch: boolean | null; dateLlmReason: string | null
  photosGenLlmMatch: boolean | null; photosGenLlmReason: string | null
  photosMeterLlmMatch: boolean | null; photosMeterLlmReason: string | null
}

const route = useRoute()

onMounted(async () => {
  const rawId = route.query.id
  if (!rawId || typeof rawId !== 'string') return

  let sub: SavedSubmission
  try {
    const res = await $fetch<{ submission: SavedSubmission }>(`/api/onboarding/${rawId}`)
    sub = res.submission
  } catch {
    return
  }

  if (sub.status !== 'draft') {
    submitError.value = `This submission is currently ${sub.status} and cannot be edited.`
    return
  }

  draftId.value = sub.uuid

  // Form fields
  form.projectName              = sub.projectName ?? ''
  form.projectType              = sub.projectType ?? ''
  form.expectedAnnualGeneration = sub.expectedAnnualGeneration ? parseFloat(sub.expectedAnnualGeneration) : null
  form.genGenerationType        = sub.genGenerationType ?? ''
  form.genDocUrl                = sub.genDocUrl ?? ''
  form.genDocType               = sub.genDocType ?? ''
  form.genSecondarySrc          = sub.genSecondarySrc ?? ''
  form.genSecondaryDesc         = sub.genSecondaryDesc ?? ''
  form.genTertiarySrc           = sub.genTertiarySrc ?? ''
  form.genTertiaryDesc          = sub.genTertiaryDesc ?? ''
  form.capCapacity              = sub.capCapacity ? parseFloat(sub.capCapacity) : null
  form.capDocUrl                = sub.capDocUrl ?? ''
  form.capDocType               = sub.capDocType ?? ''
  form.locPhysicalAddress       = sub.locPhysicalAddress ?? ''
  form.locLatStr                = sub.locLat != null ? String(sub.locLat) : ''
  form.locLonStr                = sub.locLon != null ? String(sub.locLon) : ''
  form.locDocUrl                = sub.locDocUrl ?? ''
  form.locDocType               = sub.locDocType ?? ''
  form.dateDateOfFirstOperation = sub.dateDateOfFirstOperation ?? ''
  form.dateDocUrl               = sub.dateDocUrl ?? ''
  form.dateDocType              = sub.dateDocType ?? ''
  form.photosGen                = sub.photosGen ?? []
  form.photosMeter              = sub.photosMeter ?? []

  // Reveal secondary/tertiary source sections if data exists
  if (sub.genSecondarySrc) showSecondary.value = true
  if (sub.genTertiarySrc)  showTertiary.value  = true

  // Restore LLM results so the user sees previous verification outcomes
  function restoreDocResult(
    section: Section,
    docTypeMatch: boolean | null,
    contentMatch: boolean | null,
    reason: string | null,
  ) {
    if (docTypeMatch === null && contentMatch === null) return
    llmResults[section] = {
      documentTypeMatches: docTypeMatch,
      contentMatches:      contentMatch ?? false,
      reasonForFalse:      reason,
    }
    llmStatus[section] = 'done'
  }

  restoreDocResult('gen',  sub.genLlmDocTypeMatch,  sub.genLlmContentMatch,  sub.genLlmReason)
  restoreDocResult('cap',  sub.capLlmDocTypeMatch,  sub.capLlmContentMatch,  sub.capLlmReason)
  restoreDocResult('loc',  sub.locLlmDocTypeMatch,  sub.locLlmContentMatch,  sub.locLlmReason)
  restoreDocResult('date', sub.dateLlmDocTypeMatch, sub.dateLlmContentMatch, sub.dateLlmReason)

  if (sub.photosGenLlmMatch !== null) {
    llmResults.photosGen = { documentTypeMatches: null, contentMatches: sub.photosGenLlmMatch ?? false, reasonForFalse: sub.photosGenLlmReason ?? null }
    llmStatus.photosGen = 'done'
  }
  if (sub.photosMeterLlmMatch !== null) {
    llmResults.photosMeter = { documentTypeMatches: null, contentMatches: sub.photosMeterLlmMatch ?? false, reasonForFalse: sub.photosMeterLlmReason ?? null }
    llmStatus.photosMeter = 'done'
  }
})

const steps = [
  { label: 'Project info' },
  { label: 'Generation type' },
  { label: 'Capacity' },
  { label: 'Location' },
  { label: 'First operation' },
  { label: 'Equipment photos' },
  { label: 'Metering photos' },
  { label: 'Review & Submit' },
]

// Returns true if the step's required fields are filled
const stepComplete = computed(() => [
  !!(form.projectName?.trim() && form.projectType && form.expectedAnnualGeneration),
  !!(form.genGenerationType && form.genDocUrl && form.genDocType),
  !!(form.capCapacity && form.capDocUrl && form.capDocType),
  !!(form.locLatStr && form.locLonStr && form.locDocUrl && form.locDocType),
  !!(form.dateDateOfFirstOperation && form.dateDocUrl && form.dateDocType),
  form.photosGen.length > 0,
  form.photosMeter.length > 0,
  true, // review step
])

const currentStep = ref(0)
const saving      = ref(false)
const submitted   = ref(false)
const draftId     = ref<string | null>(null)

// UI toggles for secondary/tertiary sources
const showSecondary = ref(false)
const showTertiary  = ref(false)

// Lat/lon are kept as strings until submitted so we can validate precision
const latError    = ref('')
const lonError    = ref('')
const submitError = ref('')

// ── LLM document verification ─────────────────────────────────────────────────

interface LlmResult {
  documentTypeMatches: boolean | null
  contentMatches: boolean
  reasonForFalse: string | null
}

type Section = 'gen' | 'cap' | 'loc' | 'date' | 'photosGen' | 'photosMeter'
type LlmStatus = 'idle' | 'running' | 'done' | 'error' | 'unavailable'

const llmStatus = reactive<Record<Section, LlmStatus>>({
  gen: 'idle', cap: 'idle', loc: 'idle', date: 'idle', photosGen: 'idle', photosMeter: 'idle',
})
const llmResults = reactive<Partial<Record<Section, LlmResult>>>({})
const llmDirty   = reactive<Record<Section, boolean>>({
  gen: false, cap: false, loc: false, date: false, photosGen: false, photosMeter: false,
})
const llmOverrideAcknowledged = ref(false)

// Form state — mirrors new flat schema columns
const form = reactive({
  // Step 1 — Project info
  projectName:              '',
  projectType:              '',
  expectedAnnualGeneration: null as number | null,

  // Step 2 — Generation type
  genGenerationType: '',
  genDocUrl:         '',
  genDocType:        '',
  genSecondarySrc:   '',
  genSecondaryDesc:  '',
  genTertiarySrc:    '',
  genTertiaryDesc:   '',

  // Step 3 — Capacity
  capCapacity: null as number | null,
  capDocUrl:   '',
  capDocType:  '',

  // Step 4 — Location
  locPhysicalAddress: '',
  locLatStr:          '',   // string for precision validation
  locLonStr:          '',
  locDocUrl:          '',
  locDocType:         '',

  // Step 5 — Date of first operation
  dateDateOfFirstOperation: '',
  dateDocUrl:               '',
  dateDocType:              '',

  // Steps 6 & 7 — Photos
  photosGen:   [] as Array<{ url: string; caption: string }>,
  photosMeter: [] as Array<{ url: string; caption: string }>,
})

function removeSecondary() {
  showSecondary.value    = false
  showTertiary.value     = false
  form.genSecondarySrc   = ''
  form.genSecondaryDesc  = ''
  form.genTertiarySrc    = ''
  form.genTertiaryDesc   = ''
}

function removeTertiary() {
  showTertiary.value   = false
  form.genTertiarySrc  = ''
  form.genTertiaryDesc = ''
}

function hasTwoDecimals(str: string): boolean {
  const dot = str.indexOf('.')
  return dot !== -1 && str.length - dot - 1 >= 2
}

function validateLatLon() {
  latError.value = ''
  lonError.value = ''
  if (form.locLatStr && !hasTwoDecimals(form.locLatStr)) {
    latError.value = 'At least 2 decimal places required'
  }
  if (form.locLonStr && !hasTwoDecimals(form.locLonStr)) {
    lonError.value = 'At least 2 decimal places required'
  }
}

async function analyzeSection(section: Section) {
  let urls: string[] = []
  let body: Record<string, unknown> = { section, submissionId: draftId.value ?? undefined }

  switch (section) {
    case 'gen':
      if (!form.genDocUrl) return
      urls = [form.genDocUrl]
      body = { ...body, urls, docType: form.genDocType, genGenerationType: form.genGenerationType }
      break
    case 'cap':
      if (!form.capDocUrl) return
      urls = [form.capDocUrl]
      body = { ...body, urls, docType: form.capDocType, capCapacity: form.capCapacity }
      break
    case 'loc':
      if (!form.locDocUrl) return
      urls = [form.locDocUrl]
      body = {
        ...body, urls, docType: form.locDocType,
        locAddress: form.locPhysicalAddress || undefined,
        locLat: form.locLatStr ? parseFloat(form.locLatStr) : undefined,
        locLon: form.locLonStr ? parseFloat(form.locLonStr) : undefined,
      }
      break
    case 'date':
      if (!form.dateDocUrl) return
      urls = [form.dateDocUrl]
      body = { ...body, urls, docType: form.dateDocType, date: form.dateDateOfFirstOperation }
      break
    case 'photosGen':
      if (!form.photosGen.length) return
      urls = form.photosGen.map(p => p.url)
      body = { ...body, urls }
      break
    case 'photosMeter':
      if (!form.photosMeter.length) return
      urls = form.photosMeter.map(p => p.url)
      body = { ...body, urls }
      break
  }

  llmDirty[section]  = false
  llmStatus[section] = 'running'
  try {
    const result = await $fetch<LlmResult>('/api/onboarding/analyze', { method: 'POST', body })
    llmResults[section] = result
    llmStatus[section] = 'done'
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode
      ?? (err as { status?: number })?.status
    llmStatus[section] = (statusCode === 503 || statusCode === 429) ? 'unavailable' : 'error'
  }
}

// Map step index to the section whose document is collected on that step.
const STEP_SECTION: Partial<Record<number, Section>> = {
  1: 'gen', 2: 'cap', 3: 'loc', 4: 'date', 5: 'photosGen', 6: 'photosMeter',
}

function goNext() {
  const section = STEP_SECTION[currentStep.value]
  if (section && llmStatus[section] === 'idle') analyzeSection(section)
  currentStep.value++
}

// Auto-analyze doc steps when a URL is first set (idle only — avoids re-firing on draft load or navigation).
watch(() => form.genDocUrl,  (url) => { if (url && llmStatus.gen  === 'idle') analyzeSection('gen') })
watch(() => form.capDocUrl,  (url) => { if (url && llmStatus.cap  === 'idle') analyzeSection('cap') })
watch(() => form.locDocUrl,  (url) => { if (url && llmStatus.loc  === 'idle') analyzeSection('loc') })
watch(() => form.dateDocUrl, (url) => { if (url && llmStatus.date === 'idle') analyzeSection('date') })

// Re-analyze photo steps with a short debounce (photos are added incrementally).
let photosGenTimer: ReturnType<typeof setTimeout> | null = null
let photosMeterTimer: ReturnType<typeof setTimeout> | null = null

watch(() => form.photosGen, () => {
  if (!form.photosGen.length || llmStatus.photosGen !== 'idle') return
  if (photosGenTimer) clearTimeout(photosGenTimer)
  photosGenTimer = setTimeout(() => analyzeSection('photosGen'), 500)
}, { deep: true })

watch(() => form.photosMeter, () => {
  if (!form.photosMeter.length || llmStatus.photosMeter !== 'idle') return
  if (photosMeterTimer) clearTimeout(photosMeterTimer)
  photosMeterTimer = setTimeout(() => analyzeSection('photosMeter'), 500)
}, { deep: true })

// Mark a section dirty when its inputs change after analysis has run.
// Excludes 'running' so a URL change that auto-triggers analysis doesn't mark dirty.
const sectionInputs: Record<Section, () => unknown> = {
  gen:         () => [form.genDocUrl, form.genDocType, form.genGenerationType],
  cap:         () => [form.capDocUrl, form.capDocType, form.capCapacity],
  loc:         () => [form.locDocUrl, form.locDocType, form.locPhysicalAddress, form.locLatStr, form.locLonStr],
  date:        () => [form.dateDocUrl, form.dateDocType, form.dateDateOfFirstOperation],
  photosGen:   () => form.photosGen.map(p => p.url).join(','),
  photosMeter: () => form.photosMeter.map(p => p.url).join(','),
}

for (const [sec, getter] of Object.entries(sectionInputs) as [Section, () => unknown][]) {
  watch(getter, () => {
    if (llmStatus[sec] !== 'idle' && llmStatus[sec] !== 'running') {
      llmDirty[sec] = true
    }
  })
}

const SECTION_LABELS: Record<Section, string> = {
  gen:         'Generation type document',
  cap:         'Capacity document',
  loc:         'Location document',
  date:        'First operation document',
  photosGen:   'Equipment photos',
  photosMeter: 'Metering photos',
}

const llmWarningItems = computed(() =>
  (Object.keys(llmResults) as Section[]).filter((section) => {
    const r = llmResults[section]
    return r && (r.documentTypeMatches === false || r.contentMatches === false)
  }).map((section) => ({
    section,
    label:  SECTION_LABELS[section],
    reason: llmResults[section]!.reasonForFalse ?? 'Does not match submission',
  })),
)

const hasLlmWarnings = computed(() => llmWarningItems.value.length > 0)

/** Returns the list of already-uploaded docs from all earlier doc steps. */
function previousDocs(forStep: number): Array<{ label: string; docUrl: string; docType: string }> {
  const docs: Array<{ label: string; docUrl: string; docType: string }> = []
  if (forStep > 1 && form.genDocUrl && form.genDocType) {
    docs.push({ label: form.genDocType, docUrl: form.genDocUrl, docType: form.genDocType })
  }
  if (forStep > 2 && form.capDocUrl && form.capDocType) {
    docs.push({ label: form.capDocType, docUrl: form.capDocUrl, docType: form.capDocType })
  }
  if (forStep > 3 && form.locDocUrl && form.locDocType) {
    docs.push({ label: form.locDocType, docUrl: form.locDocUrl, docType: form.locDocType })
  }
  return docs
}

/** Build the API payload from form state. */
function buildPayload(status: 'draft' | 'pending') {
  return {
    status,
    projectName:              form.projectName || undefined,
    projectType:              form.projectType || undefined,
    expectedAnnualGeneration: form.expectedAnnualGeneration ?? undefined,
    genGenerationType:        form.genGenerationType || undefined,
    genDocUrl:                form.genDocUrl || undefined,
    genDocType:               form.genDocType || undefined,
    genSecondarySrc:          form.genSecondarySrc || undefined,
    genSecondaryDesc:         form.genSecondaryDesc || undefined,
    genTertiarySrc:           form.genTertiarySrc || undefined,
    genTertiaryDesc:          form.genTertiaryDesc || undefined,
    capCapacity:              form.capCapacity ?? undefined,
    capDocUrl:                form.capDocUrl || undefined,
    capDocType:               form.capDocType || undefined,
    locPhysicalAddress:       form.locPhysicalAddress || undefined,
    locLat:                   form.locLatStr ? parseFloat(form.locLatStr) : undefined,
    locLon:                   form.locLonStr ? parseFloat(form.locLonStr) : undefined,
    locDocUrl:                form.locDocUrl || undefined,
    locDocType:               form.locDocType || undefined,
    dateDateOfFirstOperation: form.dateDateOfFirstOperation || undefined,
    dateDocUrl:               form.dateDocUrl || undefined,
    dateDocType:              form.dateDocType || undefined,
    photosGen:                form.photosGen.length  ? form.photosGen  : undefined,
    photosMeter:              form.photosMeter.length ? form.photosMeter : undefined,
    // LLM results are written server-side by /api/onboarding/analyze — not included here
  }
}

async function saveDraft() {
  saving.value = true
  try {
    const payload = buildPayload('draft')
    if (draftId.value) {
      await $fetch(`/api/onboarding/${draftId.value}`, { method: 'PATCH', body: payload })
    } else {
      const resp = await $fetch('/api/onboarding', { method: 'POST', body: payload })
      draftId.value = (resp as { submission: { uuid: string } }).submission.uuid
    }
  } finally {
    saving.value = false
  }
}

function validateSubmit(): string {
  if (!form.projectName?.trim())       return 'Project name is required (step 1)'
  if (!form.projectType)               return 'Project type is required (step 1)'
  if (!form.genGenerationType)         return 'Primary energy source is required (step 2)'
  if (!form.capCapacity)               return 'Installed capacity is required (step 3)'
  if (!form.locLatStr || !form.locLonStr) return 'Latitude and longitude are required (step 4)'
  validateLatLon()
  if (latError.value || lonError.value) return 'Coordinates require at least 2 decimal places (step 4)'
  if (!form.dateDateOfFirstOperation)  return 'Date of first operation is required (step 5)'
  if (form.photosGen.length === 0)     return 'At least one equipment photo is required (step 6)'
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
      await $fetch(`/api/onboarding/${draftId.value}`, { method: 'PATCH', body: payload })
    } else {
      await $fetch('/api/onboarding', { method: 'POST', body: payload })
    }
    submitted.value = true
  } finally {
    saving.value = false
  }
}
</script>

