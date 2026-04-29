<template>
  <AdminLlmStatus :doc-type-match="docTypeMatch" :content-match="contentMatch" :reason="reason" />
</template>

<script setup lang="ts">
defineProps<{
  docTypeMatch: boolean | null
  contentMatch: boolean | null
  reason:       string | null
}>()
</script>
