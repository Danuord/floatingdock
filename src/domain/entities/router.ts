// src/domain/entities/router.ts

/**
 * Tipo de ONU / Router.
 * Solo hay tres tipos por ahora, según lo que manejan en la empresa.
 */
export type TipoRouter = 'duo' | 'internet' | 'cable';

/**
 * Estado del router dentro de su ciclo de vida.
 * - nuevo:        recién registrado, nunca usado
 * - optimo:       funciona, listo para asignar/instalar
 * - en_revision:  volvió del campo, pendiente de revisar
 * - dañado:       merma, no sirve
 */
export type EstadoRouter = 'nuevo' | 'optimo' | 'en_revision' | 'dañado';

/**
 * Dónde está físicamente el router ahora mismo.
 * - oficina:  está en bodega / a mano
 * - campo:    salió con un técnico o ya está instalado en un cliente
 *
 * OJO: ubicacion es independiente de estado.
 * Un router 'optimo' puede estar en oficina o en campo.
 * Por eso son dos campos separados.
 */
export type UbicacionRouter = 'oficina' | 'campo' | null;

/* Agencia o paraíso o lomas*/
export type Agencia = 'paraiso' | 'lomas';

/**
 * Un Router es UN equipo físico individual.
 * Se identifica por su número de serie (único).
 */
export interface Router {
  /** ID interno generado por el sistema (crypto.randomUUID) */
  id: string;

  /** Número de serie del equipo. Único. Ej: OPTI597C8779 */
  serial: string;

  /** Tipo de ONU: duo, internet o cable */
  tipo: TipoRouter;

  /** Estado del ciclo de vida */
  estado: EstadoRouter;

  /** Dónde está físicamente */
  ubicacion: UbicacionRouter;

  /** Agencia donde está actualmente*/
  agencia: Agencia;

  // ─── Datos del equipo ───────────────────────────────
  /** Fabricante: Optictimes, ZTE, Huawei... */
  fabricante?: string;

  /** Tecnología: WiFi 5, WiFi 6... */
  tecnologia?: string;

  /** Lote de ingreso (el que aparece en tu Excel) */
  lote?: string;

  /** Timestamp de cuándo entró al sistema por primera vez */
  fechaIngreso: number;

  // ─── Snapshot actual ────────────────────────────────
  // Se sobreescriben cada vez que se registra un movimiento.
  // El historial completo vive en Movimiento, no aquí.
  /** Cliente donde está o estará el router (si aplica) */
  clienteActual?: string;

  /** Técnico que lo tiene o lo instaló (si aplica) */
  tecnicoActual?: string;

  // ─── Metadata ───────────────────────────────────────
  /** Timestamp de creación del registro */
  creadoEn: number;

  /** Timestamp de la última modificación */
  actualizadoEn: number;
}