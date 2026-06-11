<script setup lang="ts">
// Root redirect — auth middleware handles /login redirect if unauthenticated
navigateTo('/dashboard', { replace: true })
</script>
