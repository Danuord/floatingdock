import * as XLSX from 'xlsx';
import type { Router, Agencia, TipoRouter } from '../entities/router';
import type { Movimiento } from '../entities/movimiento';
import { detectarFabricante } from '../../dock/views/modals/fabricante-detector';

export interface ImportPayload {
  routers: Router[];
  movimientos: Movimiento[];
  errores: string[];
  duplicados: string[];
}

function norm(v: any): string { return String(v ?? '').trim(); }

function parseTipo(v: any): TipoRouter | null {
  const s = norm(v).toLowerCase();
  if (s === 'duo') return 'duo';
  if (s === 'internet') return 'internet';
  if (s === 'cable') return 'cable';
  return null;
}

function parseFecha(v: any): number | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const [dd, mm, yyyy] = v.split('/');
    if (dd && mm && yyyy) {
      const t = new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
      if (!isNaN(t)) return t;
    }
    const t = Date.parse(v);
    if (!isNaN(t)) return t;
  }
  return undefined;
}

function leerHoja(wb: XLSX.WorkBook, nombre: string): Record<string, any>[] {
  const sheet = wb.Sheets[nombre];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });
  if (raw.length < 2) return [];
  const headers = (raw[0] as any[]).map(h => String(h ?? '').trim().toUpperCase());
  return raw.slice(1).map(row => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => { obj[h] = (row as any[])[i]; });
    return obj;
  });
}

