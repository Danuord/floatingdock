// src/dock/dock.ts
import type { Router, TipoRouter, EstadoRouter } from '../domain/entities/router';
import { TECNICOS, USUARIOS } from '../domain/entities/tecnicos';
import { ChromeRouterRepository } from '../infrastructure/storage/chrome-router-repository';
import { ChromeMovimientoRepository } from '../infrastructure/storage/chrome-movimiento-repository';
import { RouterService } from '../domain/services/router-service';
import { calcularStockPorTipo, calcularEnRevision, type StockPorTipo } from '../domain/services/stock-calculator';
import { abrirNuevoModal } from './views/modals/nuevo-modal';
import { abrirRetornoModal } from './views/modals/retorno-modal';
import { Movimiento } from '../domain/entities/movimiento';
import { abrirClienteModal } from './views/modals/cliente-modal';
import type { Agencia } from '../domain/entities/router';
import { abrirExportModal } from './views/modals/export-modal';
import { generarExcel } from '../domain/services/export-service';
import { abrirFiltrosModal, type FiltrosAplicados, type OpcionFiltro } from './views/modals/filter-modal';

// ── Instancias ─────────────────────────────────────────
const elAccInfo = document.querySelector<HTMLDivElement>('#acc-info')!;
const elAccSalida = document.querySelector<HTMLDivElement>('#acc-salida')!;
let lastSelectedSerial: string | null = null;
let filtrosActivos: FiltrosAplicados = {};
let agenciaActual: Agencia = 'paraiso';
let routerRepo = new ChromeRouterRepository(agenciaActual);
let movRepo = new ChromeMovimientoRepository(agenciaActual);
const service = new RouterService(
  { getAll: () => routerRepo.getAll(), getBySerial: s => routerRepo.getBySerial(s), save: r => routerRepo.save(r), delete: id => routerRepo.delete(id) },
  { getAll: () => movRepo.getAll(), getBySerial: s => movRepo.getBySerial(s), save: m => movRepo.save(m) },
  (a) => new ChromeRouterRepository(a),
  (a) => new ChromeMovimientoRepository(a),
);
const elHistorialRevisiones = document.querySelector<HTMLDivElement>('#historial-revisiones')!;
const elHistorialBody = document.querySelector<HTMLTableSectionElement>('#historial-body')!;
const elHistorialDetalle = document.querySelector<HTMLDivElement>('#historial-detalle')!;
let selectedMovId: string | null = null;
const elPerdidaCable = document.querySelector<HTMLInputElement>('#perdida-cable')!;
const elPerdidaInternet = document.querySelector<HTMLInputElement>('#perdida-internet')!;
const elSalidaMotivo = document.querySelector<HTMLSelectElement>('#salida-motivo')!;
const elFormDesasignar = document.querySelector<HTMLDivElement>('#form-desasignar')!;
const elBtnDesasignar = document.querySelector<HTMLButtonElement>('#btn-desasignar')!;
const elAgencia = document.querySelector<HTMLSelectElement>('#agencia-actual')!;
const elBtnFiltros = document.querySelector<HTMLButtonElement>('#btn-filtros')!;
const elBtnFiltrosHist = document.querySelector<HTMLButtonElement>('#btn-filtros-hist')!;
const elChipsFiltrosHist = document.querySelector<HTMLDivElement>('#chips-filtros-hist')!;
const elChipsFiltros = document.querySelector<HTMLDivElement>('#chips-filtros')!;

// ── Estado ─────────────────────────────────────────────
let routers: Router[] = [];
let selectedSerial: string | null = null;
let currentFilter: EstadoRouter = 'nuevo';
let currentSearch = '';
let currentPage = 1;
let pageSize = 10;
let usuarioActual = USUARIOS[0] ?? 'Usuario';

// ── Helpers ────────────────────────────────────────────
function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function getTipoLabel(t: TipoRouter): string {
  return { duo: 'Duo', internet: 'Internet', cable: 'Cable' }[t];
}

function getEstadoLabel(e: EstadoRouter): string {
  return {
    nuevo: 'Nuevo',
    optimo: 'Óptimo',
    en_revision: 'En revisión',
    dañado: 'Dañado',
  }[e];
}

function getUbicacionLabel(u: 'oficina' | 'campo' | null): string {
  if (u === 'oficina') return 'Oficina';
  if (u === 'campo') return 'Campo';
  return '—';
}

