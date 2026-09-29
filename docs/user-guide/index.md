---
title: User guide
---

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  if (typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/user-guide') {
    window.location.replace('/')
  }
})
</script>

[Electros user guide](/) — chapters and creation walkthroughs.
