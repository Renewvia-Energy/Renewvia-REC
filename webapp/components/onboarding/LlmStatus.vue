<template>
  <div v-if="status !== 'idle'" class="mt-2">
    <p v-if="status === 'running'" class="text-xs text-text-muted">Verifying document…</p>
    <div v-else-if="status === 'error'" class="flex items-center gap-2">
      <p class="text-xs text-text-muted">Verification unavailable</p>
      <button type="button" class="text-xs text-brand hover:underline" @click="emit('retry')">Retry</button>
    </div>
    <template v-else-if="status === 'done'">
      <p v-if="passing" class="text-xs text-success">Document verified ✓</p>
      <div v-else class="rounded border border-amber-300 bg-amber-50 px-3 py-2 space-y-1">
        <p class="text-xs font-medium text-amber-900">Document may not match your submission</p>
        <p v-if="result?.reasonForFalse" class="text-xs text-amber-800">{{ result.reasonForFalse }}</p>
        <button v-if="retryable" type="button" class="text-xs text-brand hover:underline" @click="emit('retry')">Retry verification</button>
        <p v-else class="text-xs text-text-muted italic">Update your document or inputs to retry</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
interface LlmResult {
  documentTypeMatches: boolean | null
  contentMatches: boolean
  reasonForFalse: string | null
}

const props = defineProps<{
  status:    'idle' | 'running' | 'done' | 'error'
  result?:   LlmResult
  retryable?: boolean   // true once the user has changed an input since the last analysis
}>()

const emit = defineEmits<{ retry: [] }>()

const passing = computed(() =>
  props.result?.documentTypeMatches !== false && props.result?.contentMatches !== false,
)
</script>