function setToday(input: HTMLInputElement) {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  input.value = iso;
}

// ── Elementos ──────────────────────────────────────────
const elPageSize = document.querySelector<HTMLSelectElement>('#page-size')!;
const elHistPageSize = document.querySelector<HTMLSelectElement>('#hist-page-size')!;
const elUsuario = document.querySelector<HTMLSelectElement>('#usuario-actual')!;
const elFiltro = document.querySelector<HTMLSelectElement>('#filtro-estado')!;
const elBtnAgregar = document.querySelector<HTMLButtonElement>('#btn-agregar')!;
const elBuscar = document.querySelector<HTMLInputElement>('#buscar-serial')!;
const elTablaBody = document.querySelector<HTMLTableSectionElement>('#tabla-body')!;
const elContador = document.querySelector<HTMLSpanElement>('#contador')!;
const elPagInfo = document.querySelector<HTMLSpanElement>('#pag-info')!;
const elPagPrev = document.querySelector<HTMLButtonElement>('#pag-prev')!;
const elPagNext = document.querySelector<HTMLButtonElement>('#pag-next')!;
const elDetalleInfo = document.querySelector<HTMLDivElement>('#detalle-info')!;
const elBtnAsignarCliente = document.querySelector<HTMLButtonElement>('#btn-asignar-cliente')!;
const elFormSalida = document.querySelector<HTMLDivElement>('.form-salida')!;
const elSalidaSerial = document.querySelector<HTMLInputElement>('#salida-serial')!;
const elSalidaFecha = document.querySelector<HTMLInputElement>('#salida-fecha')!;
const elSalidaTecnico = document.querySelector<HTMLSelectElement>('#salida-tecnico')!;
const elBtnRegistrarSalida = document.querySelector<HTMLButtonElement>('#btn-registrar-salida')!;
const elFormRevision = document.querySelector<HTMLDivElement>('#detalle-revision')!;
const elRevisionSerial = document.querySelector<HTMLInputElement>('#revision-serial')!;
const elRevisionFecha = document.querySelector<HTMLInputElement>('#revision-fecha')!;
const elRevisionDetalle = document.querySelector<HTMLTextAreaElement>('#revision-detalle')!;
const elBtnRegistrarRevision = document.querySelector<HTMLButtonElement>('#btn-registrar-revision')!;
const elBtnRegistrarMerma = document.querySelector<HTMLButtonElement>('#btn-registrar-merma')!;
const elStockLista = document.querySelector<HTMLDivElement>('#stock-lista')!;
const elBtnExportar = document.querySelector<HTMLButtonElement>('#btn-exportar')!;
const elHistContador = document.querySelector<HTMLSpanElement>('#hist-contador')!;
const elHistPagInfo = document.querySelector<HTMLSpanElement>('#hist-pag-info')!;
const elHistPagPrev = document.querySelector<HTMLButtonElement>('#hist-pag-prev')!;
const elHistPagNext = document.querySelector<HTMLButtonElement>('#hist-pag-next')!;
let histPage = 1;
let histTotal = 0;
let histPageSize = 10;
const elBarraMultiple = document.querySelector<HTMLDivElement>('#barra-multiple')!;
const elMultiContador = document.querySelector<HTMLSpanElement>('#multi-contador')!;
const elBtnEnviarLomasMulti = document.querySelector<HTMLButtonElement>('#btn-enviar-lomas-multi')!;
const elBtnLimpiarMulti = document.querySelector<HTMLButtonElement>('#btn-limpiar-multi')!;
const elCheckAll = document.querySelector<HTMLInputElement>('#check-all')!;
let seleccionMultiple = new Set<string>();
let filtrosHist: FiltrosAplicados = {};

