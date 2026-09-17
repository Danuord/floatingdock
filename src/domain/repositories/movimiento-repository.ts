// src/domain/repositories/movimiento-repository.ts
import type { Movimiento } from '../entities/movimiento';

export interface MovimientoRepository {
  getAll(): Promise<Movimiento[]>;
  getBySerial(serial: string): Promise<Movimiento[]>;
  save(movimiento: Movimiento): Promise<void>;
}