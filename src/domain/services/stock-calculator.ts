// src/domain/services/stock-calculator.ts
import { UMBRALES_STOCK } from '../entities/tecnicos';
import type { Router, TipoRouter, Agencia } from '../entities/router';

export type AlertaStock = 'ok' | 'bajo' | 'agotado';

export interface StockPorTipo {
  tipo: TipoRouter;
  cantidad: number;
  alerta: AlertaStock;
}

export function calcularStockPorTipo(
  routers: Router[],
  estado: 'nuevo' | 'optimo',
  agencia: Agencia,
): StockPorTipo[] {
  const filtrados = routers.filter(
    r => r.estado === estado
      && r.agencia === agencia
      && r.ubicacion === 'oficina',
  );

  return (Object.keys(UMBRALES_STOCK) as TipoRouter[]).map(tipo => {
    const cantidad = filtrados.filter(r => r.tipo === tipo).length;
    const { bajo, minimo } = UMBRALES_STOCK[tipo];

    let alerta: AlertaStock = 'ok';
    if (cantidad === 0) alerta = 'agotado';
    else if (cantidad <= minimo) alerta = 'agotado';
    else if (cantidad <= bajo) alerta = 'bajo';

    return { tipo, cantidad, alerta };
  });
}

export function calcularEnRevision(routers: Router[]): StockPorTipo[] {
  const pendientes = routers.filter(
    r => r.estado === 'en_revision' && r.ubicacion === 'oficina',
  );

  return (Object.keys(UMBRALES_STOCK) as TipoRouter[]).map(tipo => ({
    tipo,
    cantidad: pendientes.filter(r => r.tipo === tipo).length,
    alerta: 'ok',
  }));
}