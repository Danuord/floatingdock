import { abrirModal, campo } from './modal-base';
import { TECNICOS } from '../../../domain/entities/tecnicos';

export interface FiltrosAplicados {
  lote?: string;
  tipo?: string;
  tecnico?: string;
  agencia?: string;
  tecnologia?: string;
  fechaIngreso?: string;
  fechaSalida?: string;
  fechaRevision?: string;
  resultado?: string;
}

export type CampoFiltro =
  | 'lote' | 'tipo' | 'tecnico' | 'agencia' | 'tecnologia'
  | 'fechaIngreso' | 'fechaSalida' | 'fechaRevision' | 'resultado';

export interface OpcionFiltro {
  campo: CampoFiltro;
  label: string;
  tipo: 'texto' | 'select' | 'fecha';
  opciones?: string[];
}

export function abrirFiltrosModal(
  campos: OpcionFiltro[],
  actuales: FiltrosAplicados,
  onAplicar: (filtros: FiltrosAplicados) => void,
): void {
  const form = document.createElement('div');
  const inputs: Partial<Record<CampoFiltro, HTMLInputElement | HTMLSelectElement>> = {};

  campos.forEach(c => {
    let input: HTMLInputElement | HTMLSelectElement;

    if (c.tipo === 'select') {
      input = document.createElement('select');
      const vacio = new Option('— Cualquiera —', '');
      input.append(vacio);
      (c.opciones ?? []).forEach(o => input.append(new Option(o, o)));
      input.value = (actuales[c.campo] as string) ?? '';
    } else if (c.tipo === 'fecha') {
      input = document.createElement('input');
      input.type = 'date';
      input.value = (actuales[c.campo] as string) ?? '';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Escribir...';
      input.value = (actuales[c.campo] as string) ?? '';
    }

    inputs[c.campo] = input;
    form.append(campo(c.label, input));
  });

    const cerrar = abrirModal({
    titulo: 'Filtros',
    contenido: form,
    textoAceptar: 'Aplicar',
    textoCancelar: 'Limpiar',
    onAceptar: () => {
      const nuevos: FiltrosAplicados = {};
      Object.entries(inputs).forEach(([k, el]) => {
        const v = (el as HTMLInputElement).value.trim();
        if (v) (nuevos as any)[k] = v;
      });
      onAplicar(nuevos);
      cerrar();
    },
  });
}