---
title: Guida utente
---

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  if (typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/it/user-guide') {
    window.location.replace('/it/')
  }
})
</script>

[Guida utente di Electros](/it/) — capitoli e walkthrough di creazione.
