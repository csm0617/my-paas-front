import React, { useMemo, useState } from 'react';
import type { ServiceResources } from '@/lib/serviceResources';
import { clampIndex, cpuStops, formatCpu, formatMem, memoryStops, nearestStop, parseCpuToMillicores, parseMemToMi } from '@/lib/serviceResources';

type Props = {
  value: ServiceResources;
  onChange: (next: ServiceResources) => void;
};

type RowKey = keyof ServiceResources;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export default function ServiceResourcesPanel({ value, onChange }: Props) {
  const [cpuUnit, setCpuUnit] = useState<'m' | 'c'>('m');
  const [memUnit, setMemUnit] = useState<'Mi' | 'Gi'>('Mi');

  const cpuRows = useMemo(() => ([
    { key: 'requestsCpu' as const, label: 'CPU Requests' },
    { key: 'limitsCpu' as const, label: 'CPU Limits' },
  ]), []);

  const memRows = useMemo(() => ([
    { key: 'requestsMemory' as const, label: 'Memory Requests' },
    { key: 'limitsMemory' as const, label: 'Memory Limits' },
  ]), []);

  const setRow = (k: RowKey, next: string) => onChange({ ...value, [k]: next });

  const sliderIndexForCpu = (raw: string) => {
    const mc = parseCpuToMillicores(raw);
    if (!mc) return 0;
    const nearest = nearestStop(mc, cpuStops);
    return clampIndex(cpuStops.indexOf(nearest), cpuStops.length);
  };

  const sliderIndexForMem = (raw: string) => {
    const mi = parseMemToMi(raw);
    if (!mi) return 0;
    const nearest = nearestStop(mi, memoryStops);
    return clampIndex(memoryStops.indexOf(nearest), memoryStops.length);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">CPU</div>
            <div className="flex items-center gap-1 text-[11px]">
              <button type="button" className={`px-2 py-1 rounded-lg border ${cpuUnit === 'm' ? 'bg-slate-100 dark:bg-slate-700' : 'bg-transparent'}`} onClick={() => setCpuUnit('m')}>m</button>
              <button type="button" className={`px-2 py-1 rounded-lg border ${cpuUnit === 'c' ? 'bg-slate-100 dark:bg-slate-700' : 'bg-transparent'}`} onClick={() => setCpuUnit('c')}>c</button>
            </div>
          </div>

          {cpuRows.map((r) => {
            const idx = sliderIndexForCpu(value[r.key]);
            const fallbackMc = cpuStops[clamp(idx, 0, cpuStops.length - 1)];
            const mc = parseCpuToMillicores(value[r.key]) ?? fallbackMc;
            return (
              <div key={r.key} className="space-y-2">
                <div className="text-xs text-slate-500">{r.label}</div>
                <input
                  type="range"
                  min={0}
                  max={cpuStops.length - 1}
                  step={1}
                  value={idx}
                  onChange={(e) => {
                    const nextIdx = Number(e.target.value);
                    const nextMc = cpuStops[clamp(nextIdx, 0, cpuStops.length - 1)];
                    setRow(r.key, `${nextMc}m`);
                  }}
                  className="w-full"
                />
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="number"
                    step={cpuUnit === 'm' ? 1 : 0.1}
                    value={cpuUnit === 'm' ? mc : mc / 1000}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n) || n <= 0) return;
                      const nextMc = cpuUnit === 'm' ? Math.round(n) : Math.round(n * 1000);
                      setRow(r.key, `${nextMc}m`);
                    }}
                    className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none"
                  />
                  <div className="text-xs text-slate-500 font-mono">{formatCpu(mc, cpuUnit)}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Memory</div>
            <div className="flex items-center gap-1 text-[11px]">
              <button type="button" className={`px-2 py-1 rounded-lg border ${memUnit === 'Mi' ? 'bg-slate-100 dark:bg-slate-700' : 'bg-transparent'}`} onClick={() => setMemUnit('Mi')}>Mi</button>
              <button type="button" className={`px-2 py-1 rounded-lg border ${memUnit === 'Gi' ? 'bg-slate-100 dark:bg-slate-700' : 'bg-transparent'}`} onClick={() => setMemUnit('Gi')}>Gi</button>
            </div>
          </div>

          {memRows.map((r) => {
            const idx = sliderIndexForMem(value[r.key]);
            const fallbackMi = memoryStops[clamp(idx, 0, memoryStops.length - 1)];
            const mi = parseMemToMi(value[r.key]) ?? fallbackMi;
            return (
              <div key={r.key} className="space-y-2">
                <div className="text-xs text-slate-500">{r.label}</div>
                <input
                  type="range"
                  min={0}
                  max={memoryStops.length - 1}
                  step={1}
                  value={idx}
                  onChange={(e) => {
                    const nextIdx = Number(e.target.value);
                    const nextMi = memoryStops[clamp(nextIdx, 0, memoryStops.length - 1)];
                    setRow(r.key, `${nextMi}Mi`);
                  }}
                  className="w-full"
                />
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="number"
                    step={memUnit === 'Mi' ? 1 : 0.1}
                    value={memUnit === 'Mi' ? mi : mi / 1024}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n) || n <= 0) return;
                      const nextMi = memUnit === 'Mi' ? Math.round(n) : Math.round(n * 1024);
                      setRow(r.key, `${nextMi}Mi`);
                    }}
                    className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none"
                  />
                  <div className="text-xs text-slate-500 font-mono">{formatMem(mi, memUnit)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

