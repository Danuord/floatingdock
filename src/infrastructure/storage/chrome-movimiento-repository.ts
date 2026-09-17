// src/infrastructure/storage/chrome-movimiento-repository.ts
import type { Movimiento } from '../../domain/entities/movimiento';
import type { MovimientoRepository } from '../../domain/repositories/movimiento-repository';
import { pushMovimiento } from './sheets-sync';

const KEY = 'movimientos';

export class ChromeMovimientoRepository implements MovimientoRepository {
  async getAll(): Promise<Movimiento[]> {
    const data = await chrome.storage.local.get(KEY);
    return (data[KEY] as Movimiento[]) ?? [];
  }

  async getBySerial(serial: string): Promise<Movimiento[]> {
    const all = await this.getAll();
    return all.filter(m => m.routerSerial === serial);
  }

  async save(movimiento: Movimiento): Promise<void> {
    const all = await this.getAll();
    all.push(movimiento);
    await chrome.storage.local.set({ [KEY]: all });
    void pushMovimiento(movimiento);
  }
}