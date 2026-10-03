import { abrirModal } from './modal-base';

export function abrirImportModal(
  onImportar: (file: File) => Promise<void>,
): void {
  const form = document.createElement('div');

  const info = document.createElement('p');
  info.style.cssText = 'font-size:10px;color:#666;margin-bottom:8px;';
  info.textContent = 'Sube un .xlsx con hojas NUEVOS, OPTIMOS y/o REVISADOS. Los seriales existentes se ignoran.';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.style.cssText = 'font-size:11px;width:100%;';

  form.append(info, input);

  const cerrar = abrirModal({
    titulo: 'Importar Excel',
    contenido: form,
    textoAceptar: 'Importar',
    onAceptar: async () => {
      if (!input.files || input.files.length === 0) {
        alert('Selecciona un archivo');
        return;
      }
      await onImportar(input.files[0]);
      cerrar();
    },
  });
}