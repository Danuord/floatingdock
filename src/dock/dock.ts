// src/dock/dock.ts
import type { Router, TipoRouter, EstadoRouter } from '../domain/entities/router';
import { TECNICOS, USUARIOS } from '../domain/entities/tecnicos';
import { SupabaseRouterRepository } from '../infrastructure/storage/supabase-router-repository';
import { SupabaseMovimientoRepository } from '../infrastructure/storage/supabase-movimiento-repository';
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
import { abrirImportModal } from './views/modals/import-modal';
import { loginSupabase, cambiarPinSupabase, getUsuariosActivos } from '../infrastructure/storage/supabase-usuario-repository';
import { supabase } from '../infrastructure/storage/supabase-client';
(window as any).supabase = supabase;
import { suscribirCambios } from '../infrastructure/storage/supabase-realtime';

// ── Instancias ─────────────────────────────────────────
const elBtnDevolverParaiso = document.querySelector<HTMLButtonElement>('#btn-devolver-paraiso')!;
let modoDevolucion = false;
const elAccInfo = document.querySelector<HTMLDivElement>('#acc-info')!;
const elBuscarHist = document.querySelector<HTMLInputElement>('#buscar-hist-serial')!;
let histSearch = '';
const elAccSalida = document.querySelector<HTMLDivElement>('#acc-salida')!;
let lastSelectedSerial: string | null = null;
let filtrosActivos: FiltrosAplicados = {};
let desuscribir: (() => void) | null = null;
let agenciaActual: Agencia = 'paraiso';
let routerRepo = new SupabaseRouterRepository(agenciaActual);
let movRepo = new SupabaseMovimientoRepository(agenciaActual);
const service = new RouterService(
  { getAll: () => routerRepo.getAll(), getBySerial: s => routerRepo.getBySerial(s), save: r => routerRepo.save(r), delete: id => routerRepo.delete(id) },
  { getAll: () => movRepo.getAll(), getBySerial: s => movRepo.getBySerial(s), save: m => movRepo.save(m) },
  (a) => new SupabaseRouterRepository(a),
  (a) => new SupabaseMovimientoRepository(a),
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
const elAgenciaPill = document.querySelector<HTMLDivElement>('#agencia-pill')!;
const elAgenciaBtns = elAgenciaPill.querySelectorAll<HTMLButtonElement>('button[data-agencia]');
const elBtnFiltros = document.querySelector<HTMLButtonElement>('#btn-filtros')!;
const elBtnFiltrosHist = document.querySelector<HTMLButtonElement>('#btn-filtros-hist')!;
const elChipsFiltrosHist = document.querySelector<HTMLDivElement>('#chips-filtros-hist')!;
const elChipsFiltros = document.querySelector<HTMLDivElement>('#chips-filtros')!;
const elLoginOverlay = document.querySelector<HTMLDivElement>('#login-overlay')!;
const elLoginUsuario = document.querySelector<HTMLSelectElement>('#login-usuario')!;
const elLoginPin = document.querySelector<HTMLInputElement>('#login-pin')!;
const elLoginError = document.querySelector<HTMLParagraphElement>('#login-error')!;
const elLoginBtn = document.querySelector<HTMLButtonElement>('#login-btn')!;
const elBtnLimpiarFechas = document.querySelector<HTMLButtonElement>('#btn-limpiar-fechas')!;

const SESSION_KEY = 'sesion-actual';
const elUsuarioLabel = document.querySelector<HTMLSpanElement>('#usuario-label')!;
const elBtnCerrarSesion = document.querySelector<HTMLButtonElement>('#btn-cerrar-sesion')!;
const elFechaDesde = document.querySelector<HTMLInputElement>('#fecha-desde')!;
const elFechaHasta = document.querySelector<HTMLInputElement>('#fecha-hasta')!;
let rangoDesde = '';
let rangoHasta = '';

const elHistFechaDesde = document.querySelector<HTMLInputElement>('#hist-fecha-desde')!;
const elHistFechaHasta = document.querySelector<HTMLInputElement>('#hist-fecha-hasta')!;
const elBtnLimpiarFechasHist = document.querySelector<HTMLButtonElement>('#btn-limpiar-fechas-hist')!;
let histRangoDesde = '';
let histRangoHasta = '';

interface Sesion {
  usuario: string;
  expira: number;
}

async function getSesionValida(): Promise<Sesion | null> {
  const data = await chrome.storage.local.get(SESSION_KEY);
  const s = data[SESSION_KEY] as Sesion | undefined;
  if (!s) return null;
  if (Date.now() > s.expira) return null;
  return s;
}

function proximaMedianoche(): number {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

async function guardarSesion(usuario: string): Promise<void> {
  const s: Sesion = { usuario, expira: proximaMedianoche() };
  await chrome.storage.local.set({ [SESSION_KEY]: s });
}

async function cerrarSesion(): Promise<void> {
  await chrome.storage.local.remove(SESSION_KEY);
  location.reload();
}

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
const elFormSalida = document.querySelector<HTMLDivElement>('#acc-salida .form-salida')!;
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
const elBtnImportar = document.querySelector<HTMLButtonElement>('#btn-importar')!;
const elHistContador = document.querySelector<HTMLSpanElement>('#hist-contador')!;
const elHistPagInfo = document.querySelector<HTMLSpanElement>('#hist-pag-info')!;
const elHistPagPrev = document.querySelector<HTMLButtonElement>('#hist-pag-prev')!;
const elHistPagNext = document.querySelector<HTMLButtonElement>('#hist-pag-next')!;
let histPage = 1;
let histTotal = 0;
let histPageSize = 10;
let motivosRetorno = new Map<string, string>();
const elBarraMultiple = document.querySelector<HTMLDivElement>('#barra-multiple')!;
const elMultiContador = document.querySelector<HTMLSpanElement>('#multi-contador')!;
const elBtnEnviarLomasMulti = document.querySelector<HTMLButtonElement>('#btn-enviar-lomas-multi')!;
const elBtnLimpiarMulti = document.querySelector<HTMLButtonElement>('#btn-limpiar-multi')!;
const elCheckAll = document.querySelector<HTMLInputElement>('#check-all')!;
let seleccionMultiple = new Set<string>();
let filtrosHist: FiltrosAplicados = {};
const elBtnIrCambiarPin = document.querySelector<HTMLButtonElement>('#btn-ir-cambiar-pin')!;
const elCambiarPinBox = document.querySelector<HTMLDivElement>('#cambiar-pin-box')!;
const elLoginBox = document.querySelector<HTMLDivElement>('.login-box')!;
const elCpUsuario = document.querySelector<HTMLSelectElement>('#cp-usuario')!;
const elCpPinViejo = document.querySelector<HTMLInputElement>('#cp-pin-viejo')!;
const elCpPinNuevo = document.querySelector<HTMLInputElement>('#cp-pin-nuevo')!;
const elCpPinConfirmar = document.querySelector<HTMLInputElement>('#cp-pin-confirmar')!;
const elCpError = document.querySelector<HTMLParagraphElement>('#cp-error')!;
const elCpGuardar = document.querySelector<HTMLButtonElement>('#cp-guardar')!;
const elCpVolver = document.querySelector<HTMLButtonElement>('#cp-volver')!;
const elAccHistorial = document.querySelector<HTMLDivElement>('#acc-historial')!;

// ── Inicialización ─────────────────────────────────────
async function init() {
  // 1. Verificar sesión
  const sesion = await getSesionValida();
  if (!sesion) {
    mostrarLogin();
    return;
  }
  usuarioActual = sesion.usuario;
  elUsuarioLabel.textContent = usuarioActual;
  elBtnCerrarSesion.addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) void cerrarSesion();
  });
  elLoginOverlay.hidden = true;

  function setAgenciaUI() {
    elAgenciaBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.agencia === agenciaActual);
    });
  }
  setAgenciaUI();

  elAgenciaBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const nueva = btn.dataset.agencia as Agencia;
      if (nueva === agenciaActual) return;
      agenciaActual = nueva;
      setAgenciaUI();
      routerRepo = new SupabaseRouterRepository(agenciaActual);
      movRepo = new SupabaseMovimientoRepository(agenciaActual);
      selectedSerial = null;
      selectedMovId = null;
      seleccionMultiple.clear();
      elFechaDesde.value = '';      // ← nueva
      elFechaHasta.value = '';      // ← nueva
      rangoDesde = '';              // ← nueva
      rangoHasta = '';              // ← nueva
      actualizarOpcionesFiltro();
      actualizarBotonAgregar();
      await refresh();
      if (desuscribir) desuscribir();
      desuscribir = suscribirCambios(agenciaActual, () => {
        void refresh();
      });
      modoDevolucion = false;
      actualizarModoDevolucion();
    });
  });
    
  elBuscarHist.addEventListener('input', () => {
    histSearch = elBuscarHist.value.trim().toLowerCase();
    histPage = 1;
    void renderHistorialRevisiones();
  });

  document.querySelectorAll<HTMLButtonElement>('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const acc = btn.closest('.accordion');
      acc?.classList.toggle('abierto');
    });
  });

  elFechaDesde.addEventListener('change', () => {
    rangoDesde = elFechaDesde.value;
    currentPage = 1;
    renderTabla();
  });
  elFechaHasta.addEventListener('change', () => {
    rangoHasta = elFechaHasta.value;
    currentPage = 1;
    renderTabla();
  });
  elBtnLimpiarFechas.addEventListener('click', () => {
    elFechaDesde.value = '';
    elFechaHasta.value = '';
    rangoDesde = '';
    rangoHasta = '';
    currentPage = 1;
    renderTabla();
  });

  elHistFechaDesde.addEventListener('change', () => {
    histRangoDesde = elHistFechaDesde.value;
    histPage = 1;
    void renderHistorialRevisiones();
  });
  elHistFechaHasta.addEventListener('change', () => {
    histRangoHasta = elHistFechaHasta.value;
    histPage = 1;
    void renderHistorialRevisiones();
  });
  elBtnLimpiarFechasHist.addEventListener('click', () => {
    elHistFechaDesde.value = '';
    elHistFechaHasta.value = '';
    histRangoDesde = '';
    histRangoHasta = '';
    histPage = 1;
    void renderHistorialRevisiones();
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
    histSearch = '';
    elBuscarHist.value = '';
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

  elBtnDevolverParaiso.addEventListener('click', () => {
    modoDevolucion = !modoDevolucion;
    actualizarModoDevolucion();
  });

  elBtnRegistrarSalida.addEventListener('click', () => {
    if (modoDevolucion) {
      void ejecutarDevolucion();
    } else {
      void registrarSalida();
    }
  });

  elBtnImportar.addEventListener('click', importarExcel);

  elBtnEnviarLomasMulti.addEventListener('click', enviarLomasMasivo);

  elBtnFiltros.addEventListener('click', () => {
    const campos: OpcionFiltro[] = [
      { campo: 'tipo', label: 'Tipo', tipo: 'select', opciones: ['Duo', 'Internet', 'Cable'] },
      { campo: 'tecnico', label: 'Técnico', tipo: 'select', opciones: TECNICOS },
      { campo: 'tecnologia', label: 'Tecnología', tipo: 'select', opciones: ['WiFi 5', 'WiFi 6'] },
      { campo: 'fechaIngreso', label: 'Fecha ingreso', tipo: 'fecha' },
      { campo: 'soloOficina', label: 'Solo en oficina', tipo: 'checkbox' },
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
    soloOficina: 'Solo en oficina',
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

  elBtnAgregar.addEventListener('click', agregarRouter);
  elBtnAsignarCliente.addEventListener('click', asignarCliente);
  elBtnRegistrarSalida.addEventListener('click', registrarSalida);
  elBtnDesasignar.addEventListener('click', desasignarTecnico);
  elBtnRegistrarRevision.addEventListener('click', () => registrarRevision('optimo'));
  elBtnRegistrarMerma.addEventListener('click', () => registrarRevision('merma'));
  elBtnExportar.addEventListener('click', () => {
    abrirExportModal(agenciaActual, async (tipos) => {
      const necesitaAmbas = tipos.some(t =>
        t === 'general' || t === 'nuevos' || t === 'optimos'
      );

      let routersParaExport = routers;
      let movsParaExport = await movRepo.getAll();

      if (necesitaAmbas) {
        const otra: Agencia = agenciaActual === 'paraiso' ? 'lomas' : 'paraiso';
        const routerOtra = new SupabaseRouterRepository(otra);
        const movOtra = new SupabaseMovimientoRepository(otra);
        const routersOtra = await routerOtra.getAll();
        const movsOtra = await movOtra.getAll();
        routersParaExport = [...routers, ...routersOtra];
        movsParaExport = [...movsParaExport, ...movsOtra];
      }

      generarExcel(tipos, routersParaExport, movsParaExport, agenciaActual);
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

  desuscribir = suscribirCambios(agenciaActual, () => {
    void refresh();
  });

  function actualizarAnchoLayout() {
    const w = document.documentElement.clientWidth;
    document.body.classList.toggle('layout-sm', w < 480);
    document.body.classList.toggle('layout-md', w >= 480 && w < 620);
    document.body.classList.toggle('layout-lg', w >= 620);
  }
  actualizarAnchoLayout();

  const ro = new ResizeObserver(actualizarAnchoLayout);
  ro.observe(document.documentElement);
}



function mostrarLogin() {
  elLoginOverlay.hidden = false;

  void getUsuariosActivos().then(usuarios => {
    elLoginUsuario.replaceChildren(...usuarios.map(u => new Option(u, u)));
  });

  const intentar = async () => {
    const nombre = elLoginUsuario.value;
    const pin = elLoginPin.value.trim();
    elLoginError.textContent = '';

    if (!nombre || !pin) {
      elLoginError.textContent = 'Completa todos los campos';
      return;
    }

    elLoginBtn.disabled = true;
    elLoginBtn.textContent = 'Verificando...';

    try {
      const res = await loginSupabase(nombre, pin);

      if (!res.ok) {
        elLoginError.textContent = res.error ?? 'Error';
        elLoginBtn.disabled = false;
        elLoginBtn.textContent = 'Entrar';
        return;
      }

      await guardarSesion(nombre);
      location.reload();
    } catch (e) {
      elLoginError.textContent = 'Error de conexión';
      elLoginBtn.disabled = false;
      elLoginBtn.textContent = 'Entrar';
    }
  };

  elLoginBtn.addEventListener('click', intentar);
  elLoginPin.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') void intentar();
  });
  elLoginPin.focus();

  elBtnIrCambiarPin.addEventListener('click', () => {
    elLoginBox.hidden = true;
    elCambiarPinBox.hidden = false;
    void getUsuariosActivos().then(usuarios => {
      elCpUsuario.replaceChildren(...usuarios.map(u => new Option(u, u)));
    });
    elCpPinViejo.value = '';
    elCpPinNuevo.value = '';
    elCpPinConfirmar.value = '';
    elCpError.textContent = '';
    elCpPinViejo.focus();
  });

  elCpVolver.addEventListener('click', () => {
    elCambiarPinBox.hidden = true;
    elLoginBox.hidden = false;
  });

  elCpGuardar.addEventListener('click', async () => {
    const nombre = elCpUsuario.value;
    const pinViejo = elCpPinViejo.value.trim();
    const pinNuevo = elCpPinNuevo.value.trim();
    const pinConfirmar = elCpPinConfirmar.value.trim();

    elCpError.textContent = '';

    if (!pinViejo || !pinNuevo || !pinConfirmar) {
      elCpError.textContent = 'Completa todos los campos';
      return;
    }
    if (pinNuevo !== pinConfirmar) {
      elCpError.textContent = 'Los PIN nuevos no coinciden';
      return;
    }
    if (pinNuevo.length < 4) {
      elCpError.textContent = 'El PIN debe tener al menos 4 dígitos';
      return;
    }

    elCpGuardar.disabled = true;
    elCpGuardar.textContent = 'Guardando...';

    try {
      const res = await cambiarPinSupabase(nombre, pinViejo, pinNuevo);

      if (!res.ok) {
        elCpError.textContent = res.error ?? 'Error';
        elCpGuardar.disabled = false;
        elCpGuardar.textContent = 'Guardar';
        return;
      }

      elCpError.textContent = '';
      alert('PIN actualizado correctamente');
      elCambiarPinBox.hidden = true;
      elLoginBox.hidden = false;
    } catch (e) {
      elCpError.textContent = 'Error de conexión';
      elCpGuardar.disabled = false;
      elCpGuardar.textContent = 'Guardar';
    }
  });
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

function actualizarModoDevolucion() {
  const activo = modoDevolucion;
  elBtnDevolverParaiso.classList.toggle('activo', activo);
  elBtnRegistrarSalida.textContent = activo ? 'Confirmar devolución' : 'Registrar salida';
  elSalidaTecnico.disabled = activo;
  elSalidaFecha.disabled = activo;
  elSalidaMotivo.disabled = activo;
}

async function ejecutarDevolucion() {
  if (!selectedSerial) return;
  if (!confirm('¿Confirmar devolución a Paraíso? El router saldrá de Lomas.')) return;
  try {
    await service.devolverAParaiso({ serial: selectedSerial, usuario: usuarioActual });
    modoDevolucion = false;
    actualizarModoDevolucion();
    selectedSerial = null;
    await refresh();
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Error al devolver');
  }
}

async function importarExcel() {
  abrirImportModal(async (file) => {
    try {
      const { parseExcel } = await import('../domain/services/import-service');

      const payload = await parseExcel(file, agenciaActual);

      // Filtrar seriales que ya existen
      const actuales = await routerRepo.getAll();
      const mapaActual = new Map(actuales.map(r => [r.serial, r]));

      const routersNuevos: Router[] = [];
      const routersActualizados: Router[] = [];

      payload.routers.forEach(r => {
        const ex = mapaActual.get(r.serial);
        if (ex) {
          ex.estado = r.estado;
          ex.ubicacion = r.ubicacion;
          ex.tecnicoActual = r.tecnicoActual;
          ex.clienteActual = r.clienteActual;
          ex.actualizadoEn = Date.now();
          routersActualizados.push(ex);
        } else {
          routersNuevos.push(r);
        }
      });

      const tiposRelevantes = new Set(['retorno', 'revision', 'merma']);
      const movsNuevos = payload.movimientos.filter(m => {
        if (mapaActual.has(m.routerSerial)) {
          return tiposRelevantes.has(m.tipo);
        }
        return true;
      });

      if (routersNuevos.length === 0 && routersActualizados.length === 0) {
        alert(
          `Nada que importar.\n` +
          `Duplicados en Excel: ${payload.duplicados.length}\n` +
          `Errores: ${payload.errores.length}`
        );
        return;
      }

      // Guardar routers en Supabase
      for (const r of [...routersActualizados, ...routersNuevos]) {
        await routerRepo.save(r);
      }

      // Guardar movimientos en Supabase
      const movRepoLocal = movRepo;
      for (const m of movsNuevos) {
        await movRepoLocal.save(m);
      }

      alert(
        `Importación completa.\n` +
        `Routers creados: ${routersNuevos.length}\n` +
        `Routers actualizados: ${routersActualizados.length}\n` +
        `Movimientos: ${movsNuevos.length}\n` +
        `Duplicados en Excel: ${payload.duplicados.length}\n` +
        `Errores: ${payload.errores.length}`
      );
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al importar');
    }
  });
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
      if (f.soloOficina && r.ubicacion !== 'oficina') return false;
      if (rangoDesde) {
        const d = new Date(r.fechaIngreso);
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (iso < rangoDesde) return false;
      }
      if (rangoHasta) {
        const d = new Date(r.fechaIngreso);
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (iso > rangoHasta) return false;
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
type ColDef = { label: string; value: (r: Router) => string; prioridad: 1 | 2 | 3 };

function getColumnas(): ColDef[] {
  switch (currentFilter) {
    case 'nuevo':
      return [
        { label: 'Serial', value: r => r.serial, prioridad: 1 },
        { label: 'Tipo', value: r => getTipoLabel(r.tipo), prioridad: 1 },
        { label: 'Fecha ingreso', value: r => formatDate(r.fechaIngreso), prioridad: 2 },
        { label: 'Ubicación', value: r => getUbicacionLabel(r.ubicacion), prioridad: 2 },
        { label: 'Lote', value: r => String(r.lote ?? '—'), prioridad: 3 },
        { label: 'Cliente', value: r => r.clienteActual ?? '—', prioridad: 3 },
        { label: 'Motivo', value: r => r.motivoUso ?? '—', prioridad: 3 },
        { label: 'Tecnología', value: r => r.tecnologia ?? '—', prioridad: 3 },
        { label: 'Técnico', value: r => r.tecnicoActual ?? '—', prioridad: 3 },
      ];
    case 'optimo':
      return [
        { label: 'Serial', value: r => r.serial, prioridad: 1 },
        { label: 'Tipo', value: r => getTipoLabel(r.tipo), prioridad: 1 },
        { label: 'Fecha ingreso', value: r => formatDate(r.fechaIngreso), prioridad: 2 },
        { label: 'Ubicación', value: r => getUbicacionLabel(r.ubicacion), prioridad: 2 },
        { label: 'Cliente', value: r => r.clienteActual ?? '—', prioridad: 3 },
        { label: 'Motivo', value: r => r.motivoUso ?? '—', prioridad: 3 },
        { label: 'Tecnología', value: r => r.tecnologia ?? '—', prioridad: 3 },
        { label: 'Técnico', value: r => r.tecnicoActual ?? '—', prioridad: 3 },
      ];
    case 'en_revision':
      return [
        { label: 'Serial', value: r => r.serial, prioridad: 1 },
        { label: 'Tipo', value: r => getTipoLabel(r.tipo), prioridad: 1 },
        { label: 'Fecha ingreso', value: r => formatDate(r.fechaIngreso), prioridad: 2 },
        { label: 'Motivo', value: r => motivosRetorno.get(r.serial) ?? '—', prioridad: 2 },
        { label: 'Cliente', value: r => r.clienteActual ?? '—', prioridad: 3 },
      ];
    default:
      return [];
  }
}

function renderTablaHead() {
  const head = document.querySelector<HTMLTableSectionElement>('#tabla-head')!;
  const cols = getColumnas();
  const puedeSeleccionarMultiple = currentFilter === 'nuevo' && agenciaActual === 'paraiso';

  const tr = document.createElement('tr');

  if (puedeSeleccionarMultiple) {
    const th = document.createElement('th');
    th.className = 'col-check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'check-all';
    th.append(cb);
    tr.append(th);
  }

  cols.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c.label;
    th.classList.add(`col-p${c.prioridad}`);
    tr.append(th);
  });

  head.replaceChildren(tr);

  const checkAll = document.getElementById('check-all') as HTMLInputElement | null;
  if (checkAll) {
    checkAll.addEventListener('change', () => {
      const page = paginatedRouters();
      if (checkAll.checked) page.forEach(r => seleccionMultiple.add(r.serial));
      else page.forEach(r => seleccionMultiple.delete(r.serial));
      renderTabla();
    });
  }
}

function renderTabla() {
  renderTablaHead();

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
  const cols = getColumnas();

  elTablaBody.replaceChildren(
    ...page.map(r => {
      const tr = document.createElement('tr');
      if (r.serial === selectedSerial) tr.classList.add('selected');

      if (puedeSeleccionarMultiple) {
        const tdCheck = document.createElement('td');
        tdCheck.className = 'col-check';
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
        tr.append(tdCheck);
      }

      cols.forEach(c => {
        const td = document.createElement('td');
        td.textContent = c.value(r);
        td.classList.add(`col-p${c.prioridad}`);
        tr.append(td);
      });

      tr.addEventListener('click', () => {
        selectedSerial = (selectedSerial === r.serial) ? null : r.serial;
        renderTabla();
        renderDetalle();
      });
      return tr;
    }),
  );

  const n = seleccionMultiple.size;
  if (n > 0) {
    elBarraMultiple.hidden = false;
    elMultiContador.textContent = `${n} seleccionado${n > 1 ? 's' : ''}`;
  } else {
    elBarraMultiple.hidden = true;
  }

  const checkAll = document.getElementById('check-all') as HTMLInputElement | null;
  if (checkAll) {
    checkAll.disabled = !puedeSeleccionarMultiple || page.length === 0;
    checkAll.checked = page.length > 0 && page.every(r => seleccionMultiple.has(r.serial));
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
    elFormDesasignar.hidden = true;
    elBtnDevolverParaiso.hidden = true;
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
    ${currentFilter === 'en_revision' ? `<div style="grid-column: 1 / -1;"><strong>Motivo:</strong> ${motivosRetorno.get(router.serial) ?? '—'}</div>` : ''}
  `;

  elBtnAsignarCliente.hidden = router.estado === 'en_revision';
  elFormDesasignar.hidden = router.ubicacion !== 'campo' || !!router.clienteActual;
  elAccInfo.hidden = false;
  elAccSalida.hidden = false;

  const esLomas = agenciaActual === 'lomas';
  const enOficina = router.ubicacion === 'oficina';
  const puedeDevolver = esLomas && enOficina;
  elBtnDevolverParaiso.hidden = !puedeDevolver;

  if (!puedeDevolver && modoDevolucion) {
    modoDevolucion = false;
    actualizarModoDevolucion();
  }

  const btnCopy = elDetalleInfo.querySelector<HTMLButtonElement>('.btn-copy');
  btnCopy?.addEventListener('click', async () => {
    const texto = btnCopy.dataset.copy ?? '';
    await navigator.clipboard.writeText(texto);
    btnCopy.classList.add('copiado');
    setTimeout(() => btnCopy.classList.remove('copiado'), 1000);
  });

  if (router.estado === 'en_revision') {
    elAccSalida.hidden = true;
    elFormRevision.hidden = false;
    elRevisionSerial.value = router.serial;
    elRevisionDetalle.value = '';
    setToday(elRevisionFecha);
  } else {
    elAccSalida.hidden = false;
    elFormSalida.hidden = false;   // ← importante, quitar el hidden
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
        ${enRevision ? '<span></span>' : `<span class="dot ${alertaClass}"></span>`}
        <span class="nombre">${getTipoLabel(s.tipo)}</span>
        <span class="num">${s.cantidad}</span>
      `;
      return div;
    }),
  );

  const total = stock.reduce((acc, s) => acc + s.cantidad, 0);
  document.getElementById('stock-total-num')!.textContent = String(total);
}

async function renderHistorialRevisiones() {
  const movs = await movRepo.getAll();
  motivosRetorno.clear();
  movs
    .filter(m => m.tipo === 'retorno' && m.motivo)
    .sort((a, b) => b.fecha - a.fecha)
    .forEach(m => {
      if (!motivosRetorno.has(m.routerSerial)) {
        motivosRetorno.set(m.routerSerial, m.motivo!);
      }
    });
  const revisiones = movs
    .filter(m => m.tipo === 'revision' || m.tipo === 'merma')
    .filter(m => histSearch === '' || m.routerSerial.toLowerCase().includes(histSearch))
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
      if (histRangoDesde) {
        const d = new Date(m.fecha);
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (iso < histRangoDesde) return false;
      }
      if (histRangoHasta) {
        const d = new Date(m.fecha);
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (iso > histRangoHasta) return false;
      }
      return true;
    })
    .sort((a, b) => b.fecha - a.fecha);

  if (currentFilter !== 'en_revision') {
    elAccHistorial.hidden = true;
    elHistorialDetalle.hidden = true;
    return;
  }

  elAccHistorial.hidden = false;

  histTotal = revisiones.length;
  const totalPages = Math.max(1, Math.ceil(histTotal / histPageSize));
  if (histPage > totalPages) histPage = totalPages;

  const start = (histPage - 1) * histPageSize;
  const page = revisiones.slice(start, start + histPageSize);

  elHistContador.textContent = `Mostrando ${page.length} de ${histTotal}`;
  elHistPagInfo.textContent = String(histPage);
  elHistPagPrev.disabled = histPage <= 1;
  elHistPagNext.disabled = histPage >= totalPages;

  const head = document.querySelector<HTMLTableSectionElement>('#historial-head')!;
  const colsHist = [
    { label: 'Serial', prioridad: 1 },
    { label: 'Tipo', prioridad: 1 },
    { label: 'Estado', prioridad: 1 },
    { label: 'Revisado el', prioridad: 2 },
    { label: 'Ingresado el', prioridad: 3 },
  ];
  head.replaceChildren(
    (() => {
      const tr = document.createElement('tr');
      colsHist.forEach(c => {
        const th = document.createElement('th');
        th.textContent = c.label;
        th.classList.add(`col-p${c.prioridad}`);
        tr.append(th);
      });
      return tr;
    })(),
  );

  elHistorialBody.replaceChildren(
    ...page.map(m => {
      const tr = document.createElement('tr');
      if (m.id === selectedMovId) tr.classList.add('selected');

      const mkTd = (texto: string, prioridad: 1 | 2 | 3) => {
        const td = document.createElement('td');
        td.textContent = texto;
        td.classList.add(`col-p${prioridad}`);
        return td;
      };

      tr.append(
        mkTd(m.routerSerial, 1),
        mkTd(m.routerTipo ? getTipoLabel(m.routerTipo) : '—', 1),
        mkTd(m.resultado === 'optimo' ? 'Revisado' : 'Merma', 1),
        mkTd(formatDate(m.fecha), 2),
        mkTd(m.fechaRetorno ? formatDate(m.fechaRetorno) : '—', 3),
      );

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

  const esLomas = agenciaActual === 'lomas';
  const enOficina = router.ubicacion === 'oficina';
  const puedeDevolver = esLomas && enOficina;

  elBtnDevolverParaiso.hidden = !puedeDevolver;
  if (!puedeDevolver && modoDevolucion) {
    modoDevolucion = false;
    actualizarModoDevolucion();
  }

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