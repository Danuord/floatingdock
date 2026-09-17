// src/infrastructure/storage/chrome-router-repository.ts
import type { Router } from '../../domain/entities/router';
import type { RouterRepository } from '../../domain/repositories/router-repository';

const KEY = 'routers';

export class ChromeRouterRepository implements RouterRepository {
  async getAll(): Promise<Router[]> {
    const data = await chrome.storage.local.get(KEY);
    return (data[KEY] as Router[]) ?? [];
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
    await chrome.storage.local.set({ [KEY]: all });
  }

  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    await chrome.storage.local.set({ [KEY]: all.filter(r => r.id !== id) });
  }
}