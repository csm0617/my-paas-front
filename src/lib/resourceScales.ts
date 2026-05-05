export type CpuUnit = 'm' | 'c'
export type MemoryUnit = 'Mi' | 'Gi'

export const CPU_MILLICORE_STOPS = [50, 100, 250, 500, 1000, 2000, 4000] as const
export const MEMORY_MI_STOPS = [64, 128, 256, 512, 1024, 2048, 4096] as const

