// src/dock/views/modals/cliente-modal.ts
import { abrirModal, campo } from './modal-base';

export interface ClienteModalResult {
  cliente: string;
  motivo: string;
}

export function abrirClienteModal(
  clienteInicial: string | undefined,
  onSubmit: (data: ClienteModalResult) => Promise<void>,
): void {
  const form = document.createElement('div');

  const inputCliente = document.createElement('input');
  inputCliente.type = 'text';
  inputCliente.placeholder = 'Nombre del cliente';
  inputCliente.value = clienteInicial ?? '';

  const selectMotivo = document.createElement('select');
  selectMotivo.append(
    new Option('Instalación', 'Instalación'),
    new Option('Avería', 'Avería'),
  );

  form.append(
    campo('Cliente *', inputCliente),
    campo('Motivo *', selectMotivo),
  );

  const cerrar = abrirModal({
    titulo: 'Asignar cliente',
    contenido: form,
    textoAceptar: 'Guardar',
    onAceptar: async () => {
      const cliente = inputCliente.value.trim();
      if (!cliente) { alert('Cliente requerido'); return; }

      await onSubmit({
        cliente,
        motivo: selectMotivo.value,
      });

      cerrar();
    },
  });

  inputCliente.focus();
}