// ── Inicialización ─────────────────────────────────────
async function init() {
  // 1. Configurar UI (dropdowns, listeners) sin esperar red
  elUsuario.replaceChildren(...USUARIOS.map(u => new Option(u, u)));
  elUsuario.value = usuarioActual;
  elUsuario.addEventListener('change', () => { usuarioActual = elUsuario.value; });

  elAgencia.value = agenciaActual;
  elAgencia.addEventListener('change', async () => {
    agenciaActual = elAgencia.value as Agencia;
    routerRepo = new ChromeRouterRepository(agenciaActual);
    movRepo = new ChromeMovimientoRepository(agenciaActual);
    selectedSerial = null;
    selectedMovId = null;
    seleccionMultiple.clear();
    actualizarOpcionesFiltro();   // ← nueva
    actualizarBotonAgregar();      // ← por si acaso
    await refresh();
    void sincronizarConSheets();
  });

  document.querySelectorAll<HTMLButtonElement>('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const acc = btn.closest('.accordion');
      acc?.classList.toggle('abierto');
    });
  });

  elSalidaTecnico.replaceChildren(...TECNICOS.map(t => new Option(t, t)));
  setToday(elSalidaFecha);
  setToday(elRevisionFecha);

  elFiltro.addEventListener('change', () => {
    currentFilter = elFiltro.value as EstadoRouter;
    currentPage = 1;
    selectedSerial = null;
    histPage = 1;
    selectedMovId = null;
    actualizarBotonAgregar();
    refresh();
    seleccionMultiple.clear();
  });

  elBuscar.addEventListener('input', () => {
    currentSearch = elBuscar.value.trim().toLowerCase();
    currentPage = 1;
    renderTabla();
  });

  elPagPrev.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderTabla(); }
  });
  elPagNext.addEventListener('click', () => {
    const total = filteredRouters().length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage < totalPages) { currentPage++; renderTabla(); }
  });

  elPageSize.value = String(pageSize);
  elPageSize.addEventListener('change', () => {
    pageSize = Number(elPageSize.value);
    currentPage = 1;
    renderTabla();
  });

  elHistPageSize.value = String(histPageSize);
  elHistPageSize.addEventListener('change', () => {
    histPageSize = Number(elHistPageSize.value);
    histPage = 1;
    void renderHistorialRevisiones();
  });

  elHistPagPrev.addEventListener('click', () => {
    if (histPage > 1) { histPage--; void renderHistorialRevisiones(); }
  });
  elHistPagNext.addEventListener('click', () => {
    const total = Math.max(1, Math.ceil(histTotal / histPageSize));
    if (histPage < total) { histPage++; void renderHistorialRevisiones(); }
  });

  elBtnLimpiarMulti.addEventListener('click', () => {
    seleccionMultiple.clear();
    renderTabla();
  });

  elBtnEnviarLomasMulti.addEventListener('click', enviarLomasMasivo);

  elBtnFiltros.addEventListener('click', () => {
    const campos: OpcionFiltro[] = [
      { campo: 'tipo', label: 'Tipo', tipo: 'select', opciones: ['Duo', 'Internet', 'Cable'] },
      { campo: 'tecnico', label: 'Técnico', tipo: 'select', opciones: TECNICOS },
      { campo: 'tecnologia', label: 'Tecnología', tipo: 'select', opciones: ['WiFi 5', 'WiFi 6'] },
      { campo: 'fechaIngreso', label: 'Fecha ingreso', tipo: 'fecha' },
    ];

    abrirFiltrosModal(campos, filtrosActivos, (nuevos) => {
      filtrosActivos = nuevos;
      actualizarChips();
      renderTabla();
    });
  });

  elBtnFiltrosHist.addEventListener('click', () => {
    const campos: OpcionFiltro[] = [
      { campo: 'tipo', label: 'Tipo', tipo: 'select', opciones: ['Duo', 'Internet', 'Cable'] },
      { campo: 'resultado', label: 'Resultado', tipo: 'select', opciones: ['Revisado', 'Merma'] },
      { campo: 'fechaRevision', label: 'Fecha revisión', tipo: 'fecha' },
    ];

    abrirFiltrosModal(campos, filtrosHist, (nuevos) => {
      filtrosHist = nuevos;
      actualizarChipsHist();
      void renderHistorialRevisiones();
    });
  });

  const LABELS: Record<string, string> = {
    lote: 'Lote',
    tipo: 'Tipo',
    tecnico: 'Técnico',
    agencia: 'Agencia',
    tecnologia: 'Tecnología',
    fechaIngreso: 'Ingreso',
    fechaSalida: 'Salida',
  };

  function actualizarChips() {
    const entradas = Object.entries(filtrosActivos).filter(([, v]) => v);
    if (entradas.length === 0) {
      elChipsFiltros.hidden = true;
      elBtnFiltros.classList.remove('activo');
      return;
    }

    elChipsFiltros.hidden = false;
    elBtnFiltros.classList.add('activo');

    const chips = entradas.map(([k, v]) => {
      const div = document.createElement('div');
      div.className = 'chip';
      div.innerHTML = `${LABELS[k] ?? k}: ${v} <span class="x">×</span>`;
      div.addEventListener('click', () => {
        delete filtrosActivos[k as keyof typeof filtrosActivos];
        actualizarChips();
        renderTabla();
      });
      return div;
    });

    const limpiar = document.createElement('div');
    limpiar.className = 'chip chip-limpiar';
    limpiar.textContent = 'Limpiar todo';
    limpiar.addEventListener('click', () => {
      filtrosActivos = {};
      actualizarChips();
      renderTabla();
    });
    chips.push(limpiar);

    elChipsFiltros.replaceChildren(...chips);
  }

  function actualizarChipsHist() {
    const entradas = Object.entries(filtrosHist).filter(([, v]) => v);
    if (entradas.length === 0) {
      elChipsFiltrosHist.hidden = true;
      elBtnFiltrosHist.classList.remove('activo');
      return;
    }

    elChipsFiltrosHist.hidden = false;
    elBtnFiltrosHist.classList.add('activo');

    const labels: Record<string, string> = {
      tipo: 'Tipo',
      resultado: 'Resultado',
      fechaRevision: 'Fecha',
    };

    const chips = entradas.map(([k, v]) => {
      const div = document.createElement('div');
      div.className = 'chip';
      div.innerHTML = `${labels[k] ?? k}: ${v} <span class="x">×</span>`;
      div.addEventListener('click', () => {
        delete filtrosHist[k as keyof typeof filtrosHist];
        actualizarChipsHist();
        void renderHistorialRevisiones();
      });
      return div;
    });

    const limpiar = document.createElement('div');
    limpiar.className = 'chip chip-limpiar';
    limpiar.textContent = 'Limpiar todo';
    limpiar.addEventListener('click', () => {
      filtrosHist = {};
      actualizarChipsHist();
      void renderHistorialRevisiones();
    });
    chips.push(limpiar);

    elChipsFiltrosHist.replaceChildren(...chips);
  }

  elCheckAll.addEventListener('change', () => {
    const page = paginatedRouters();
    if (elCheckAll.checked) {
      page.forEach(r => seleccionMultiple.add(r.serial));
    } else {
      page.forEach(r => seleccionMultiple.delete(r.serial));
    }
    renderTabla();
  });

  elBtnAgregar.addEventListener('click', agregarRouter);
  elBtnAsignarCliente.addEventListener('click', asignarCliente);
  elBtnRegistrarSalida.addEventListener('click', registrarSalida);
  elBtnDesasignar.addEventListener('click', desasignarTecnico);
  elBtnRegistrarRevision.addEventListener('click', () => registrarRevision('optimo'));
  elBtnRegistrarMerma.addEventListener('click', () => registrarRevision('merma'));
  elBtnExportar.addEventListener('click', () => {
    abrirExportModal(agenciaActual, async (tipos) => {
      const movs = await movRepo.getAll();
      generarExcel(tipos, routers, movs, agenciaActual);
    });
  });

  let refreshTimer: number | null = null;
  function refreshDebounced() {
    if (refreshTimer !== null) clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      void refresh();
    }, 150);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const keyRouters = agenciaActual === 'lomas' ? 'routersLomas' : 'routers';
    const keyMovs = agenciaActual === 'lomas' ? 'movimientosLomas' : 'movimientos';
    if (!changes[keyRouters] && !changes[keyMovs]) return;
    refreshDebounced();
  });

  actualizarOpcionesFiltro();

  // 2. Render inmediato con caché local
  await refresh();

  // 3. Sincronización en segundo plano (no bloquea la UI)
  void sincronizarConSheets();

  setInterval(() => { void sincronizarConSheets(); }, 60_000);
}

