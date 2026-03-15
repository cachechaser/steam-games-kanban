/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module 'v-click-outside/src/v-click-outside.js' {
  const directive: {
    bind: (el: HTMLElement, binding: unknown, vnode: unknown) => void
    unbind: (el: HTMLElement) => void
    updated: (el: HTMLElement, binding: unknown, vnode: unknown) => void
  }

  export default directive
}