export function parseExcel(file: File, agencia: Agencia): Promise<ImportPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { cellDates: true });
        const routers: Router[] = [];
        const movimientos: Movimiento[] = [];
        const errores: string[] = [];
        const duplicados: string[] = [];
        const ahora = Date.now();
        const serialesVistos = new Set<string>();

        const checkSerial = (serial: string, hoja: string, fila: number): boolean => {
          if (!serial) {
            errores.push(`${hoja} fila ${fila}: serial vacío`);
            return false;
          }
          if (serialesVistos.has(serial)) {
            duplicados.push(`${hoja} fila ${fila}: ${serial} duplicado en el Excel`);
            return false;
          }
          serialesVistos.add(serial);
          return true;
        };

        // ─── NUEVOS ───
        if (wb.Sheets['NUEVOS']) {
          const filas = leerHoja(wb, 'NUEVOS');
          filas.forEach((f, idx) => {
            const fila = idx + 2;
            const serial = norm(f.SERIAL);
            if (!checkSerial(serial, 'NUEVOS', fila)) return;
            const tipo = parseTipo(f.TIPO);
            if (!tipo) { errores.push(`NUEVOS ${serial}: tipo inválido`); return; }
            const fechaIng = parseFecha(f.FECHA_INGRESO);
            if (!fechaIng) { errores.push(`NUEVOS ${serial}: FECHA_INGRESO inválida`); return; }

            const fechaSalida = parseFecha(f.FECHA_SALIDA);
            const cliente = norm(f.CLIENTE_ACTUAL) || undefined;
            const tecnico = norm(f.TECNICO) || undefined;
            const servicio = norm(f.SERVICIO) || undefined;
            const agenteSalida = norm(f.AGENTE_SALIDA) || 'importacion';

            routers.push({
              id: crypto.randomUUID(), serial, tipo,
              estado: 'nuevo',
              ubicacion: fechaSalida ? 'campo' : 'oficina',
              agencia,
              fabricante: norm(f.FABRICANTE) || detectarFabricante(serial) || undefined,
              tecnologia: norm(f.TECNOLOGIA) || undefined,
              lote: norm(f.LOTE) || undefined,
              fechaIngreso: fechaIng,
              clienteActual: cliente,
              tecnicoActual: tecnico,
              creadoEn: ahora, actualizadoEn: ahora,
            });
            movimientos.push({
              id: crypto.randomUUID(), tipo: 'registro_nuevo',
              routerSerial: serial, routerTipo: tipo, agencia,
              fecha: fechaIng, usuario: agenteSalida,
            });
            if (fechaSalida) {
              movimientos.push({
                id: crypto.randomUUID(), tipo: 'salida',
                routerSerial: serial, routerTipo: tipo, agencia,
                fecha: fechaSalida, usuario: agenteSalida,
                tecnico, cliente, motivo: servicio,
              });
            }
          });
        }

        // ─── OPTIMOS ───
        if (wb.Sheets['OPTIMOS']) {
          const filas = leerHoja(wb, 'OPTIMOS');
          filas.forEach((f, idx) => {
            const fila = idx + 2;
            const serial = norm(f.SERIAL);
            if (!checkSerial(serial, 'OPTIMOS', fila)) return;
            const tipo = parseTipo(f.TIPO);
            if (!tipo) { errores.push(`OPTIMOS ${serial}: tipo inválido`); return; }
            const fechaReg = parseFecha(f.FECHA_REGISTRO);
            if (!fechaReg) { errores.push(`OPTIMOS ${serial}: FECHA_REGISTRO inválida`); return; }

            const fechaSalida = parseFecha(f.FECHA_SALIDA);
            const cliente = norm(f.CLIENTE_ACTUAL) || undefined;
            const tecnico = norm(f.TECNICO) || undefined;
            const servicio = norm(f.SERVICIO) || undefined;
            const agenteSalida = norm(f.AGENTE_SALIDA) || 'importacion';

            routers.push({
              id: crypto.randomUUID(), serial, tipo,
              estado: 'optimo',
              ubicacion: fechaSalida ? 'campo' : 'oficina',
              agencia,
              fabricante: norm(f.FABRICANTE) || detectarFabricante(serial) || undefined,
              tecnologia: norm(f.TECNOLOGIA) || undefined,
              lote: norm(f.LOTE) || undefined,
              fechaIngreso: fechaReg,
              clienteActual: cliente,
              tecnicoActual: tecnico,
              creadoEn: ahora, actualizadoEn: ahora,
            });
            movimientos.push({
              id: crypto.randomUUID(), tipo: 'importacion_optimo',
              routerSerial: serial, routerTipo: tipo, agencia,
              fecha: fechaReg, usuario: agenteSalida,
              resultado: 'optimo',
            });
            if (fechaSalida) {
              movimientos.push({
                id: crypto.randomUUID(), tipo: 'salida',
                routerSerial: serial, routerTipo: tipo, agencia,
                fecha: fechaSalida, usuario: agenteSalida,
                tecnico, cliente, motivo: servicio,
              });
            }
          });
        }

        // ─── REVISADOS ───
        if (wb.Sheets['REVISADOS']) {
          const filas = leerHoja(wb, 'REVISADOS');
          filas.forEach((f, idx) => {
            const fila = idx + 2;
            const serial = norm(f.SERIAL);
            if (!serial) { errores.push(`REVISADOS fila ${fila}: serial vacío`); return; }

            const enOtraHoja = serialesVistos.has(serial);
            if (enOtraHoja) {
              duplicados.push(`REVISADOS fila ${fila}: ${serial} ya en otra hoja (solo movimientos)`);
            }

            const tipo = parseTipo(f.TIPO);
            if (!tipo) { errores.push(`REVISADOS ${serial}: tipo inválido`); return; }

            const estadoStr = norm(f.ESTADO).toLowerCase();
            const esMerma = estadoStr === 'merma' || estadoStr === 'dañado';
            const fechaRetorno = parseFecha(f.FECHA_RETORNO);
            const fechaRev = parseFecha(f.FECHA_REVISION);
            const tecnico = norm(f.TECNICO) || undefined;
            const agenteRegistro = norm(f.AGENTE_REGISTRO) || 'importacion';
            const agente = norm(f.AGENTE) || 'importacion';
            const detalle = norm(f.DETALLE) || undefined;
            const cliente = norm(f.CLIENTE_ACTUAL) || undefined;
            const motivoRetorno = norm(f.MOTIVO_RETORNO) || undefined;

            const yaRevisado = !!fechaRev;
            const estadoFinal = !yaRevisado
              ? 'en_revision' as const
              : (esMerma ? 'dañado' as const : 'optimo' as const);

            if (!enOtraHoja) {
              serialesVistos.add(serial);
              routers.push({
                id: crypto.randomUUID(), serial, tipo,
                estado: estadoFinal,
                ubicacion: 'oficina', agencia,
                fabricante: norm(f.FABRICANTE) || detectarFabricante(serial) || undefined,
                tecnologia: norm(f.TECNOLOGIA) || undefined,
                lote: norm(f.LOTE) || undefined,
                fechaIngreso: fechaRetorno ?? fechaRev ?? ahora,
                clienteActual: undefined,
                tecnicoActual: undefined,
                creadoEn: ahora, actualizadoEn: ahora,
              });
            }

            if (fechaRetorno) {
              movimientos.push({
                id: crypto.randomUUID(), tipo: 'retorno',
                routerSerial: serial, routerTipo: tipo, agencia,
                fecha: fechaRetorno, usuario: agenteRegistro,
                tecnico, cliente, motivo: motivoRetorno ?? 'Importación',
              });
            }
            if (fechaRev) {
              movimientos.push({
                id: crypto.randomUUID(),
                tipo: esMerma ? 'merma' : 'revision',
                routerSerial: serial, routerTipo: tipo, agencia,
                fecha: fechaRev, usuario: agente,
                detalle, resultado: esMerma ? 'merma' : 'optimo',
                cliente, tecnico,
              });
            }
          });
        }

        resolve({ routers, movimientos, errores, duplicados });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}