async function enviarLomasMasivo() {
  if (seleccionMultiple.size === 0) return;
  const seriales = Array.from(seleccionMultiple);
  if (!confirm(`¿Enviar ${seriales.length} router(s) a Lomas?`)) return;

  try {
    await service.transferirALomasMasivo({ seriales, usuario: usuarioActual });
    seleccionMultiple.clear();
    await refresh();
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Error');
  }
}

async function sincronizarConSheets() {
    try {
    const { pullTodo, hayPendientes } = await import('../infrastructure/storage/sheets-sync');
    if (hayPendientes()) return;   // ← no pisar mientras haya push en curso
    const { routers: r, movimientos: m } = await pullTodo(agenciaActual);
    const keyRouters = agenciaActual === 'lomas' ? 'routersLomas' : 'routers';
    const keyMovs = agenciaActual === 'lomas' ? 'movimientosLomas' : 'movimientos';
    await chrome.storage.local.set({ [keyRouters]: r, [keyMovs]: m });
    // El storage.onChanged ya dispara refresh()
  } catch (e) {
    console.debug('Sin conexión a Sheets', e);
  }
}

// ── Datos ──────────────────────────────────────────────

function actualizarBotonAgregar() {
  const enParaiso = agenciaActual === 'paraiso';
  const mostrar = enParaiso
    ? currentFilter !== 'optimo'      // Paraíso: no en óptimos
    : currentFilter === 'optimo';     // Lomas: solo en óptimos
  elBtnAgregar.hidden = !mostrar;

  const textos: Record<EstadoRouter, string> = {
    nuevo: 'Agregar nuevo',
    optimo: 'Agregar optimo',
    en_revision: 'Agregar retorno',
    dañado: 'Agregar',
  };
  elBtnAgregar.textContent = textos[currentFilter];
}

