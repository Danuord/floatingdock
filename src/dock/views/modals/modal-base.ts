// src/dock/views/modals/modal-base.ts

export interface ModalOptions {
  titulo: string;
  contenido: HTMLElement;
  onAceptar?: () => void | Promise<void>;
  textoAceptar?: string;
  textoCancelar?: string;
  ocultarFooter?: boolean;
}

export function abrirModal(opts: ModalOptions): () => void {
  const root = document.getElementById('modal-root')!;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  // Header
  const header = document.createElement('div');
  header.className = 'modal-header';
  const h3 = document.createElement('h3');
  h3.textContent = opts.titulo;
  const btnClose = document.createElement('button');
  btnClose.className = 'modal-close';
  btnClose.textContent = '×';
  btnClose.type = 'button';
  header.append(h3, btnClose);

  // Body
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.append(opts.contenido);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const cerrar = () => overlay.remove();

  if (!opts.ocultarFooter) {
    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'btn-secondary';
    btnCancelar.textContent = opts.textoCancelar ?? 'Cancelar';
    btnCancelar.addEventListener('click', cerrar);

    const btnAceptar = document.createElement('button');
    btnAceptar.type = 'button';
    btnAceptar.className = 'btn-primary';
    btnAceptar.textContent = opts.textoAceptar ?? 'Guardar';
    btnAceptar.addEventListener('click', async () => {
      if (btnAceptar.disabled) return;
      btnAceptar.disabled = true;
      btnAceptar.textContent = 'Guardando...';
      try {
        if (opts.onAceptar) await opts.onAceptar();
      } finally {
        btnAceptar.disabled = false;
        btnAceptar.textContent = opts.textoAceptar ?? 'Guardar';
      }
    });

    footer.append(btnCancelar, btnAceptar);
  }

  modal.append(header, body, footer);
  overlay.append(modal);
  root.append(overlay);

  btnClose.addEventListener('click', cerrar);

  return cerrar;
}

/** Helper para construir un campo label+input */
export function campo(
  label: string,
  input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): HTMLDivElement {
  const fila = document.createElement('div');
  fila.className = 'fila';
  const lbl = document.createElement('label');
  lbl.textContent = label;
  fila.append(lbl, input);
  return fila;
}