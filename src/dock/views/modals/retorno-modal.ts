// src/dock/views/modals/retorno-modal.ts
import type { TipoRouter } from '../../../domain/entities/router';
import { TECNICOS } from '../../../domain/entities/tecnicos';
import { abrirModal, campo } from './modal-base';
import { detectarFabricante } from './fabricante-detector';

export interface RetornoModalResult {
  serial: string;
  tipo: TipoRouter;
  fabricante?: string;
  cliente: string;
  tecnico: string;
  motivo: string;
  destino: 'optimo' | 'a_revisar';
}

export function abrirRetornoModal(
  destinoInicial: 'optimo' | 'a_revisar',
  onSubmit: (data: RetornoModalResult) => Promise<void>,
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

  const inputCliente = document.createElement('input');
  inputCliente.type = 'text';
  inputCliente.placeholder = 'Cliente donde estaba instalado';

  const selectTecnico = document.createElement('select');
  selectTecnico.append(...TECNICOS.map(t => new Option(t, t)));

  const selectMotivo = document.createElement('select');
  selectMotivo.append(
    new Option('Avería', 'Avería'),
    new Option('Cambio de plan', 'Cambio de plan'),
    new Option('Recogido', 'Recogido'),
  );

  const selectDestino = document.createElement('select');
  selectDestino.append(
    new Option('Óptimo', 'optimo'),
    new Option('A revisar', 'a_revisar'),
  );
  selectDestino.value = destinoInicial;

  form.append(
    campo('Serial *', inputSerial),
    campo('Tipo *', selectTipo),
    campo('Fabricante', inputFabricante),
    campo('Cliente *', inputCliente),
    campo('Técnico *', selectTecnico),
    campo('Motivo *', selectMotivo),
    campo('Destino *', selectDestino),
  );

  inputSerial.addEventListener('input', () => {
    const detectado = detectarFabricante(inputSerial.value);
    if (detectado) inputFabricante.value = detectado;
  });

  const cerrar = abrirModal({
    titulo: 'Registrar retorno',
    contenido: form,
    textoAceptar: 'Registrar',
    onAceptar: async () => {
      const serial = inputSerial.value.trim();
      const cliente = inputCliente.value.trim();
      if (!serial) { alert('Serial requerido'); return; }
      if (!cliente) { alert('Cliente requerido'); return; }

      await onSubmit({
        serial,
        tipo: selectTipo.value as TipoRouter,
        fabricante: inputFabricante.value.trim() || undefined,
        cliente,
        tecnico: selectTecnico.value,
        motivo: selectMotivo.value,
        destino: selectDestino.value as 'optimo' | 'a_revisar',
      });

      cerrar();
    },
  });

  inputSerial.focus();
}