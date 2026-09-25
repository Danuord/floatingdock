import { abrirModal } from './modal-base';
import type { Agencia } from '../../../domain/entities/router';

export type ExportTipo = 'general' | 'nuevos' | 'optimos' | 'revisados' | 'retorno' | 'merma';

export function abrirExportModal(
  agencia: Agencia,
  onExportar: (tipos: ExportTipo[]) => Promise<void>,
): void {
  const form = document.createElement('div');

  const opcionesParaiso: { id: ExportTipo; label: string }[] = [
    { id: 'general', label: 'General (todas las categorías)' },
    { id: 'nuevos', label: 'Nuevos' },
    { id: 'optimos', label: 'Óptimos' },
    { id: 'revisados', label: 'Revisados' },
    { id: 'retorno', label: 'Retorno' },
    { id: 'merma', label: 'Merma' },
  ];

  const opcionesLomas: { id: ExportTipo; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'nuevos', label: 'Nuevos' },
    { id: 'optimos', label: 'Óptimos' },
  ];

  const opciones = agencia === 'lomas' ? opcionesLomas : opcionesParaiso;
  const checkboxes: HTMLInputElement[] = [];

  opciones.forEach(op => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px;cursor:pointer;';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = op.id;
    cb.dataset.rol = op.id === 'general' ? 'general' : 'especifico';
    checkboxes.push(cb);
    label.append(cb, document.createTextNode(op.label));
    form.append(label);
  });

  // General desactiva los específicos
  const generalCb = checkboxes.find(c => c.dataset.rol === 'general')!;
  const especificos = checkboxes.filter(c => c.dataset.rol === 'especifico');

  generalCb.addEventListener('change', () => {
    especificos.forEach(c => {
      c.disabled = generalCb.checked;
      if (generalCb.checked) c.checked = false;
    });
  });

  especificos.forEach(c => {
    c.addEventListener('change', () => {
      if (c.checked) generalCb.checked = false;
    });
  });

  const cerrar = abrirModal({
    titulo: 'Exportar inventario',
    contenido: form,
    textoAceptar: 'Descargar',
    onAceptar: async () => {
      const seleccionados: ExportTipo[] = [];
      if (generalCb.checked) {
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