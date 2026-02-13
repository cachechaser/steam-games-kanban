<script setup>
</script>

<template>
  <footer class="app-footer">
    <p>Powered by Steam. This site is not affiliated with Valve Corporation.</p>
  </footer>
</template>

<style scoped>
.app-footer {
  text-align: center;
  padding: 15px;
  background: var(--steam-bg-dark);
  color: #4f5b66;
  font-size: 0.8rem;
  border-top: 1px solid var(--steam-blue-dark);
  width: 100%;
  flex-shrink: 0; 
  position: sticky;
  bottom: 0;
  z-index: 99999;
}
</style>
