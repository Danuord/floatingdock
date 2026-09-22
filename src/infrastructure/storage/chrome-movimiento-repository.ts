// src/infrastructure/storage/chrome-movimiento-repository.ts
import type { Movimiento } from '../../domain/entities/movimiento';
import type { MovimientoRepository } from '../../domain/repositories/movimiento-repository';
import type { Agencia } from '../../domain/entities/router';
import { pushMovimiento } from './sheets-sync';

const KEYS: Record<Agencia, string> = {
  paraiso: 'movimientos',
  lomas: 'movimientosLomas',
};

export class ChromeMovimientoRepository implements MovimientoRepository {
  constructor(private agencia: Agencia = 'paraiso') {}

  private get key(): string {
    return KEYS[this.agencia];
  }

  async getAll(): Promise<Movimiento[]> {
    const data = await chrome.storage.local.get(this.key);
    return (data[this.key] as Movimiento[]) ?? [];
  }

  async getBySerial(serial: string): Promise<Movimiento[]> {
    const all = await this.getAll();
    return all.filter(m => m.routerSerial === serial);
  }

  async save(movimiento: Movimiento): Promise<void> {
    const all = await this.getAll();
    all.push(movimiento);
    await chrome.storage.local.set({ [this.key]: all });
    void pushMovimiento(movimiento, this.agencia);
  }
}