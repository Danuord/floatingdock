// src/dock/views/modals/nuevo-modal.ts
import type { TipoRouter } from '../../../domain/entities/router';
import { abrirModal, campo } from './modal-base';
import { detectarFabricante } from './fabricante-detector';

// ── Configuración manual ───────────────────────────────
// Añade aquí prefijos según necesites. La clave es el
// inicio del serial en MAYÚSCULAS, el valor es el nombre
// que se pondrá automáticamente en "Fabricante".

const STORAGE_KEY = 'nuevo-modal-last';

interface LastValues {
  tipo: TipoRouter;
  tecnologia: string;
  lote: string;
}

export interface NuevoModalResult {
  serial: string;
  tipo: TipoRouter;
  fabricante?: string;
  tecnologia?: string;
  lote?: string;
}

export function abrirNuevoModal(
  onSubmit: (data: NuevoModalResult) => Promise<void>,
): void {
  const form = document.createElement('div');

  const inputSerial = document.createElement('input');
  inputSerial.type = 'text';
  inputSerial.placeholder = 'Ej: OPTI597C8779';

  const selectTipo = document.createElement('select');
  selectTipo.append(
    new Option('Duo', 'duo'),
    new Option('Internet', 'internet'),
    new Option('Cable', 'cable'),
  );

  const inputFabricante = document.createElement('input');
  inputFabricante.type = 'text';
  inputFabricante.placeholder = 'Optictimes, ZTE, Huawei...';

  const selectTecnologia = document.createElement('select');
  selectTecnologia.append(
    new Option('WiFi 5', 'WiFi 5'),
    new Option('WiFi 6', 'WiFi 6'),
  );

  const inputLote = document.createElement('input');
  inputLote.type = 'text';
  inputLote.placeholder = 'Ej: 009';

  form.append(
    campo('Serial *', inputSerial),
    campo('Tipo *', selectTipo),
    campo('Fabricante', inputFabricante),
    campo('Tecnología', selectTecnologia),
    campo('Lote', inputLote),
  );

  // Cargar valores previos
  chrome.storage.local.get(STORAGE_KEY).then((data) => {
    const last = data[STORAGE_KEY] as LastValues | undefined;
    if (!last) return;
    selectTipo.value = last.tipo ?? 'duo';
    selectTecnologia.value = last.tecnologia ?? 'WiFi 5';
    inputLote.value = last.lote ?? '';
  });

  // Auto-detectar fabricante al escribir/pegar serial
  inputSerial.addEventListener('input', () => {
    const detectado = detectarFabricante(inputSerial.value);
    if (detectado) inputFabricante.value = detectado;
  });

  const cerrar = abrirModal({
    titulo: 'Agregar router nuevo',
    contenido: form,
    textoAceptar: 'Guardar',
    onAceptar: async () => {
      const serial = inputSerial.value.trim();
      if (!serial) { alert('Serial requerido'); return; }

      const tipo = selectTipo.value as TipoRouter;
      const tecnologia = selectTecnologia.value;
      const lote = inputLote.value.trim();

      // Guardar valores para la próxima vez
      await chrome.storage.local.set({
        [STORAGE_KEY]: { tipo, tecnologia, lote } satisfies LastValues,
      });

      await onSubmit({
        serial,
        tipo,
        fabricante: inputFabricante.value.trim() || undefined,
        tecnologia: tecnologia || undefined,
        lote: lote || undefined,
      });

      cerrar();
    },
  });

  inputSerial.focus();
}