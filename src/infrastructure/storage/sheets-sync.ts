let pullEnCurso: Promise<any> | null = null;

import type { Router } from '../../domain/entities/router';
import type { Movimiento } from '../../domain/entities/movimiento';
import type { Agencia } from '../../domain/entities/router';
import type { SheetsRequest, SheetsResponse } from '../../shared/messages';

async function enviar(req: SheetsRequest): Promise<SheetsResponse> {
  return chrome.runtime.sendMessage(req);
}

// Cola: solo un push a la vez
let cola: Promise<void> = Promise.resolve();
let pendientes = 0;

export function hayPendientes(): boolean {
  return pendientes > 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function encolar(tarea: () => Promise<void>): Promise<void> {
  pendientes++;
  cola = cola.then(async () => {
    try {
      await tarea();
    } finally {
      pendientes--;
      // Pausa entre requests para no saturar Apps Script
      await sleep(400);
    }
  });
  return cola;
}

async function intentarConRetry(req: SheetsRequest, intentos = 3): Promise<SheetsResponse> {
  for (let i = 0; i < intentos; i++) {
    const res = await enviar(req);
    if (res.ok) return res;
    // Si el error parece HTML (Apps Script saturado), esperar y reintentar
    if (res.error && (res.error.includes('<!DOCTYPE') || res.error.includes('Unexpected token'))) {
      await sleep(1000 * (i + 1));
      continue;
    }
    return res;
  }
  return { ok: false, error: 'Reintentos agotados' };
}

export function pushRouter(router: Router, agencia: Agencia): Promise<void> {
  return encolar(async () => {
    const res = await intentarConRetry({ type: 'SHEETS', accion: 'upsertRouter', payload: { router, agencia } });
    if (!res.ok) console.error('pushRouter falló:', res.error);
  });
}

export function pushMovimiento(mov: Movimiento, agencia: Agencia): Promise<void> {
  return encolar(async () => {
    const res = await intentarConRetry({ type: 'SHEETS', accion: 'insertMovimiento', payload: { movimiento: mov, agencia } });
    if (!res.ok) console.error('pushMovimiento falló:', res.error);
  });
}

export async function esperarCola(): Promise<void> {
  await cola;
}

export function pullTodo(agencia: Agencia): Promise<{ routers: Router[]; movimientos: Movimiento[] }> {
  if (pullEnCurso) return pullEnCurso;
  pullEnCurso = hacerPull(agencia).finally(() => { pullEnCurso = null; });
  return pullEnCurso;
}

async function hacerPull(agencia: Agencia): Promise<{ routers: Router[]; movimientos: Movimiento[] }> {
  const res = await enviar({ type: 'SHEETS', accion: 'getAll', payload: { agencia } });
  if (!res.ok) throw new Error(res.error ?? 'Error en pullTodo');
  const data = res.data as { routers: any[]; movimientos: any[] };
  const remotos = (data.routers ?? []).map(normalizarRouter);
  const movsRemotos = (data.movimientos ?? []).map(normalizarMovimiento);

  const keyLocal = agencia === 'lomas' ? 'routersLomas' : 'routers';
  const locales = ((await chrome.storage.local.get(keyLocal))[keyLocal] as Router[]) ?? [];
  const mapaLocal = new Map(locales.map(r => [r.serial, r]));

  const fusionados = remotos.map(rem => {
    const loc = mapaLocal.get(rem.serial);
    if (!loc) return rem;
    return loc.actualizadoEn > rem.actualizadoEn ? loc : rem;
  });

  const serialesRemotos = new Set(remotos.map(r => r.serial));
  const soloLocales = locales.filter(
    r => !serialesRemotos.has(r.serial) && r.agencia === agencia,
  );

  return {
    routers: [...fusionados, ...soloLocales],
    movimientos: movsRemotos,
  };
}

// Normalizadores
function parseFecha(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '') {
    const t = Date.parse(v);
    if (!isNaN(t)) return t;
    const [dd, mm, yyyy] = v.split('/');
    if (dd && mm && yyyy) return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
  }
  return 0;
}

function normalizarRouter(r: any): Router {
  return {
    ...r,
    fechaIngreso: parseFecha(r.fechaIngreso),
    creadoEn: parseFecha(r.creadoEn),
    actualizadoEn: parseFecha(r.actualizadoEn),
    ubicacion: r.ubicacion === '' || r.ubicacion == null ? null : r.ubicacion,
    clienteActual: r.clienteActual || undefined,
    tecnicoActual: r.tecnicoActual || undefined,
    fabricante: r.fabricante || undefined,
    tecnologia: r.tecnologia || undefined,
    lote: r.lote === '' ? undefined : r.lote,
  };
}

function normalizarMovimiento(m: any): Movimiento {
  return {
    ...m,
    fecha: parseFecha(m.fecha),
    fechaRetorno: m.fechaRetorno ? parseFecha(m.fechaRetorno) : undefined,
    cliente: m.cliente || undefined,
    tecnico: m.tecnico || undefined,
    motivo: m.motivo || undefined,
    destino: m.destino || undefined,
    detalle: m.detalle || undefined,
    resultado: m.resultado || undefined,
  };
}

export interface BatchItem {
  router?: Router;
  movimiento?: Movimiento;
  agencia: Agencia;
}

export async function pushBatch(items: BatchItem[]): Promise<void> {
  const upserts = items.filter(i => i.router).map(i => ({ router: i.router, agencia: i.agencia }));
  const movimientos = items.filter(i => i.movimiento).map(i => ({ movimiento: i.movimiento, agencia: i.agencia }));

  const res = await intentarConRetry({
    type: 'SHEETS',
    accion: 'batch' as any,
    payload: { upserts, movimientos },
  });
  if (!res.ok) console.error('pushBatch falló:', res.error);
}