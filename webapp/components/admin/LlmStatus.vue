<template>
  <!-- Nothing to show if no result was recorded -->
  <template v-if="contentMatch !== null">
    <p v-if="passing" class="text-2xs text-success mt-1">AI verified ✓</p>
    <div v-else class="mt-1 rounded border border-warning-subtle bg-warning-subtle px-2 py-1.5 space-y-0.5">
      <p class="text-2xs font-medium text-warning-text">
        AI flagged: {{ flagLabel }}
      </p>
      <p v-if="reason" class="text-2xs text-warning-text opacity-80 italic">{{ reason }}</p>
    </div>
  </template>
</template>

<script setup lang="ts">
const props = defineProps<{
  docTypeMatch: boolean | null
  contentMatch: boolean | null
  reason:       string | null
}>()

const passing = computed(
  () => props.contentMatch === true && props.docTypeMatch !== false,
)

const flagLabel = computed(() => {
  if (props.docTypeMatch === false && props.contentMatch === false) return 'document type and content'
  if (props.docTypeMatch === false) return 'document type'
  return 'content'
})
</script>
