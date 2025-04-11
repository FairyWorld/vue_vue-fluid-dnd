export const FRAMEWORKS_TYPES = {
  vue: 'vue',
  svelte: 'svelte',
} as const

export const FRAMEWORKS_TEMPLATE = 'framework'

export type FRAMEWORKS_TYPE = keyof typeof FRAMEWORKS_TYPES