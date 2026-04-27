<template>
  <div class="space-y-3">

    <!-- Reuse a previously uploaded document -->
    <div v-if="uniquePreviousDocs.length">
      <label class="block text-xs font-medium text-text-secondary mb-1">Reuse a previously uploaded document</label>
      <select class="rex-select w-full" :value="selectedPrevKey" @change="onPrevSelect">
        <option value="">— Upload a new document —</option>
        <option v-for="d in uniquePreviousDocs" :key="d.docUrl" :value="d.docUrl">{{ d.label }}</option>
      </select>
    </div>

    <!-- Document type dropdown (hidden when reusing a previous doc) -->
    <div v-if="!selectedPrevKey">
      <label class="block text-xs font-medium text-text-secondary mb-1">Document type</label>
      <select :value="documentType" class="rex-select w-full" @change="onTypeChange">
        <option value="">— Select type —</option>
        <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
      </select>
    </div>

    <!-- File picker (hidden when reusing a previous doc) -->
    <template v-if="!selectedPrevKey">
      <div
        class="relative flex flex-col items-center justify-center rounded border-2 border-dashed border-border bg-surface p-6 text-center transition-colors"
        :class="dragging ? 'border-brand bg-brand/5' : ''"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <input
          ref="fileInput"
          type="file"
          :accept="accept"
          class="absolute inset-0 opacity-0 cursor-pointer"
          aria-label="Upload document (PDF, JPG, PNG, WEBP — max 20 MB)"
          @change="onFileChange"
        />
        <template v-if="!file">
          <p class="text-sm text-text-muted">Drag & drop or <span class="text-brand hover:underline cursor-pointer">browse</span></p>
          <p class="text-2xs text-text-muted mt-1">PDF, JPG, PNG, WEBP — max 20 MB</p>
        </template>
        <template v-else>
          <p class="text-sm font-medium text-text-primary truncate max-w-full px-4">{{ file.name }}</p>
          <p class="text-2xs text-text-muted mt-1">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</p>
          <button type="button" class="mt-2 px-2 py-1 text-xs text-danger hover:underline rounded" @click.stop="clearFile">Remove</button>
        </template>
      </div>

      <!-- Upload progress / result -->
      <div role="status" aria-live="polite" aria-atomic="true">
        <div v-if="uploading" class="flex items-center gap-2 text-sm text-text-secondary">
          <span class="inline-block w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          Uploading…
        </div>
        <div v-else-if="uploadedUrl" class="flex items-center gap-2 text-sm text-success">
          ✓ Uploaded —
          <a :href="viewUrl(uploadedUrl)" target="_blank" class="text-brand hover:underline truncate max-w-xs">View file ↗</a>
        </div>
      </div>
      <div v-if="uploadError" role="alert" aria-live="assertive" class="text-sm text-danger">{{ uploadError }}</div>

    </template>

    <!-- Reusing indicator -->
    <template v-else>
      <div class="flex items-center gap-2 text-sm text-success">
        ✓ Reusing previously uploaded document —
        <a :href="viewUrl(documentUrl)" target="_blank" class="text-brand hover:underline truncate max-w-xs">View file ↗</a>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  folder:               string
  documentType:         string
  documentUrl:          string
  allowOwnerDeclaration?: boolean
  previousDocs?:        Array<{ label: string; docUrl: string; docType: string }>
}>()

const emit = defineEmits<{
  'update:documentType': [value: string]
  'update:documentUrl':  [value: string]
}>()

const BASE_DOCUMENT_TYPES = [
  'Project commissioning report approved by the local government',
  'Countersigned off-taker agreement',
  'Land lease agreements',
  'Official license to operate',
  'Equipment purchase and installation contracts',
  'Grid connection agreements',
  'Insurance documentation',
  'Environmental impact assessments',
  'Technical inspection certificates from certified, third-party bodies',
  'Project handover/completion certificates from third-party installation contractors',
]

const availableTypes = computed(() =>
  props.allowOwnerDeclaration
    ? [...BASE_DOCUMENT_TYPES, 'Owner Declaration']
    : BASE_DOCUMENT_TYPES,
)

const uniquePreviousDocs = computed(() => {
  const seen = new Set<string>()
  return (props.previousDocs ?? []).filter(d => {
    if (seen.has(d.docUrl)) return false
    seen.add(d.docUrl)
    return true
  })
})

const accept = 'image/jpeg,image/png,image/webp,application/pdf'

function viewUrl(url: string) {
  return `/api/uploads/view?url=${encodeURIComponent(url)}`
}

const fileInput      = ref<HTMLInputElement | null>(null)
const dragging       = ref(false)
const file           = ref<File | null>(null)
const uploadedUrl    = ref(props.documentUrl ?? '')
const uploading      = ref(false)
const uploadError    = ref('')
const selectedPrevKey = ref(
  // If the current documentUrl matches a previous doc, pre-select it
  props.previousDocs?.find(d => d.docUrl === props.documentUrl)?.docUrl ?? '',
)

function onTypeChange(e: Event) {
  emit('update:documentType', (e.target as HTMLSelectElement).value)
}

function onPrevSelect(e: Event) {
  const url = (e.target as HTMLSelectElement).value
  selectedPrevKey.value = url
  if (url) {
    const doc = props.previousDocs?.find(d => d.docUrl === url)
    if (doc) {
      emit('update:documentType', doc.docType)
      emit('update:documentUrl',  doc.docUrl)
      uploadedUrl.value = doc.docUrl
    }
  } else {
    // Switched back to "upload new" — clear the URL so user must re-upload
    uploadedUrl.value = ''
    emit('update:documentUrl', '')
    emit('update:documentType', '')
    clearFile()
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) setFile(input.files[0])
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const dropped = e.dataTransfer?.files?.[0]
  if (dropped) setFile(dropped)
}

function setFile(f: File) {
  if (f.size > 20 * 1024 * 1024) {
    uploadError.value = 'File exceeds 20 MB limit'
    return
  }
  file.value        = f
  uploadError.value = ''
  uploadedUrl.value = ''
  upload()
}

function clearFile() {
  file.value        = null
  uploadedUrl.value = ''
  uploadError.value = ''
  emit('update:documentUrl', '')
  if (fileInput.value) fileInput.value.value = ''
}

async function upload() {
  if (!file.value) return
  uploading.value   = true
  uploadError.value = ''
  try {
    const { uploadUrl, publicUrl } = await $fetch<{ uploadUrl: string; publicUrl: string }>('/api/uploads/presign', {
      method: 'POST',
      body: {
        folder:      props.folder,
        filename:    file.value.name,
        contentType: file.value.type || 'application/octet-stream',
      },
    })
    await fetch(uploadUrl, {
      method:  'PUT',
      headers: { 'Content-Type': file.value.type },
      body:    file.value,
    })
    uploadedUrl.value = publicUrl
    emit('update:documentUrl', publicUrl)
  } catch (e: unknown) {
    uploadError.value = (e as { statusMessage?: string })?.statusMessage ?? 'Upload failed'
  } finally {
    uploading.value = false
  }
}
</script>

