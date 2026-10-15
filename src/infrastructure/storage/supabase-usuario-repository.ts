// src/infrastructure/storage/supabase-usuario-repository.ts
import { supabase } from './supabase-client';

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function loginSupabase(nombre: string, pin: string): Promise<LoginResult> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('pin, activo')
    .eq('nombre', nombre)
    .maybeSingle();

  if (error) return { ok: false, error: 'Error de conexión' };
  if (!data) return { ok: false, error: 'Usuario no existe' };
  if (!data.activo) return { ok: false, error: 'Usuario inactivo' };
  if (data.pin !== pin) return { ok: false, error: 'PIN incorrecto' };
  return { ok: true };
}

export async function cambiarPinSupabase(
  nombre: string,
  pinViejo: string,
  pinNuevo: string,
): Promise<LoginResult> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('pin')
    .eq('nombre', nombre)
    .maybeSingle();

  if (error) return { ok: false, error: 'Error de conexión' };
  if (!data) return { ok: false, error: 'Usuario no existe' };
  if (data.pin !== pinViejo) return { ok: false, error: 'PIN actual incorrecto' };
  if (pinNuevo.length < 4) return { ok: false, error: 'PIN muy corto' };

  const { error: updateError } = await supabase
    .from('usuarios')
    .update({ pin: pinNuevo })
    .eq('nombre', nombre);

  if (updateError) return { ok: false, error: 'No se pudo actualizar' };
  return { ok: true };
}

export async function getUsuariosActivos(): Promise<string[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('nombre')
    .eq('activo', true)
    .order('nombre');
  if (error) return [];
  return (data ?? []).map(u => u.nombre);
}