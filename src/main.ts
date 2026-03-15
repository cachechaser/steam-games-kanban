import './assets/global.scss'

import { createApp } from 'vue'
import type { DirectiveBinding } from 'vue'
import App from './App.vue'

/* FontAwesome */
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
	faSatelliteDish, faSpinner, faMobileScreenButton, faLink, faHandshake,
	faBox, faCircleCheck, faXmark, faUpload, faDownload, faCheck,
	faRotate, faTriangleExclamation, faDesktop, faChampagneGlasses,
	faClipboardList, faTrophy, faChartBar, faMagnifyingGlass, faShieldHalved,
	faFaceSmileWink, faFire, faMountain, faSkull, faSortDown, faSortUp,
	faLock, faClock, faChevronDown, faChevronRight, faChevronUp, faPen,
	faTableColumns, faFilter, faGripVertical, faCopy, faTrashCan
} from '@fortawesome/free-solid-svg-icons'
import VClickOutside from 'v-click-outside/src/v-click-outside.js'

library.add(
	faSatelliteDish, faSpinner, faMobileScreenButton, faLink, faHandshake,
	faBox, faCircleCheck, faXmark, faUpload, faDownload, faCheck,
	faRotate, faTriangleExclamation, faDesktop, faChampagneGlasses,
	faClipboardList, faTrophy, faChartBar, faMagnifyingGlass, faShieldHalved,
	faFaceSmileWink, faFire, faMountain, faSkull, faSortDown, faSortUp,
	faLock, faClock, faChevronDown, faChevronRight, faChevronUp, faPen,
	faTableColumns, faFilter, faGripVertical, faCopy, faTrashCan
)

const app = createApp(App)
app.directive(
	'click-outside', {
		mounted: (el: HTMLElement, binding: DirectiveBinding, vnode) => VClickOutside.bind(el, binding, vnode),
		unmounted: (el: HTMLElement) => VClickOutside.unbind(el),
		updated: (el: HTMLElement, binding: DirectiveBinding, vnode) => VClickOutside.updated(el, binding, vnode)
    }
)

app.component('font-awesome-icon', FontAwesomeIcon)
app.mount('#app')

