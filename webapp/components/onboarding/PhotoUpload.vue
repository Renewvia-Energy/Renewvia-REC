<template>
  <div class="space-y-3">
    <!-- Drop zone — hidden once a photo is uploaded -->
    <div
      v-if="!uploaded"
      class="relative flex flex-col items-center justify-center rounded border-2 border-dashed border-border bg-surface p-6 text-center transition-colors"
      :class="dragging ? 'border-brand bg-brand/5' : ''"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="absolute inset-0 opacity-0 cursor-pointer"
        @change="onFileChange"
      />
      <p class="text-sm text-text-muted">Drag & drop a photo or <span class="text-brand cursor-pointer hover:underline">browse</span></p>
      <p class="text-2xs text-text-muted mt-1">JPG, PNG, WEBP — max 10 MB</p>
    </div>

    <!-- Single item row -->
    <div v-if="item" class="flex items-center gap-3 rounded border border-border bg-surface px-3 py-2">
      <img
        v-if="item.previewUrl"
        :src="item.previewUrl"
        class="h-10 w-10 shrink-0 rounded object-cover"
        alt=""
      />
      <div class="flex-1 min-w-0">
        <p class="text-sm truncate text-text-primary">{{ item.file.name }}</p>
        <p v-if="item.status === 'uploading'" class="text-2xs text-brand animate-pulse">Uploading…</p>
        <p v-else-if="item.status === 'done'"  class="text-2xs text-success">Uploaded</p>
        <p v-else-if="item.status === 'error'" class="text-2xs text-danger">{{ item.error }}</p>
      </div>
      <input
        v-if="item.status === 'done'"
        v-model="item.caption"
        type="text"
        class="rex-input w-36 shrink-0 text-2xs"
        placeholder="Caption (optional)"
        @input="emitValue"
      />
      <button type="button" class="px-2 py-1 text-xs text-danger hover:underline shrink-0 rounded" @click="removeItem">
        Remove
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface PhotoEntry {
  url:     string
  caption: string
}

const props = defineProps<{
  folder:     string
  modelValue: PhotoEntry[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PhotoEntry[]]
}>()

interface QueueItem {
  file:       File
  previewUrl: string
  status:     'uploading' | 'done' | 'error'
  publicUrl:  string
  caption:    string
  error:      string
}

const dragging = ref(false)
const item      = ref<QueueItem | null>(null)

const uploaded = computed(() => item.value?.status === 'done' || item.value?.status === 'uploading')

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) addFile(input.files[0])
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const file = Array.from(e.dataTransfer?.files ?? []).find(f => f.type.startsWith('image/'))
  if (file) addFile(file)
}

function addFile(file: File) {
  if (file.size > 10 * 1024 * 1024) return

  // Revoke previous object URL to avoid memory leaks
  if (item.value?.previewUrl) URL.revokeObjectURL(item.value.previewUrl)

  item.value = {
    file,
    previewUrl: URL.createObjectURL(file),
    status:    'uploading',
    publicUrl: '',
    caption:   '',
    error:     '',
  }

  uploadItem(item.value)
}

function removeItem() {
  if (item.value?.previewUrl) URL.revokeObjectURL(item.value.previewUrl)
  item.value = null
  emitValue()
}

async function uploadItem(entry: QueueItem) {
  try {
    const { uploadUrl, publicUrl } = await $fetch<{ uploadUrl: string; publicUrl: string }>('/api/uploads/presign', {
      method: 'POST',
      body: {
        folder:      props.folder,
        filename:    entry.file.name,
        contentType: entry.file.type,
      },
    })
    await fetch(uploadUrl, {
      method:  'PUT',
      headers: { 'Content-Type': entry.file.type },
      body:    entry.file,
    })
    entry.publicUrl = publicUrl
    entry.status    = 'done'
  } catch (e: unknown) {
    entry.error  = (e as { statusMessage?: string })?.statusMessage ?? 'Upload failed'
    entry.status = 'error'
  }
  emitValue()
}

function emitValue() {
  emit('update:modelValue',
    item.value?.status === 'done'
      ? [{ url: item.value.publicUrl, caption: item.value.caption }]
      : [],
  )
}
</script>
