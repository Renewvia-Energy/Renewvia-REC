<template>
  <div v-if="status !== 'idle'" class="mt-2">

    <!-- Running -->
    <div v-if="status === 'running'" class="flex items-center gap-1.5">
      <span class="inline-block w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" aria-hidden="true" />
      <p class="text-xs text-text-muted">Verifying document…</p>
    </div>

    <!-- Temporarily unavailable (server-side capacity error) -->
    <div v-else-if="status === 'unavailable'" class="flex items-center gap-2">
      <p class="text-xs text-text-muted">Verification service temporarily unavailable</p>
      <button type="button" class="text-xs text-brand hover:underline" @click="emit('retry')">Retry</button>
    </div>

    <!-- Generic error -->
    <div v-else-if="status === 'error'" class="flex items-center gap-2">
      <p class="text-xs text-text-muted">Verification unavailable</p>
      <button type="button" class="text-xs text-brand hover:underline" @click="emit('retry')">Retry</button>
    </div>

    <!-- Done -->
    <template v-else-if="status === 'done'">
      <p v-if="passing" class="text-xs text-success">Document verified ✓</p>
      <div v-else class="rounded border border-warning-subtle bg-warning-subtle px-3 py-2 space-y-1">
        <p class="text-xs font-medium text-warning-text">Document may not match your submission</p>
        <p v-if="result?.reasonForFalse" class="text-xs text-warning-text opacity-80">{{ result.reasonForFalse }}</p>
        <button v-if="retryable" type="button" class="text-xs text-brand hover:underline" @click="emit('retry')">Retry verification</button>
        <p v-else class="text-xs text-text-muted italic">Update your document or inputs to retry. If you believe the AI verifier made an error, click "Continue" and submit for admin approval.</p>
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
  status:     'idle' | 'running' | 'done' | 'error' | 'unavailable'
  result?:    LlmResult
  retryable?: boolean
}>()

const emit = defineEmits<{ retry: [] }>()

const passing = computed(() =>
  props.result?.documentTypeMatches !== false && props.result?.contentMatches !== false,
)
</script>
