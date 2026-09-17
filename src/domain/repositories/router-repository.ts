// src/domain/repositories/router-repository.ts
import type { Router } from '../entities/router';

export interface RouterRepository {
  getAll(): Promise<Router[]>;
  getBySerial(serial: string): Promise<Router | null>;
  save(router: Router): Promise<void>;
  delete(id: string): Promise<void>;
}