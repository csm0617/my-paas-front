import type { DeployCommand } from '@/lib/api'
import type { CpuUnit, MemoryUnit } from '@/lib/resourceScales'
import { CPU_MILLICORE_STOPS, MEMORY_MI_STOPS } from '@/lib/resourceScales'

export type ResourcePreset = 'Small' | 'Medium' | 'Large'

export type ServiceResources = {
  requestsCpu: string
  limitsCpu: string
  requestsMemory: string
  limitsMemory: string
}

export type ServiceResourcesMap = Record<string, ServiceResources>

export const defaultServiceResources = (preset: ResourcePreset): ServiceResources => {
  if (preset === 'Medium') return { requestsCpu: '250m', requestsMemory: '256Mi', limitsCpu: '500m', limitsMemory: '512Mi' }
  if (preset === 'Large') return { requestsCpu: '500m', requestsMemory: '512Mi', limitsCpu: '1000m', limitsMemory: '1024Mi' }
  return { requestsCpu: '100m', requestsMemory: '128Mi', limitsCpu: '200m', limitsMemory: '256Mi' }
}

export const buildPresetServiceResourcesMap = (cmd: DeployCommand, preset: ResourcePreset): ServiceResourcesMap => {
  const d = defaultServiceResources(preset)
  return cmd.services.reduce((acc, s) => {
    acc[s.name] = { ...d }
    return acc
  }, {} as ServiceResourcesMap)
}

/**
 * 将 CPU 字符串解析为 millicores（例如：250m -> 250；1c/1 -> 1000）。
 * 返回 null 表示格式不合法或为空。
 */
export const parseCpuToMillicores = (raw: string): number | null => {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  if (v.endsWith('m')) {
    const n = Number(v.slice(0, -1))
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }
  if (v.endsWith('c')) {
    const n = Number(v.slice(0, -1))
    return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null
  }
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null
}

/**
 * 将内存字符串解析为 Mi（例如：512Mi -> 512；1Gi -> 1024）。
 * 返回 null 表示格式不合法或为空。
 */
export const parseMemToMi = (raw: string): number | null => {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  if (v.endsWith('mi')) {
    const n = Number(v.slice(0, -2))
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }
  if (v.endsWith('gi')) {
    const n = Number(v.slice(0, -2))
    return Number.isFinite(n) && n > 0 ? Math.round(n * 1024) : null
  }
  return null
}

export const formatCpu = (millicores: number, unit: CpuUnit): string => {
  if (unit === 'm') return `${millicores}m`
  const cores = millicores / 1000
  const s = Number.isInteger(cores) ? String(cores) : String(Number(cores.toFixed(3))).replace(/\.0+$/, '')
  return `${s}c`
}

export const formatMem = (mi: number, unit: MemoryUnit): string => {
  if (unit === 'Mi') return `${mi}Mi`
  const gi = mi / 1024
  const s = Number.isInteger(gi) ? String(gi) : String(Number(gi.toFixed(3))).replace(/\.0+$/, '')
  return `${s}Gi`
}

export const formatCpuCompact = (millicores: number): string => {
  if (millicores % 1000 === 0) return `${millicores / 1000}c`
  return `${millicores}m`
}

export const formatMemCompact = (mi: number): string => {
  if (mi % 1024 === 0) return `${mi / 1024}Gi`
  return `${mi}Mi`
}

export const nearestStop = (value: number, stops: readonly number[]) => {
  let best = stops[0]
  let bestDist = Math.abs(value - best)
  for (const s of stops) {
    const d = Math.abs(value - s)
    if (d < bestDist) {
      best = s
      bestDist = d
    }
  }
  return best
}

export const clampIndex = (idx: number, maxExclusive: number) => {
  if (!Number.isFinite(idx)) return 0
  if (idx < 0) return 0
  if (idx >= maxExclusive) return Math.max(0, maxExclusive - 1)
  return idx
}

export const ensureServiceResourcesMap = (cmd: DeployCommand, preset: ResourcePreset): ServiceResourcesMap => {
  const d = defaultServiceResources(preset)
  return cmd.services.reduce((acc, s) => {
    const c0 = s.containers?.[0]
    acc[s.name] = {
      requestsCpu: c0?.requestsCpu || d.requestsCpu,
      limitsCpu: c0?.limitsCpu || d.limitsCpu,
      requestsMemory: c0?.requestsMemory || d.requestsMemory,
      limitsMemory: c0?.limitsMemory || d.limitsMemory,
    }
    return acc
  }, {} as ServiceResourcesMap)
}

export const applyServiceResourcesToCommand = (cmd: DeployCommand, map: ServiceResourcesMap): DeployCommand => {
  return {
    ...cmd,
    services: cmd.services.map((s) => {
      const r = map[s.name]
      if (!r) return s
      return {
        ...s,
        containers: s.containers.map((c) => ({
          ...c,
          requestsCpu: r.requestsCpu,
          limitsCpu: r.limitsCpu,
          requestsMemory: r.requestsMemory,
          limitsMemory: r.limitsMemory,
        })),
      }
    }),
  }
}

export const getServiceResourcesSummary = (containers: Array<Partial<ServiceResources>> | undefined) => {
  const list = containers || []
  const first = list[0]
  if (!first) return { cpu: '-', mem: '-' }

  const same = (k: keyof ServiceResources) => list.every((c) => c?.[k] === first?.[k])
  const cpuSame = same('requestsCpu') && same('limitsCpu')
  const memSame = same('requestsMemory') && same('limitsMemory')

  const cpuReqRaw = (first.requestsCpu || '').trim()
  const cpuLimRaw = (first.limitsCpu || '').trim()
  const memReqRaw = (first.requestsMemory || '').trim()
  const memLimRaw = (first.limitsMemory || '').trim()

  const cpuReq = parseCpuToMillicores(cpuReqRaw)
  const cpuLim = parseCpuToMillicores(cpuLimRaw)
  const memReq = parseMemToMi(memReqRaw)
  const memLim = parseMemToMi(memLimRaw)

  const cpu =
    cpuSame && !cpuReqRaw && !cpuLimRaw ? '-' : cpuSame && cpuReq && cpuLim ? `${formatCpuCompact(cpuReq)} / ${formatCpuCompact(cpuLim)}` : 'Mixed'
  const mem =
    memSame && !memReqRaw && !memLimRaw ? '-' : memSame && memReq && memLim ? `${formatMemCompact(memReq)} / ${formatMemCompact(memLim)}` : 'Mixed'

  return { cpu, mem }
}

export const cpuStops = CPU_MILLICORE_STOPS as unknown as readonly number[]
export const memoryStops = MEMORY_MI_STOPS as unknown as readonly number[]
