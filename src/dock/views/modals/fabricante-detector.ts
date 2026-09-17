// src/dock/views/modals/fabricante-detector.ts

// Añade aquí prefijos según necesites.
// La clave es el inicio del serial en MAYÚSCULAS.
export const PREFIJOS_FABRICANTE: Record<string, string> = {
  OPTI: 'OPTICTIMES',
  ZTE: 'ZTE',
  HW: 'HUAWEI',
  YYK: 'ZTE',
  ZXI: 'ZTE',
  OEMT: 'FIBERTRONIC',
  FHT: 'PHYHOME',
  DC: 'DATA',
  XPON: 'XPON',
  TP: 'TP-LINK',
  GPON: 'GPON',
};

export function detectarFabricante(serial: string): string {
  const s = serial.trim().toUpperCase();
  for (const prefijo of Object.keys(PREFIJOS_FABRICANTE)) {
    if (s.startsWith(prefijo)) return PREFIJOS_FABRICANTE[prefijo];
  }
  return '';
}