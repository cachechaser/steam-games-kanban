<script setup>
import {ref} from 'vue'
import {useDataSync} from '../composables/useDataSync'
import {copyToClipboard} from '@/utils/clipboard.js'
import QRCodeVue3 from 'qrcode-vue3'
import BaseOverlay from './ui/BaseOverlay.vue'

const {
	status, roomId, errorMessage, progress, syncDirection, syncLink,
	Status, startHosting, joinRoom, regenerateRoom, closeOverlay, reset
} = useDataSync()

const manualCode = ref('')
const linkCopied = ref(false)

const emit = defineEmits(['close'])

const close = () => {
	emit('close')
	closeOverlay()
}

const handleStartHosting = () => {
	startHosting()
}

const handleJoinWithCode = () => {
	const code = manualCode.value.trim()
	if (!code) return
	let extracted = code

	try {
		const url = new URL(code)
		const syncParam = url.searchParams.get('sync')
		if (syncParam) extracted = syncParam
	} catch { 
		/* ignore */
	}

	joinRoom(extracted)
}

const copyLink = async () => {
	if (!syncLink.value) return
	const ok = await copyToClipboard(syncLink.value)
	if (ok) {
		linkCopied.value = true
		setTimeout(() => {
			linkCopied.value = false
		}, 2000)
	}
}

const handleRegenerate = () => {
	linkCopied.value = false
	regenerateRoom()
}

const reloadPage = () => {
	window.location.reload()
}

const statusLabel = {
	[Status.IDLE]: 'Ready',
	[Status.CREATING_ROOM]: 'Creating room…',
	[Status.WAITING_FOR_PEER]: 'Waiting for other device…',
	[Status.JOINING_ROOM]: 'Joining room…',
	[Status.CONNECTING]: 'Establishing connection…',
	[Status.TRANSFERRING]: 'Transferring data…',
	[Status.COMPLETE]: 'Sync complete!',
	[Status.ERROR]: 'Error',
}

const statusIcon = {
	[Status.IDLE]: 'satellite-dish',
	[Status.CREATING_ROOM]: 'spinner',
	[Status.WAITING_FOR_PEER]: 'mobile-screen-button',
	[Status.JOINING_ROOM]: 'link',
	[Status.CONNECTING]: 'handshake',
	[Status.TRANSFERRING]: 'box',
	[Status.COMPLETE]: 'circle-check',
	[Status.ERROR]: 'xmark',
}
</script>

