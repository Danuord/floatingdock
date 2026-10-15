// src/dock/views/modals/retorno-modal.ts
import type { TipoRouter } from '../../../domain/entities/router';
import { TECNICOS } from '../../../domain/entities/tecnicos';
import { abrirModal, campo } from './modal-base';
import { detectarFabricante } from './fabricante-detector';

export interface RetornoModalResult {
  serial: string;
  tipo: TipoRouter;
  fabricante?: string;
  cliente?: string;
  tecnico?: string;
  motivo?: string;
  destino: 'optimo' | 'a_revisar' | 'segunda';
  esAgente?: boolean;
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
    new Option('Router de segunda', 'segunda'),
  );
  selectDestino.value = destinoInicial;

  // Campos opcionales en modo "Agente"
  const filaCliente = campo('Cliente *', inputCliente);
  const filaTecnico = campo('Técnico *', selectTecnico);
  const filaMotivo = campo('Motivo *', selectMotivo);

  // Checkbox "Agente"
  const checkWrapper = document.createElement('label');
  checkWrapper.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 0 4px;font-size:12px;cursor:pointer;border-top:1px solid #eee;margin-top:8px;';
  const checkAgente = document.createElement('input');
  checkAgente.type = 'checkbox';
  checkWrapper.append(checkAgente, document.createTextNode('Agente'));

  form.append(
    campo('Serial *', inputSerial),
    campo('Tipo *', selectTipo),
    campo('Fabricante', inputFabricante),
    filaCliente,
    filaTecnico,
    filaMotivo,
    campo('Destino *', selectDestino),
    checkWrapper,
  );

  checkAgente.addEventListener('change', () => {
    const esAgente = checkAgente.checked;
    filaCliente.hidden = esAgente;
    filaTecnico.hidden = esAgente;
    filaMotivo.hidden = esAgente;
  });

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
      if (!serial) { alert('Serial requerido'); return; }

      const esAgente = checkAgente.checked;
      const cliente = inputCliente.value.trim();
      if (!esAgente && !cliente) { alert('Cliente requerido'); return; }

      await onSubmit({
        serial,
        tipo: selectTipo.value as TipoRouter,
        fabricante: inputFabricante.value.trim() || undefined,
        cliente: esAgente ? undefined : cliente,
        tecnico: esAgente ? undefined : selectTecnico.value,
        motivo: esAgente ? undefined : selectMotivo.value,
        destino: selectDestino.value as 'optimo' | 'a_revisar' | 'segunda',
        esAgente,
      });

      cerrar();
    },
  });

  inputSerial.focus();
}