function actualizarOpcionesFiltro() {
  const opcionRevision = elFiltro.querySelector<HTMLOptionElement>('[data-opcion="en_revision"]');
  if (!opcionRevision) return;

  if (agenciaActual === 'lomas') {
    opcionRevision.hidden = true;
    // Si estaba seleccionada, mover a nuevo
    if (currentFilter === 'en_revision') {
      currentFilter = 'nuevo';
      elFiltro.value = 'nuevo';
    }
  } else {
    opcionRevision.hidden = false;
  }
}

async function refresh() {
  routers = await routerRepo.getAll();
  // Si el seleccionado ya no está en el filtro actual, limpiar selección
  if (selectedSerial) {
    const still = filteredRouters().some(r => r.serial === selectedSerial);
    if (!still) selectedSerial = null;
  }
  renderTabla();
    await renderDetalle();
    renderStock();
    await renderHistorialRevisiones();
    if (currentFilter !== 'en_revision') {
    selectedMovId = null;
    elHistorialDetalle.hidden = true;
    elPerdidaCable.checked = false;
    elPerdidaInternet.checked = false;
  }
}


function filteredRouters(): Router[] {
  return routers
    .filter(r => r.estado === currentFilter)
    .filter(r => currentSearch === '' || r.serial.toLowerCase().includes(currentSearch))
    .filter(r => {
      const f = filtrosActivos;
      if (f.tipo && getTipoLabel(r.tipo) !== f.tipo) return false;
      if (f.tecnico && r.tecnicoActual !== f.tecnico) return false;
      if (f.tecnologia && r.tecnologia !== f.tecnologia) return false;
      if (f.agencia) {
        const ag = r.agencia === 'paraiso' ? 'Paraíso' : 'Lomas';
        if (ag !== f.agencia) return false;
      }
      if (f.lote && String(r.lote ?? '') !== f.lote) return false;
      if (f.fechaIngreso) {
        const d = new Date(r.fechaIngreso);
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (iso !== f.fechaIngreso) return false;
      }
      return true;
    })
    .sort((a, b) => b.fechaIngreso - a.fechaIngreso);
}

function paginatedRouters(): Router[] {
  const list = filteredRouters();
  const start = (currentPage - 1) * pageSize;
  return list.slice(start, start + pageSize);
}