<template>
	<BaseOverlay max-width="520px" :padded="false" @close="close">
		<template #header>
			<div class="sync-header">
				<h2>Device Sync</h2>
				<p class="sync-subtitle">Transfer your data to another device via peer-to-peer connection</p>
			</div>
		</template>

		<!-- Status Bar -->
		<div class="status-bar" :class="status">
			<span class="status-icon"><font-awesome-icon :icon="statusIcon[status]" :spin="status === Status.CREATING_ROOM" /></span>
			<span class="status-text">{{ statusLabel[status] }}</span>
		</div>

		<!-- Error Message -->
		<div v-if="status === Status.ERROR" class="error-block">
			<p>{{ errorMessage }}</p>
			<button class="btn btn-secondary" @click="reset()">Try Again</button>
		</div>

		<!-- IDLE: Choose action -->
		<div v-if="status === Status.IDLE" class="sync-actions">
			<div class="action-card" @click="handleStartHosting">
				<div class="action-icon"><font-awesome-icon icon="upload" /></div>
				<div class="action-info">
					<h3>Send Data</h3>
					<p>Generate a QR code or link to send your data to another device</p>
				</div>
			</div>

			<div class="action-divider">
				<span>or</span>
			</div>

			<div class="action-card receive-card">
				<div class="action-icon"><font-awesome-icon icon="download" /></div>
				<div class="action-info">
					<h3>Receive Data</h3>
					<p>Enter a sync code or paste a link from the sending device</p>
				</div>
				<div class="manual-input" @click.stop>
					<input
							v-model="manualCode"
							type="text"
							placeholder="Paste link or room code…"
							class="input-field"
							@keyup.enter="handleJoinWithCode"
					/>
					<button
							class="btn btn-primary"
							:disabled="!manualCode.trim()"
							@click="handleJoinWithCode"
					>
						Connect
					</button>
				</div>
			</div>
		</div>

		<!-- WAITING: Show QR and Link -->
		<div v-if="status === Status.WAITING_FOR_PEER && syncLink" class="share-section">
			<div class="qr-container">
				<QRCodeVue3
						:value="syncLink"
						:width="220"
						:height="220"
						:dots-options="{ type: 'rounded', color: '#66c0f4' }"
						:background-options="{ color: '#1b2838' }"
						:corners-square-options="{ type: 'extra-rounded', color: '#66c0f4' }"
						:corners-dot-options="{ type: 'dot', color: '#ffffff' }"
						image="/favicon.ico"
						:image-options="{ hideBackgroundDots: true, imageSize: 0.3, margin: 4 }"
				/>
			</div>

			<p class="qr-hint">Scan this QR code with your other device</p>

			<div class="link-section">
				<label class="link-label">Or share this link:</label>
				<div class="link-row">
					<input
							type="text"
							:value="syncLink"
							readonly
							class="input-field link-input"
							@click="$event.target.select()"
					/>
					<button
							class="btn btn-secondary copy-link-btn"
							:class="{ copied: linkCopied }"
							@click="copyLink"
					>
						{{ linkCopied ? 'Copied' : 'Copy' }}
					</button>
				</div>
			</div>

			<div class="room-info">
				<span class="room-code">Room: <strong>{{ roomId }}</strong></span>
				<button class="btn btn-link regenerate-btn" @click="handleRegenerate">
					<font-awesome-icon icon="rotate" /> Regenerate
				</button>
			</div>

			<p class="one-time-hint"><font-awesome-icon icon="triangle-exclamation" /> This code is one-time use and expires in 10 minutes</p>
		</div>

		<!-- CONNECTING / TRANSFERRING -->
		<div v-if="status === Status.CONNECTING || status === Status.TRANSFERRING" class="transfer-section">
			<div class="transfer-animation">
				<div class="device device-a">
					<span><font-awesome-icon :icon="syncDirection === 'send' ? 'desktop' : 'mobile-screen-button'" /></span>
					<span class="device-label">{{ syncDirection === 'send' ? 'This Device' : 'Other Device' }}</span>
				</div>
				<div class="transfer-arrow" :class="{ active: status === Status.TRANSFERRING }">
					<div class="arrow-dots">
						<span class="dot"></span>
						<span class="dot"></span>
						<span class="dot"></span>
					</div>
				</div>
				<div class="device device-b">
					<span><font-awesome-icon :icon="syncDirection === 'send' ? 'mobile-screen-button' : 'desktop'" /></span>
					<span class="device-label">{{ syncDirection === 'send' ? 'Other Device' : 'This Device' }}</span>
				</div>
			</div>

			<div v-if="status === Status.TRANSFERRING" class="progress-section">
				<div class="progress-bar-outer">
					<div class="progress-bar-inner" :style="{ width: progress + '%' }"></div>
				</div>
				<span class="progress-text">{{ progress }}%</span>
			</div>
		</div>

		<!-- COMPLETE -->
		<div v-if="status === Status.COMPLETE" class="complete-section">
			<div class="complete-icon"><font-awesome-icon icon="champagne-glasses" /></div>
			<h3>Data synced successfully!</h3>
			<p v-if="syncDirection === 'receive'">Your library has been updated. Click below to reload and apply all changes.</p>
			<p v-else>Your data has been sent to the other device.</p>
			<button v-if="syncDirection === 'receive'" class="btn btn-primary" @click="reloadPage">Reload & Apply</button>
			<button v-else class="btn btn-primary" @click="close">Done</button>
		</div>
	</BaseOverlay>
</template>

<style scoped>
.sync-header {
	padding: 0;
}

.sync-header h2 {
	margin: 0 0 6px 0;
	font-size: 1.4rem;
	color: #fff;
}

.sync-subtitle {
	color: var(--steam-text-muted);
	font-size: 0.85rem;
	margin: 0;
}

/* Status Bar */
.status-bar {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 25px;
	background: rgba(0, 0, 0, 0.3);
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	font-size: 0.9rem;
}

.status-bar.complete {
	background: rgba(76, 175, 80, 0.15);
}

.status-bar.error {
	background: rgba(244, 67, 54, 0.15);
}

.status-icon {
	font-size: 1.1rem;
}

.status-text {
	color: var(--steam-text-light);
}

/* Error */
.error-block {
	padding: 20px 25px;
	text-align: center;
}

.error-block p {
	color: #ff5252;
	margin-bottom: 15px;
}

