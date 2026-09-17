// src/dock/dock.ts
import type { Router, TipoRouter, EstadoRouter } from '../domain/entities/router';
import { TECNICOS, USUARIOS } from '../domain/entities/tecnicos';
import { ChromeRouterRepository } from '../infrastructure/storage/chrome-router-repository';
import { ChromeMovimientoRepository } from '../infrastructure/storage/chrome-movimiento-repository';
import { RouterService } from '../domain/services/router-service';
import { calcularStockPorTipo, type StockPorTipo } from '../domain/services/stock-calculator';
import { abrirNuevoModal } from './views/modals/nuevo-modal';
import { abrirRetornoModal } from './views/modals/retorno-modal';

// ── Instancias ─────────────────────────────────────────
const routerRepo = new ChromeRouterRepository();
const movRepo = new ChromeMovimientoRepository();
const service = new RouterService(routerRepo, movRepo);

// ── Estado ─────────────────────────────────────────────
let routers: Router[] = [];
let selectedSerial: string | null = null;
let currentFilter: EstadoRouter = 'nuevo';
let currentSearch = '';
let currentPage = 1;
const pageSize = 10;
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

function getUbicacionLabel(u: 'oficina' | 'campo'): string {
  return u === 'oficina' ? 'Oficina' : 'Campo';
}

function setToday(input: HTMLInputElement) {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  input.value = iso;
}

// ── Elementos ──────────────────────────────────────────
const elUsuario = document.querySelector<HTMLSelectElement>('#usuario-actual')!;
const elFiltro = document.querySelector<HTMLSelectElement>('#filtro-estado')!;
const elBtnAgregar = document.querySelector<HTMLButtonElement>('#btn-agregar')!;
const elBuscar = document.querySelector<HTMLInputElement>('#buscar-serial')!;
const elTablaBody = document.querySelector<HTMLTableSectionElement>('#tabla-body')!;
const elTablaTitulo = document.querySelector<HTMLSpanElement>('#tabla-titulo')!;
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

// ── Inicialización ─────────────────────────────────────
function init() {
  // Poblar usuario
  elUsuario.replaceChildren(
    ...USUARIOS.map(u => new Option(u, u)),
  );
  elUsuario.value = usuarioActual;
  elUsuario.addEventListener('change', () => {
    usuarioActual = elUsuario.value;
  });

  // Poblar técnicos
  elSalidaTecnico.replaceChildren(
    ...TECNICOS.map(t => new Option(t, t)),
  );

  // Fechas por defecto
  setToday(elSalidaFecha);
  setToday(elRevisionFecha);

  // Event listeners
  elFiltro.addEventListener('change', () => {
    currentFilter = elFiltro.value as EstadoRouter;
    currentPage = 1;
    selectedSerial = null;
    actualizarBotonAgregar(); 
    refresh();
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

  elBtnAgregar.addEventListener('click', agregarRouter);
  elBtnAsignarCliente.addEventListener('click', asignarCliente);
  elBtnRegistrarSalida.addEventListener('click', registrarSalida);
  elBtnRegistrarRevision.addEventListener('click', () => registrarRevision('optimo'));
  elBtnRegistrarMerma.addEventListener('click', () => registrarRevision('merma'));

  elBtnExportar.addEventListener('click', () => alert('Exportar próximamente'));

  // Escuchar cambios en storage
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.routers || changes.movimientos)) {
      refresh();
    }
  });

  refresh();
}

// ── Datos ──────────────────────────────────────────────

function actualizarBotonAgregar() {
  const textos: Record<EstadoRouter, string> = {
    nuevo: 'Agregar nuevo',
    optimo: 'Agregar optimo',
    en_revision: 'Agregar retorno',
    dañado: 'Agregar',
  };
  elBtnAgregar.textContent = textos[currentFilter];
}

async function refresh() {
  routers = await routerRepo.getAll();
  // Si el seleccionado ya no está en el filtro actual, limpiar selección
  if (selectedSerial) {
    const still = filteredRouters().some(r => r.serial === selectedSerial);
    if (!still) selectedSerial = null;
  }
  renderTabla();
  renderDetalle();
  renderStock();
}


