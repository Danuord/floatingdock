// src/domain/entities/tecnicos.ts
import type { TipoRouter } from './router';

/** Lista fija de técnicos. Cuando entre/salga uno, se edita aquí. */
export const TECNICOS: string[] = [
  'Dan A.',
  'Diego',
  'Rafael',
  'Jesus',
  'Renzo',
  'Daniel',
];

/** Usuarios del sistema (las que registran en el sidebar) */
export const USUARIOS: string[] = [
  'Daniel',
  'Mayly',
  'Anahi',
  'Rosmery',
  'Renzo',
];

/** Umbrales de stock por tipo de router. */
export const UMBRALES_STOCK: Record<TipoRouter, { bajo: number; minimo: number }> = {
  duo:      { bajo: 20, minimo: 10 },
  internet: { bajo: 20, minimo: 10 },
  cable:    { bajo: 20,  minimo: 10 },
};