/* IDLE Actions */
.sync-actions {
	padding: 20px 25px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.action-card {
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 8px;
	padding: 20px;
	cursor: pointer;
	transition: all 0.25s ease;
	display: flex;
	gap: 15px;
	align-items: flex-start;
	flex-wrap: wrap;
}

.action-card:hover {
	background: rgba(102, 192, 244, 0.08);
	border-color: rgba(102, 192, 244, 0.3);
	transform: translateY(-1px);
}

.receive-card {
	cursor: default;
}

.receive-card:hover {
	transform: none;
}

.action-icon {
	font-size: 2rem;
	flex-shrink: 0;
}

.action-info {
	flex: 1;
	min-width: 0;
}

.action-info h3 {
	margin: 0 0 4px;
	font-size: 1.05rem;
	color: #fff;
}

.action-info p {
	margin: 0;
	font-size: 0.82rem;
	color: var(--steam-text-muted);
}

.action-divider {
	text-align: center;
	color: var(--steam-text-muted);
	font-size: 0.85rem;
	position: relative;
}

.action-divider span {
	background: #1b2838;
	padding: 0 12px;
	position: relative;
	z-index: 1;
}

.action-divider::before {
	content: '';
	position: absolute;
	top: 50%;
	left: 0;
	right: 0;
	height: 1px;
	background: rgba(255, 255, 255, 0.08);
}

.manual-input {
	width: 100%;
	display: flex;
	gap: 8px;
	margin-top: 12px;
}

.manual-input .input-field {
	flex: 1;
	min-width: 0;
}

/* Share Section (QR + Link) */
.share-section {
	padding: 25px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
}

.qr-container {
	padding: 16px;
	background: #1b2838;
	border-radius: 12px;
	border: 2px solid rgba(102, 192, 244, 0.2);
	box-shadow: 0 0 30px rgba(102, 192, 244, 0.08);
	display: flex;
	align-items: center;
	justify-content: center;
}

.qr-hint {
	color: var(--steam-text-muted);
	font-size: 0.85rem;
	margin: 0;
}

.link-section {
	width: 100%;
}

.link-label {
	display: block;
	font-size: 0.82rem;
	color: var(--steam-text-muted);
	margin-bottom: 6px;
}

.link-row {
	display: flex;
	gap: 8px;
}

.link-input {
	flex: 1;
	min-width: 0;
	font-size: 0.8rem;
}

.copy-link-btn {
	flex-shrink: 0;
	min-width: 70px;
}

.copy-link-btn.copied {
	color: #4caf50 !important;
	border-color: #4caf50 !important;
}

.room-info {
	display: flex;
	align-items: center;
	gap: 12px;
}

.room-code {
	font-size: 0.82rem;
	color: var(--steam-text-muted);
}

.room-code strong {
	color: var(--steam-blue-light);
	font-family: monospace;
	letter-spacing: 1px;
}

.regenerate-btn {
	font-size: 0.82rem;
}

.one-time-hint {
	font-size: 0.75rem;
	color: #ff9800;
	opacity: 0.8;
	margin: 0;
}

/* Transfer Animation */
.transfer-section {
	padding: 30px 25px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 25px;
}

.transfer-animation {
	display: flex;
	align-items: center;
	gap: 20px;
}

.device {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	font-size: 2.5rem;
}

.device-label {
	font-size: 0.75rem;
	color: var(--steam-text-muted);
}

.transfer-arrow {
	display: flex;
	align-items: center;
}

.arrow-dots {
	display: flex;
	gap: 6px;
}

.dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--steam-text-muted);
	opacity: 0.3;
}

.transfer-arrow.active .dot {
	animation: dot-pulse 1s ease-in-out infinite;
}

.transfer-arrow.active .dot:nth-child(2) {
	animation-delay: 0.2s;
}

.transfer-arrow.active .dot:nth-child(3) {
	animation-delay: 0.4s;
}

@keyframes dot-pulse {
	0%, 100% {
		opacity: 0.3;
		background: var(--steam-text-muted);
	}
	50% {
		opacity: 1;
		background: var(--steam-blue-light);
	}
}

/* Progress */
.progress-section {
	width: 100%;
	display: flex;
	align-items: center;
	gap: 12px;
}

.progress-bar-outer {
	flex: 1;
	height: 8px;
	background: rgba(255, 255, 255, 0.08);
	border-radius: 4px;
	overflow: hidden;
}

.progress-bar-inner {
	height: 100%;
	background: linear-gradient(90deg, var(--steam-blue-light), #2d73ff);
	border-radius: 4px;
	transition: width 0.2s ease;
}

.progress-text {
	font-size: 0.85rem;
	color: var(--steam-text-light);
	font-weight: bold;
	min-width: 40px;
	text-align: right;
}

/* Complete */
.complete-section {
	padding: 40px 25px;
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
}

.complete-icon {
	font-size: 3rem;
}

.complete-section h3 {
	margin: 0;
	color: #4caf50;
	font-size: 1.2rem;
}

.complete-section p {
	color: var(--steam-text-muted);
	font-size: 0.85rem;
}

/* Mobile */
@media (max-width: 480px) {

	.action-card {
		padding: 15px;
	}

	.qr-container {
		padding: 12px;
	}

	.share-section {
		padding: 20px 15px;
	}

	.device {
		font-size: 2rem;
	}
}
</style>