function filteredRouters(): Router[] {
  return routers
    .filter(r => r.estado === currentFilter)
    .filter(r => currentSearch === '' || r.serial.toLowerCase().includes(currentSearch))
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

  elTablaTitulo.textContent = currentFilter === 'en_revision' ? 'Equipos a revisar' : 'Conteo de equipos';
  elContador.textContent = `Mostrando ${page.length} de ${total}`;
  elPagInfo.textContent = String(currentPage);
  elPagPrev.disabled = currentPage <= 1;
  elPagNext.disabled = currentPage >= totalPages;

  elTablaBody.replaceChildren(
    ...page.map(r => {
      const tr = document.createElement('tr');
      if (r.serial === selectedSerial) tr.classList.add('selected');
      tr.innerHTML = `
        <td>${r.lote ?? '—'}</td>
        <td>${formatDate(r.fechaIngreso)}</td>
        <td>${r.serial}</td>
        <td>${getTipoLabel(r.tipo)}</td>
        <td>${getEstadoLabel(r.estado)}</td>
      `;
      tr.addEventListener('click', () => {
        selectedSerial = r.serial;
        renderTabla();
        renderDetalle();
      });
      return tr;
    }),
  );
}

function renderDetalle() {
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
    return;
  }

  elDetalleInfo.innerHTML = `
    <div><strong>Serial:</strong> ${router.serial}</div>
    <div><strong>Técnico:</strong> ${router.tecnicoActual ?? '—'}</div>
    <div><strong>Fabricante:</strong> ${router.fabricante ?? '—'}</div>
    <div><strong>Cliente:</strong> ${router.clienteActual ?? '—'}</div>
    <div><strong>Fecha de ingreso:</strong> ${formatDate(router.fechaIngreso)}</div>
    <div><strong>Tipo:</strong> ${getTipoLabel(router.tipo)}</div>
    <div><strong>Ubicación:</strong> ${getUbicacionLabel(router.ubicacion)}</div>
    <div><strong>Tecnología:</strong> ${router.tecnologia ?? '—'}</div>
  `;

  elBtnAsignarCliente.hidden = router.estado === 'en_revision';

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
  const stock = calcularStockPorTipo(routers);
  elStockLista.replaceChildren(
    ...stock.map(s => {
      const div = document.createElement('div');
      div.className = 'stock-item';
      const alertaClass = s.alerta === 'ok' ? 'ok' : s.alerta === 'bajo' ? 'bajo' : 'agotado';
      div.innerHTML = `
        <div class="nombre">${getTipoLabel(s.tipo)}</div>
        <div class="dot ${alertaClass}"></div>
        <div class="num">${s.cantidad}</div>
      `;
      return div;
    }),
  );
}

// ── Acciones ───────────────────────────────────────────
async function agregarRouter() {
  if (currentFilter === 'nuevo') {
    abrirNuevoModal(async (data) => {
      try {
        await service.registrarNuevo({ ...data, usuario: usuarioActual });
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
        await service.registrarRetorno({ ...data, usuario: usuarioActual });
        await refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error al registrar retorno');
      }
    });
  }
}

async function asignarCliente() {
  if (!selectedSerial) return;
  const cliente = prompt('Nombre del cliente:');
  if (!cliente) return;
  try {
    await service.asignarCliente({ serial: selectedSerial, cliente, usuario: usuarioActual });
    await refresh();
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Error al asignar');
  }
}

async function registrarSalida() {
  if (!selectedSerial) return;
  const tecnico = elSalidaTecnico.value;
  if (!tecnico) { alert('Selecciona un técnico'); return; }
  try {
    await service.registrarSalida({ serial: selectedSerial, tecnico, usuario: usuarioActual });
    selectedSerial = null;
    await refresh();
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Error al registrar salida');
  }
}

async function registrarRevision(resultado: 'optimo' | 'merma') {
  if (!selectedSerial) return;
  const detalle = elRevisionDetalle.value.trim() || undefined;
  try {
    await service.registrarRevision({ serial: selectedSerial, resultado, detalle, usuario: usuarioActual });
    selectedSerial = null;
    await refresh();
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Error al registrar revisión');
  }
}

// ── Arranque ───────────────────────────────────────────
init();