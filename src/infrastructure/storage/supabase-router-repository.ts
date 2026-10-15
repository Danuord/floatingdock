// src/infrastructure/storage/supabase-router-repository.ts
import type { Router, Agencia } from '../../domain/entities/router';
import type { RouterRepository } from '../../domain/repositories/router-repository';
import { supabase } from './supabase-client';

function toRow(r: Router) {
  return {
    id: r.id,
    serial: r.serial,
    tipo: r.tipo,
    estado: r.estado,
    ubicacion: r.ubicacion,
    agencia: r.agencia,
    fabricante: r.fabricante ?? null,
    tecnologia: r.tecnologia ?? null,
    lote: r.lote ?? null,
    fecha_ingreso: r.fechaIngreso,
    cliente_actual: r.clienteActual ?? null,
    tecnico_actual: r.tecnicoActual ?? null,
    creado_en: r.creadoEn,
    actualizado_en: r.actualizadoEn,
  };
}

function fromRow(row: any): Router {
  return {
    id: row.id,
    serial: row.serial,
    tipo: row.tipo,
    estado: row.estado,
    ubicacion: row.ubicacion ?? null,
    agencia: row.agencia,
    fabricante: row.fabricante ?? undefined,
    tecnologia: row.tecnologia ?? undefined,
    lote: row.lote ?? undefined,
    fechaIngreso: Number(row.fecha_ingreso),
    clienteActual: row.cliente_actual ?? undefined,
    tecnicoActual: row.tecnico_actual ?? undefined,
    creadoEn: Number(row.creado_en),
    actualizadoEn: Number(row.actualizado_en),
  };
}

export class SupabaseRouterRepository implements RouterRepository {
  constructor(private agencia: Agencia = 'paraiso') {}

  async getAll(): Promise<Router[]> {
    const { data, error } = await supabase
      .from('routers')
      .select('*')
      .eq('agencia', this.agencia);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async getBySerial(serial: string): Promise<Router | null> {
    const { data, error } = await supabase
      .from('routers')
      .select('*')
      .eq('agencia', this.agencia)
      .eq('serial', serial)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
  }

  async save(router: Router): Promise<void> {
    const { error } = await supabase
      .from('routers')
      .upsert(toRow(router), { onConflict: 'id' });
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('routers').delete().eq('id', id);
    if (error) throw error;
  }
}