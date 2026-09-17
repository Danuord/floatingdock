// src/domain/services/stock-calculator.ts
import type { Router, TipoRouter } from '../entities/router';
import { UMBRALES_STOCK } from '../entities/tecnicos';

export type AlertaStock = 'ok' | 'bajo' | 'agotado';

export interface StockPorTipo {
  tipo: TipoRouter;
  cantidad: number;
  alerta: AlertaStock;
}

export function calcularStockPorTipo(routers: Router[]): StockPorTipo[] {
  // Solo cuentan los que están en oficina y no están dañados
  const enOficina = routers.filter(
    r => r.ubicacion === 'oficina' && r.estado !== 'dañado',
  );

  return (Object.keys(UMBRALES_STOCK) as TipoRouter[]).map(tipo => {
    const cantidad = enOficina.filter(r => r.tipo === tipo).length;
    const { bajo, minimo } = UMBRALES_STOCK[tipo];

    let alerta: AlertaStock = 'ok';
    if (cantidad === 0) alerta = 'agotado';
    else if (cantidad <= minimo) alerta = 'agotado';
    else if (cantidad <= bajo) alerta = 'bajo';

    return { tipo, cantidad, alerta };
  });
}