<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// Apply dark mode class based on system preference
// The CSS uses class-based dark mode toggling

useHead({
  titleTemplate: title => title ? `${title} — REX` : 'Renewvia Environmental Exchange',
  htmlAttrs: { lang: 'en' },
  meta: [
    { name: 'description', content: 'Renewvia Environmental Exchange — verified renewable energy certificates on the Polygon blockchain' },
  ],
})

// System color scheme detection
onMounted(() => {
  const html = document.documentElement
  const mq = window.matchMedia('(prefers-color-scheme: dark)')

  function apply(dark: boolean) {
    dark ? html.classList.add('dark') : html.classList.remove('dark')
  }

  apply(mq.matches)
  mq.addEventListener('change', e => apply(e.matches))
})
</script>
