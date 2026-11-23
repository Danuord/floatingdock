// src/infrastructure/storage/supabase-movimiento-repository.ts
import type { Movimiento } from '../../domain/entities/movimiento';
import type { MovimientoRepository } from '../../domain/repositories/movimiento-repository';
import type { Agencia } from '../../domain/entities/router';
import { supabase } from './supabase-client';

function toRow(m: Movimiento) {
  return {
    id: m.id,
    tipo: m.tipo,
    router_serial: m.routerSerial,
    router_tipo: m.routerTipo ?? null,
    cliente: m.cliente ?? null,
    tecnico: m.tecnico ?? null,
    motivo: m.motivo ?? null,
    destino: m.destino ?? null,
    detalle: m.detalle ?? null,
    resultado: m.resultado ?? null,
    fecha_retorno: m.fechaRetorno ?? null,
    agencia_origen: m.agenciaOrigen ?? null,
    caracteristica_perdida: m.caracteristicaPerdida ?? null,
    fecha: m.fecha,
    usuario: m.usuario,
    agencia: m.agencia,
  };
}

function fromRow(row: any): Movimiento {
  return {
    id: row.id,
    tipo: row.tipo,
    routerSerial: row.router_serial,
    routerTipo: row.router_tipo ?? undefined,
    cliente: row.cliente ?? undefined,
    tecnico: row.tecnico ?? undefined,
    motivo: row.motivo ?? undefined,
    destino: row.destino ?? undefined,
    detalle: row.detalle ?? undefined,
    resultado: row.resultado ?? undefined,
    fechaRetorno: row.fecha_retorno ? Number(row.fecha_retorno) : undefined,
    agenciaOrigen: row.agencia_origen ?? undefined,
    caracteristicaPerdida: row.caracteristica_perdida ?? undefined,
    fecha: Number(row.fecha),
    usuario: row.usuario,
    agencia: row.agencia,
  };
}

export class SupabaseMovimientoRepository implements MovimientoRepository {
  constructor(private agencia: Agencia = 'paraiso') {}

  async getAll(): Promise<Movimiento[]> {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .eq('agencia', this.agencia)
        .order('fecha', { ascending: false })
        .range(from, from + step - 1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        allData.push(...data);
        from += step;
        if (data.length < step) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return allData.map(fromRow);
  }

  async getBySerial(serial: string): Promise<Movimiento[]> {
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .eq('agencia', this.agencia)
      .eq('router_serial', serial);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async save(movimiento: Movimiento): Promise<void> {
    const { error } = await supabase
      .from('movimientos')
      .insert(toRow(movimiento));
    if (error) throw error;
  }
}