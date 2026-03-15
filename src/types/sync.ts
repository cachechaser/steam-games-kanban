import type { SteamColumn, SteamGame, SteamUserProfile } from '@/types/domain'

export const Status = {
  IDLE: 'idle',
  CREATING_ROOM: 'creating-room',
  WAITING_FOR_PEER: 'waiting-for-peer',
  JOINING_ROOM: 'joining-room',
  CONNECTING: 'connecting',
  TRANSFERRING: 'transferring',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const

export type SyncStatus = (typeof Status)[keyof typeof Status]
export type SyncDirection = 'send' | 'receive'

export type PersistedRoom = {
  roomId: string
  direction: SyncDirection
}

export type SyncDataPayload = {
  version: number
  timestamp?: number
  steamId?: string
  apiKey?: string
  columns?: SteamColumn[]
  lastUpdated?: number
  userProfile?: SteamUserProfile | null
  games: SteamGame[]
}

export type DataChannelMessage =
  | { type: 'sync-header'; totalChunks: number; totalSize: number }
  | { type: 'sync-chunk'; index: number; data: string }
  | { type: 'sync-done' }

export type SignalingMessage = {
  type?: string
  roomId?: string
  message?: string
  offer?: RTCSessionDescriptionInit
  answer?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  [Status.IDLE]: 'Ready',
  [Status.CREATING_ROOM]: 'Creating room…',
  [Status.WAITING_FOR_PEER]: 'Waiting for other device…',
  [Status.JOINING_ROOM]: 'Joining room…',
  [Status.CONNECTING]: 'Establishing connection…',
  [Status.TRANSFERRING]: 'Transferring data…',
  [Status.COMPLETE]: 'Sync complete!',
  [Status.ERROR]: 'Error',
}

export const SYNC_STATUS_ICONS: Record<SyncStatus, string> = {
  [Status.IDLE]: 'satellite-dish',
  [Status.CREATING_ROOM]: 'spinner',
  [Status.WAITING_FOR_PEER]: 'mobile-screen-button',
  [Status.JOINING_ROOM]: 'link',
  [Status.CONNECTING]: 'handshake',
  [Status.TRANSFERRING]: 'box',
  [Status.COMPLETE]: 'circle-check',
  [Status.ERROR]: 'xmark',
}


