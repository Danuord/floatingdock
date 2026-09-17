// src/domain/entities/movimiento.ts
import type { TipoRouter } from './router';

export type TipoMovimiento =
  | 'registro_nuevo'
  | 'retorno'
  | 'salida'
  | 'asignacion_cliente'
  | 'revision'
  | 'merma'
  | 'desasignacion';

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  routerSerial: string;
  routerTipo?: TipoRouter;

  cliente?: string;
  tecnico?: string;
  motivo?: string;
  destino?: 'optimo' | 'a_revisar';
  detalle?: string;
  resultado?: 'optimo' | 'merma';
  fechaRetorno?: number;

  fecha: number;
  usuario: string;
}