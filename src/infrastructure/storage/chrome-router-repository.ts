// src/infrastructure/storage/chrome-router-repository.ts
import type { Router, Agencia } from '../../domain/entities/router';
import type { RouterRepository } from '../../domain/repositories/router-repository';
import { pushRouter } from './sheets-sync';

const KEYS: Record<Agencia, string> = {
  paraiso: 'routers',
  lomas: 'routersLomas',
};

export class ChromeRouterRepository implements RouterRepository {
  constructor(private agencia: Agencia = 'paraiso') {}

  private get key(): string {
    return KEYS[this.agencia];
  }

  async getAll(): Promise<Router[]> {
    const data = await chrome.storage.local.get(this.key);
    return (data[this.key] as Router[]) ?? [];
  }

  async getBySerial(serial: string): Promise<Router | null> {
    const all = await this.getAll();
    return all.find(r => r.serial === serial) ?? null;
  }

  async save(router: Router): Promise<void> {
    const all = await this.getAll();
    const idx = all.findIndex(r => r.id === router.id);
    if (idx >= 0) all[idx] = router;
    else all.push(router);
    await chrome.storage.local.set({ [this.key]: all });
    void pushRouter(router, this.agencia);
  }

  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    await chrome.storage.local.set({ [this.key]: all.filter(r => r.id !== id) });
  }
}