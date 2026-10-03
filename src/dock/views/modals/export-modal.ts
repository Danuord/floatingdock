import { abrirModal } from './modal-base';
import type { Agencia } from '../../../domain/entities/router';

export type ExportTipo =
  | 'general' | 'nuevos' | 'optimos' | 'revisados' | 'retorno' | 'merma'
  | 'cierre_mes';

export function abrirExportModal(
  agencia: Agencia,
  onExportar: (tipos: ExportTipo[]) => Promise<void>,
): void {
  const form = document.createElement('div');

  const opcionesParaiso: { id: ExportTipo; label: string; rol: 'general' | 'especifico' | 'cierre' }[] = [
    { id: 'cierre_mes', label: 'Cierre del mes (solo oficina)', rol: 'cierre' },
    { id: 'general', label: 'General (todas las categorías)', rol: 'general' },
    { id: 'nuevos', label: 'Nuevos', rol: 'especifico' },
    { id: 'optimos', label: 'Óptimos', rol: 'especifico' },
    { id: 'revisados', label: 'Revisados', rol: 'especifico' },
    { id: 'retorno', label: 'Retorno', rol: 'especifico' },
    { id: 'merma', label: 'Merma', rol: 'especifico' },
  ];

  const opcionesLomas: { id: ExportTipo; label: string; rol: 'general' | 'especifico' | 'cierre' }[] = [
    { id: 'cierre_mes', label: 'Cierre del mes (solo oficina)', rol: 'cierre' },
    { id: 'general', label: 'General', rol: 'general' },
    { id: 'nuevos', label: 'Nuevos', rol: 'especifico' },
    { id: 'optimos', label: 'Óptimos', rol: 'especifico' },
  ];

  const opciones = agencia === 'lomas' ? opcionesLomas : opcionesParaiso;
  const checkboxes: HTMLInputElement[] = [];

  opciones.forEach(op => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px;cursor:pointer;';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = op.id;
    cb.dataset.rol = op.rol;
    checkboxes.push(cb);
    label.append(cb, document.createTextNode(op.label));
    form.append(label);
  });

  const generalCb = checkboxes.find(c => c.dataset.rol === 'general')!;
  const cierreCb = checkboxes.find(c => c.dataset.rol === 'cierre')!;
  const especificos = checkboxes.filter(c => c.dataset.rol === 'especifico');

  generalCb.addEventListener('change', () => {
    if (generalCb.checked) {
      cierreCb.checked = false;
      especificos.forEach(c => { c.disabled = true; c.checked = false; });
    } else {
      especificos.forEach(c => { c.disabled = false; });
    }
  });

  cierreCb.addEventListener('change', () => {
    if (cierreCb.checked) {
      generalCb.checked = false;
      especificos.forEach(c => { c.disabled = true; c.checked = false; });
    } else {
      especificos.forEach(c => { c.disabled = false; });
    }
  });

  especificos.forEach(c => {
    c.addEventListener('change', () => {
      if (c.checked) {
        generalCb.checked = false;
        cierreCb.checked = false;
      }
    });
  });

  const cerrar = abrirModal({
    titulo: 'Exportar inventario',
    contenido: form,
    textoAceptar: 'Descargar',
    onAceptar: async () => {
      const seleccionados: ExportTipo[] = [];
      if (cierreCb.checked) {
        seleccionados.push('cierre_mes');
      } else if (generalCb.checked) {
        seleccionados.push('general');
      } else {
        checkboxes.forEach(c => {
          if (c.checked && c.dataset.rol === 'especifico') {
            seleccionados.push(c.value as ExportTipo);
          }
        });
      }

      if (seleccionados.length === 0) {
        alert('Selecciona al menos una opción');
        return;
      }

      await onExportar(seleccionados);
      cerrar();
    },
  });
}