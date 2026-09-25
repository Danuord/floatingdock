// src/domain/entities/movimiento.ts
import type { TipoRouter } from './router';
import type { Agencia } from './router';

export type TipoMovimiento =
  | 'registro_nuevo'
  | 'retorno'
  | 'salida'
  | 'asignacion_cliente'
  | 'revision'
  | 'merma'
  | 'desasignacion'
  | 'transferencia_lomas'
  | 'entrada_lomas';

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
  agenciaOrigen?: Agencia;
  caracteristicaPerdida?: 'cable' | 'internet';

  fecha: number;
  usuario: string;
  agencia: Agencia;
}