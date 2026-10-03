import * as XLSX from 'xlsx';
import type { Router, Agencia, TipoRouter } from '../entities/router';
import type { Movimiento } from '../entities/movimiento';
import type { ExportTipo } from '../../dock/views/modals/export-modal';

const TIPO_LABEL: Record<TipoRouter, string> = {
  duo: 'Duo',
  internet: 'Internet',
  cable: 'Cable',
};

const AGENCIA_LABEL: Record<Agencia, string> = {
  paraiso: 'Paraíso',
  lomas: 'Lomas',
};

const UBIC_LABEL: Record<string, string> = {
  oficina: 'Oficina',
  campo: 'Campo',
};

function fmt(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtMes(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function ultimoMov(movs: Movimiento[], serial: string, tipos: string[]): Movimiento | undefined {
  return movs
    .filter(m => m.routerSerial === serial && tipos.includes(m.tipo))
    .sort((a, b) => b.fecha - a.fecha)[0];
}

function hojaGeneral(routers: Router[]): any[] {
  return routers.map(r => ({
    SERIAL: r.serial,
    LOTE: r.lote ?? '',
    TIPO: TIPO_LABEL[r.tipo],
    ESTADO: r.estado,
    AGENCIA: AGENCIA_LABEL[r.agencia],
    UBICACION: r.ubicacion ? UBIC_LABEL[r.ubicacion] : '',
    TECNOLOGIA: r.tecnologia ?? '',
    MES_INGRESO: fmtMes(r.fechaIngreso),
    CLIENTE_ACTUAL: r.clienteActual ?? '',
  }));
}

function hojaNuevos(routers: Router[], movs: Movimiento[]): any[] {
  return routers
    .filter(r => r.estado === 'nuevo')
    .map(r => {
      const reg = ultimoMov(movs, r.serial, ['registro_nuevo']);
      return {
        SERIAL: r.serial,
        LOTE: r.lote ?? '',
        TIPO: TIPO_LABEL[r.tipo],
        ESTADO: r.estado,
        AGENCIA: AGENCIA_LABEL[r.agencia],
        UBICACION: r.ubicacion ? UBIC_LABEL[r.ubicacion] : '',
        TECNOLOGIA: r.tecnologia ?? '',
        FECHA_INGRESO: fmt(r.fechaIngreso),
        CLIENTE_ACTUAL: r.clienteActual ?? '',
        AGENTE: reg?.usuario ?? '',
      };
    });
}

function hojaOptimos(routers: Router[], movs: Movimiento[]): any[] {
  return routers
    .filter(r => r.estado === 'optimo')
    .map(r => {
      const retorno = ultimoMov(movs, r.serial, ['retorno']);
      const revision = ultimoMov(movs, r.serial, ['revision']);
      const candidatos = [retorno, revision].filter(Boolean) as Movimiento[];
      const ultimo = candidatos.sort((a, b) => b.fecha - a.fecha)[0];
      const tecnico = r.tecnicoActual ?? ultimo?.tecnico ?? '';
      return {
        SERIAL: r.serial,
        TIPO: TIPO_LABEL[r.tipo],
        ESTADO: r.estado,
        AGENCIA: AGENCIA_LABEL[r.agencia],
        UBICACION: r.ubicacion ? UBIC_LABEL[r.ubicacion] : '',
        TECNOLOGIA: r.tecnologia ?? '',
        FECHA_INGRESO: fmt(ultimo?.fecha),
        CLIENTE_ACTUAL: r.clienteActual ?? '',
        AGENTE_REGISTRO: ultimo?.usuario ?? '',
        TECNICO: tecnico,
      };
    });
}

function hojaRevisados(routers: Router[], movs: Movimiento[]): any[] {
  const revs = movs.filter(m => m.tipo === 'revision' || m.tipo === 'merma');
  return revs.map(m => {
    const r = routers.find(x => x.serial === m.routerSerial);
    return {
      SERIAL: m.routerSerial,
      TIPO: m.routerTipo ? TIPO_LABEL[m.routerTipo] : '',
      ESTADO: m.resultado === 'optimo' ? 'Óptimo' : 'Merma',
      AGENCIA: r ? AGENCIA_LABEL[r.agencia] : '',
      UBICACION: r && r.ubicacion ? UBIC_LABEL[r.ubicacion] : '',
      TECNOLOGIA: r?.tecnologia ?? '',
      FECHA_REVISION: fmt(m.fecha),
      CLIENTE_ACTUAL: r?.clienteActual ?? m.cliente ?? '',
      CARACTERISTICA_PERDIDA: m.caracteristicaPerdida ?? '',
      AGENTE: m.usuario,
    };
  });
}

function hojaRetorno(movs: Movimiento[]): any[] {
  return movs
    .filter(m => m.tipo === 'retorno')
    .map(m => ({
      SERIAL: m.routerSerial,
      TIPO: m.routerTipo ? TIPO_LABEL[m.routerTipo] : '',
      ESTADO: m.destino === 'optimo' ? 'Óptimo' : 'En revisión',
      ULTIMA_AGENCIA: m.agenciaOrigen ? AGENCIA_LABEL[m.agenciaOrigen] : '',
      FECHA_RETORNO: fmt(m.fecha),
      ULTIMO_CLIENTE: m.cliente ?? '',
      AGENTE: m.usuario,
      TECNICO: m.tecnico ?? '',
    }));
}

function hojaMerma(routers: Router[], movs: Movimiento[]): any[] {
  const mermas = movs.filter(m => m.tipo === 'merma');
  return mermas.map(m => {
    const r = routers.find(x => x.serial === m.routerSerial);
    return {
      SERIAL: m.routerSerial,
      TIPO: m.routerTipo ? TIPO_LABEL[m.routerTipo] : '',
      ESTADO: 'Merma',
      AGENCIA: r ? AGENCIA_LABEL[r.agencia] : '',
      TECNOLOGIA: r?.tecnologia ?? '',
      FECHA_REVISION: fmt(m.fecha),
      ULTIMO_CLIENTE: r?.clienteActual ?? m.cliente ?? '',
      AGENTE: m.usuario,
      TECNICO: m.tecnico ?? '',
    };
  });
}

export function generarExcel(
  tipos: ExportTipo[],
  routers: Router[],
  movs: Movimiento[],
  agencia: Agencia,
): void {
  const wb = XLSX.utils.book_new();

  const construcciones: Record<ExportTipo, () => { nombre: string; data: any[] }> = {
    general: () => ({ nombre: 'General', data: hojaGeneral(routers) }),
    nuevos: () => ({ nombre: 'Nuevos', data: hojaNuevos(routers, movs) }),
    optimos: () => ({ nombre: 'Óptimos', data: hojaOptimos(routers, movs) }),
    revisados: () => ({ nombre: 'Revisados', data: hojaRevisados(routers, movs) }),
    retorno: () => ({ nombre: 'Retorno', data: hojaRetorno(movs) }),
    merma: () => ({ nombre: 'Merma', data: hojaMerma(routers, movs) }),
    cierre_mes: () => ({ nombre: 'Cierre del mes', data: [] }),
  };

  tipos.forEach(t => {
    if (t === 'cierre_mes') {
      // Hoja 1: Nuevos en oficina
      const nuevos = routers.filter(r =>
        r.estado === 'nuevo' && r.ubicacion === 'oficina' && r.agencia === agencia
      );
      const wsNuevos = XLSX.utils.json_to_sheet(nuevos.map(r => ({
        SERIAL: r.serial,
        LOTE: r.lote ?? '',
        TIPO: TIPO_LABEL[r.tipo],
        FABRICANTE: r.fabricante ?? '',
        TECNOLOGIA: r.tecnologia ?? '',
        FECHA_INGRESO: fmt(r.fechaIngreso),
        AGENCIA: AGENCIA_LABEL[r.agencia],
      })));
      const rangoN = XLSX.utils.decode_range(wsNuevos['!ref'] ?? 'A1');
      wsNuevos['!autofilter'] = { ref: XLSX.utils.encode_range(rangoN) };
      XLSX.utils.book_append_sheet(wb, wsNuevos, 'Nuevos en oficina');

      // Hoja 2: Óptimos en oficina
      const optimos = routers.filter(r =>
        r.estado === 'optimo' && r.ubicacion === 'oficina' && r.agencia === agencia
      );
      const wsOptimos = XLSX.utils.json_to_sheet(optimos.map(r => ({
        SERIAL: r.serial,
        TIPO: TIPO_LABEL[r.tipo],
        FABRICANTE: r.fabricante ?? '',
        TECNOLOGIA: r.tecnologia ?? '',
        FECHA_REGISTRO: fmt(r.actualizadoEn),
        AGENCIA: AGENCIA_LABEL[r.agencia],
      })));
      const rangoO = XLSX.utils.decode_range(wsOptimos['!ref'] ?? 'A1');
      wsOptimos['!autofilter'] = { ref: XLSX.utils.encode_range(rangoO) };
      XLSX.utils.book_append_sheet(wb, wsOptimos, 'Óptimos en oficina');
      return;
    }

    const { nombre, data } = construcciones[t]();
    const ws = XLSX.utils.json_to_sheet(data);
    const rango = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    ws['!autofilter'] = { ref: XLSX.utils.encode_range(rango) };
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  });

  const fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `Inventario_${AGENCIA_LABEL[agencia]}_${fecha}.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
}