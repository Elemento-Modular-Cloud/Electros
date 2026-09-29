---
title: Guide utilisateur
---

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  if (typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/fr/user-guide') {
    window.location.replace('/fr/')
  }
})
</script>

[Guide utilisateur Electros](/fr/) — chapitres et parcours de création.
