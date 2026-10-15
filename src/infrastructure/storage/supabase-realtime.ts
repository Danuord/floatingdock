// src/infrastructure/storage/supabase-realtime.ts
import type { Agencia } from '../../domain/entities/router';
import { supabase } from './supabase-client';

export function suscribirCambios(
  agencia: Agencia,
  onCambio: () => void,
): () => void {
  const canal = supabase
    .channel(`cambios-${agencia}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'routers', filter: `agencia=eq.${agencia}` },
      () => onCambio(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'movimientos', filter: `agencia=eq.${agencia}` },
      () => onCambio(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}