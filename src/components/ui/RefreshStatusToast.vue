<script setup lang="ts">
import type { RefreshStatus } from '@/types/domain'

defineProps<{
  status: RefreshStatus
}>()
</script>

<template>
  <transition name="refresh-toast-fade">
    <div v-if="status.visible" class="refresh-toast" role="status" aria-live="polite" aria-atomic="true">
      <div class="refresh-toast__label">{{ status.label }}</div>
      <div class="refresh-toast__track" aria-hidden="true">
        <div class="refresh-toast__fill" :style="{ width: `${status.progress}%` }"></div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.refresh-toast {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1200;
  min-width: min(480px, calc(100vw - 24px));
  max-width: min(600px, calc(100vw - 24px));
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(102, 192, 244, 0.3);
  background: rgba(15, 18, 25, 0.95);
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.refresh-toast__label {
  color: var(--steam-text-light);
  font-size: 0.9rem;
  margin-bottom: 10px;
}

.refresh-toast__track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.refresh-toast__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--steam-blue-light), #2d73ff);
  transition: width 0.2s ease;
}

.refresh-toast-fade-enter-active,
.refresh-toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.refresh-toast-fade-enter-from,
.refresh-toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

@media (max-width: 640px) {
  .refresh-toast {
    top: 12px;
    padding: 10px 12px;
  }
}
</style>