// ── Render ─────────────────────────────────────────────
function renderTabla() {
  const list = filteredRouters();
  const page = paginatedRouters();
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  elContador.textContent = `Mostrando ${page.length} de ${total}`;
  elPagInfo.textContent = String(currentPage);
  elPagPrev.disabled = currentPage <= 1;
  elPagNext.disabled = currentPage >= totalPages;

  const puedeSeleccionarMultiple = currentFilter === 'nuevo' && agenciaActual === 'paraiso';

  elTablaBody.replaceChildren(
    ...page.map(r => {
      const tr = document.createElement('tr');
      if (r.serial === selectedSerial) tr.classList.add('selected');

      const tdCheck = document.createElement('td');
      if (puedeSeleccionarMultiple) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = seleccionMultiple.has(r.serial);
        cb.addEventListener('click', (e) => e.stopPropagation());
        cb.addEventListener('change', () => {
          if (cb.checked) seleccionMultiple.add(r.serial);
          else seleccionMultiple.delete(r.serial);
          renderTabla();
          renderDetalle();
        });
        tdCheck.append(cb);
      }
      tr.append(tdCheck);

      const tdLote = document.createElement('td');
      tdLote.textContent = r.lote ?? '—';
      const tdFecha = document.createElement('td');
      tdFecha.textContent = formatDate(r.fechaIngreso);
      const tdSerial = document.createElement('td');
      tdSerial.textContent = r.serial;
      const tdTipo = document.createElement('td');
      tdTipo.textContent = getTipoLabel(r.tipo);
      const tdEstado = document.createElement('td');
      tdEstado.textContent = getEstadoLabel(r.estado);

      tr.append(tdLote, tdFecha, tdSerial, tdTipo, tdEstado);

      tr.addEventListener('click', () => {
        selectedSerial = r.serial;
        renderTabla();
        renderDetalle();
      });
      return tr;
    }),
  );

  // Barra múltiple
  const n = seleccionMultiple.size;
  if (n > 0) {
    elBarraMultiple.hidden = false;
    elMultiContador.textContent = `${n} seleccionado${n > 1 ? 's' : ''}`;
  } else {
    elBarraMultiple.hidden = true;
  }

  // Check "todos"
  if (puedeSeleccionarMultiple && page.length > 0) {
    elCheckAll.disabled = false;
    elCheckAll.checked = page.every(r => seleccionMultiple.has(r.serial));
  } else {
    elCheckAll.disabled = true;
    elCheckAll.checked = false;
  }
}

