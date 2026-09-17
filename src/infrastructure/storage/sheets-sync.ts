// src/infrastructure/storage/sheets-sync.ts
import type { Router } from '../../domain/entities/router';
import type { Movimiento } from '../../domain/entities/movimiento';
import type { SheetsRequest, SheetsResponse } from '../../shared/messages';

async function enviar(req: SheetsRequest): Promise<SheetsResponse> {
  return chrome.runtime.sendMessage(req);
}

export async function pushRouter(router: Router): Promise<void> {
  const res = await enviar({ type: 'SHEETS', accion: 'upsertRouter', payload: { router } });
  if (!res.ok) console.error('pushRouter falló:', res.error);
}

export async function pushMovimiento(mov: Movimiento): Promise<void> {
  const res = await enviar({ type: 'SHEETS', accion: 'insertMovimiento', payload: { movimiento: mov } });
  if (!res.ok) console.error('pushMovimiento falló:', res.error);
}

export async function pullTodo(): Promise<{ routers: Router[]; movimientos: Movimiento[] }> {
  const res = await enviar({ type: 'SHEETS', accion: 'getAll' });
  if (!res.ok) throw new Error(res.error ?? 'Error en pullTodo');
  const data = res.data as { routers: Router[]; movimientos: Movimiento[] };
  return { routers: data.routers ?? [], movimientos: data.movimientos ?? [] };
}