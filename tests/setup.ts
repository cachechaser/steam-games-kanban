import { config } from '@vue/test-utils'

config.global.stubs = {
  'font-awesome-icon': {
    template: '<i data-test="fa" />'
  },
  Teleport: true,
  Transition: {
    template: '<div><slot /></div>'
  },
  'transition-group': {
    template: '<div><slot /></div>'
  }
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })
})