async function renderDetalle() {
  // Cerrar acordeones si cambió el router
  if (selectedSerial !== lastSelectedSerial) {
    elAccInfo.classList.remove('abierto');
    elAccSalida.classList.remove('abierto');
    lastSelectedSerial = selectedSerial;
  }

  if (seleccionMultiple.size > 0) {
    elDetalleInfo.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center;">
        <strong>${seleccionMultiple.size} router${seleccionMultiple.size > 1 ? 's' : ''} seleccionado${seleccionMultiple.size > 1 ? 's' : ''}</strong><br>
        <span style="font-size:10px;color:#666;">Usa los botones de arriba para enviarlos a Lomas</span>
      </div>
    `;
    elAccInfo.hidden = false;
    elAccSalida.hidden = false;
    elFormSalida.hidden = true;
    elFormRevision.hidden = true;
    elBtnAsignarCliente.hidden = true;
    elFormDesasignar.hidden = true;
    return;
  }

  const router = selectedSerial ? routers.find(r => r.serial === selectedSerial) : null;

  if (!router) {
    elDetalleInfo.innerHTML = `
      <div><strong>Serial:</strong> —</div>
      <div><strong>Técnico:</strong> —</div>
      <div><strong>Fabricante:</strong> —</div>
      <div><strong>Cliente:</strong> —</div>
      <div><strong>Fecha de ingreso:</strong> —</div>
      <div><strong>Tipo:</strong> —</div>
      <div><strong>Agregado por:</strong> —</div>
      <div><strong>Tecnología:</strong> —</div>
    `;
    elFormSalida.hidden = true;
    elFormRevision.hidden = true;
    elBtnAsignarCliente.hidden = true;
    elAccInfo.hidden = true;
    elAccSalida.hidden = true;
    return;
  }

  elDetalleInfo.innerHTML = `
    <div><strong>Serial:</strong> ${router.serial} <button class="btn-copy" data-copy="${router.serial}" title="Copiar serial"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button></div>
    <div><strong>Técnico:</strong> ${router.tecnicoActual ?? '—'}</div>
    <div><strong>Fabricante:</strong> ${router.fabricante ?? '—'}</div>
    <div><strong>Cliente:</strong> ${router.clienteActual ?? '—'}</div>
    <div><strong>Fecha de ingreso:</strong> ${formatDate(router.fechaIngreso)}</div>
    <div><strong>Tipo:</strong> ${getTipoLabel(router.tipo)}</div>
    <div><strong>Ubicación:</strong> ${getUbicacionLabel(router.ubicacion)}</div>
    <div><strong>Agencia:</strong> ${router.agencia === 'paraiso' ? 'Paraíso' : 'Lomas'}</div>
    <div><strong>Tecnología:</strong> ${router.tecnologia ?? '—'}</div>
  `;

  elBtnAsignarCliente.hidden = router.estado === 'en_revision';
  elFormDesasignar.hidden = router.ubicacion !== 'campo';
  elAccInfo.hidden = false;
  elAccSalida.hidden = false;

  const btnCopy = elDetalleInfo.querySelector<HTMLButtonElement>('.btn-copy');
  btnCopy?.addEventListener('click', async () => {
    const texto = btnCopy.dataset.copy ?? '';
    await navigator.clipboard.writeText(texto);
    btnCopy.classList.add('copiado');
    setTimeout(() => btnCopy.classList.remove('copiado'), 1000);
  });

  if (router.estado === 'en_revision') {
    elFormSalida.hidden = true;
    elFormRevision.hidden = false;
    elRevisionSerial.value = router.serial;
    elRevisionDetalle.value = '';
    setToday(elRevisionFecha);
  } else {
    elFormSalida.hidden = false;
    elFormRevision.hidden = true;
    elSalidaSerial.value = router.serial;
    setToday(elSalidaFecha);
  }
}

function renderStock() {
  const enRevision = currentFilter === 'en_revision';
  const stock: StockPorTipo[] = enRevision
    ? calcularEnRevision(routers)
    : calcularStockPorTipo(
        routers,
        currentFilter as 'nuevo' | 'optimo',
        agenciaActual,
      );

  elStockLista.replaceChildren(
    ...stock.map(s => {
      const div = document.createElement('div');
      div.className = 'stock-item';
      const alertaClass = s.alerta === 'ok' ? 'ok' : s.alerta === 'bajo' ? 'bajo' : 'agotado';
      div.innerHTML = `
        <div class="nombre">${getTipoLabel(s.tipo)}</div>
        ${enRevision ? '' : `<div class="dot ${alertaClass}"></div>`}
        <div class="num">${s.cantidad}</div>
      `;
      return div;
    }),
  );
}

async function renderHistorialRevisiones() {
  const movs = await movRepo.getAll();
  const revisiones = movs
    .filter(m => m.tipo === 'revision' || m.tipo === 'merma')
    .filter(m => {
      const f = filtrosHist;
      if (f.tipo && m.routerTipo && getTipoLabel(m.routerTipo) !== f.tipo) return false;
      if (f.resultado) {
        const r = m.resultado === 'optimo' ? 'Revisado' : 'Merma';
        if (r !== f.resultado) return false;
      }
      if (f.fechaRevision) {
        const d = new Date(m.fecha);
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (iso !== f.fechaRevision) return false;
      }
      return true;
    })
    .sort((a, b) => b.fecha - a.fecha);

  if (currentFilter !== 'en_revision' || revisiones.length === 0) {
    elHistorialRevisiones.hidden = true;
    elHistorialDetalle.hidden = true;
    return;
  }

  elHistorialRevisiones.hidden = false;
  histTotal = revisiones.length;
  const totalPages = Math.max(1, Math.ceil(histTotal / histPageSize));
  if (histPage > totalPages) histPage = totalPages;

  const start = (histPage - 1) * histPageSize;
  const page = revisiones.slice(start, start + histPageSize);

  elHistContador.textContent = `Mostrando ${page.length} de ${histTotal}`;
  elHistPagInfo.textContent = String(histPage);
  elHistPagPrev.disabled = histPage <= 1;
  elHistPagNext.disabled = histPage >= totalPages;

  elHistorialBody.replaceChildren(
    ...page.map(m => {
      const router = routers.find(r => r.serial === m.routerSerial);
      const tr = document.createElement('tr');
      if (m.id === selectedMovId) tr.classList.add('selected');
      tr.innerHTML = `
        <td>${router?.lote ?? '—'}</td>
        <td>${formatDate(m.fecha)}</td>
        <td>${m.routerSerial}</td>
        <td>${m.routerTipo ? getTipoLabel(m.routerTipo) : '—'}</td>
        <td>${m.resultado === 'optimo' ? 'Revisado' : 'Merma'}</td>
      `;
      tr.addEventListener('click', () => {
        selectedMovId = m.id;
        void renderHistorialRevisiones();
        renderHistorialDetalle(m);
      });
      return tr;
    }),
  );
}

function renderHistorialDetalle(m: Movimiento) {
  const router = routers.find(r => r.serial === m.routerSerial);
  elHistorialDetalle.hidden = false;
  elHistorialDetalle.innerHTML = `
    <div class="detalle-info">
      <div><strong>${m.routerSerial}</strong></div>
      <div><strong>Técnico:</strong> ${m.tecnico ?? '—'}</div>
      <div><strong>Fabricante:</strong> ${router?.fabricante ?? '—'}</div>
      <div><strong>Cliente:</strong> ${m.cliente ?? '—'}</div>
      <div><strong>Fecha de retorno:</strong> ${m.fechaRetorno ? formatDate(m.fechaRetorno) : '—'}</div>
      <div><strong>Fecha de revisión:</strong> ${formatDate(m.fecha)}</div>
      <div><strong>Tipo:</strong> ${m.routerTipo ? getTipoLabel(m.routerTipo) : '—'}</div>
      <div><strong>Detalle:</strong> ${m.detalle ?? '—'}</div>
    </div>
  `;
}

// ── Acciones ───────────────────────────────────────────
async function agregarRouter() {
  if (currentFilter === 'nuevo') {
    abrirNuevoModal(async (data) => {
      try {
        await service.registrarNuevo({ ...data, usuario: usuarioActual, agencia: agenciaActual });
        await refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error al registrar');
      }
    });
  } else {
    // 'optimo' o 'en_revision' → modal de retorno
    const destino = currentFilter === 'optimo' ? 'optimo' : 'a_revisar';
    abrirRetornoModal(destino, async (data) => {
      try {
        await service.registrarRetorno({ ...data, usuario: usuarioActual, agencia: agenciaActual });
        await refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error al registrar retorno');
      }
    });
  }
}

async function asignarCliente() {
  if (!selectedSerial) return;
  const router = routers.find(r => r.serial === selectedSerial);
  if (!router) return;
  elFormDesasignar.hidden = true;

  abrirClienteModal(router.clienteActual, async (data) => {
    try {
      await service.asignarCliente({
        serial: selectedSerial!,
        cliente: data.cliente,
        motivo: data.motivo,
        usuario: usuarioActual,
      });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al asignar');
    }
  });
}

async function registrarSalida() {
  if (!selectedSerial) return;
  const tecnico = elSalidaTecnico.value;
  const motivo = elSalidaMotivo.value;
  if (!tecnico) { alert('Selecciona un técnico'); return; }
  try {
    if (motivo === 'Lomas') {
      await service.transferirALomas({
        serial: selectedSerial,
        usuario: usuarioActual,
        tecnico,
      });
    } else {
      await service.registrarSalida({ serial: selectedSerial, tecnico, motivo, usuario: usuarioActual });
    }
    selectedSerial = null;
    await refresh();
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Error');
  }
}

async function desasignarTecnico() {
  if (!selectedSerial) return;
  if (!confirm('¿Devolver este router a oficina y quitarle el técnico?')) return;
  try {
    await service.desasignarTecnico({ serial: selectedSerial, usuario: usuarioActual });
    await refresh();
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Error al desasignar');
  }
}

async function registrarRevision(resultado: 'optimo' | 'merma') {
  if (!selectedSerial) return;
  const detalle = elRevisionDetalle.value.trim() || undefined;
  const router = routers.find(r => r.serial === selectedSerial);
  if (!router) return;

  let nuevoTipo: TipoRouter | undefined;

  if (resultado === 'optimo') {
    const pierdeCable = elPerdidaCable.checked;
    const pierdeInternet = elPerdidaInternet.checked;

    if (pierdeCable && pierdeInternet) {
      alert('No puedes marcar ambas características como perdidas');
      return;
    }

    if (router.tipo === 'duo') {
      if (pierdeCable) nuevoTipo = 'internet';
      if (pierdeInternet) nuevoTipo = 'cable';
    }
  }

  try {
    await service.registrarRevision({
      serial: selectedSerial,
      resultado,
      detalle,
      nuevoTipo,
      usuario: usuarioActual,
    });
    selectedSerial = null;
    await refresh();
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Error al registrar revisión');
  }
}


// ── Arranque ───────────────────────────────────────────
void init();