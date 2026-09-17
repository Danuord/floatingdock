// src/domain/services/router-service.ts
import type { Router, TipoRouter, EstadoRouter } from '../entities/router';
import type { Movimiento, TipoMovimiento } from '../entities/movimiento';
import type { RouterRepository } from '../repositories/router-repository';
import type { MovimientoRepository } from '../repositories/movimiento-repository';

export class RouterService {
  constructor(
    private routers: RouterRepository,
    private movimientos: MovimientoRepository,
  ) {}

  private async registrar(
    tipo: TipoMovimiento,
    router: Router,
    usuario: string,
    extra: Partial<Movimiento> = {},
  ): Promise<void> {
    const mov: Movimiento = {
      id: crypto.randomUUID(),
      tipo,
      routerSerial: router.serial,
      routerTipo: router.tipo,
      fecha: Date.now(),
      usuario,
      ...extra,
    };
    await this.movimientos.save(mov);
  }

  /** Registrar un router nuevo que entra a bodega. */
  async registrarNuevo(params: {
    serial: string;
    tipo: TipoRouter;
    fabricante?: string;
    tecnologia?: string;
    lote?: string;
    usuario: string;
  }): Promise<Router> {
    const yaExiste = await this.routers.getBySerial(params.serial);
    if (yaExiste) throw new Error(`Serial ${params.serial} ya existe`);

    const ahora = Date.now();
    const router: Router = {
      id: crypto.randomUUID(),
      serial: params.serial,
      tipo: params.tipo,
      estado: 'nuevo',
      ubicacion: 'oficina',
      fabricante: params.fabricante,
      tecnologia: params.tecnologia,
      lote: params.lote,
      fechaIngreso: ahora,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
    await this.routers.save(router);
    await this.registrar('registro_nuevo', router, params.usuario);
    return router;
  }

  /** Registrar retorno de un router que vuelve del campo. */
  async registrarRetorno(params: {
    serial: string;
    tipo: TipoRouter;
    fabricante?: string;
    cliente: string;
    tecnico: string;
    motivo: string;
    destino: 'optimo' | 'a_revisar';
    usuario: string;
  }): Promise<Router> {
    const ahora = Date.now();
    let router = await this.routers.getBySerial(params.serial);

    const nuevoEstado: EstadoRouter =
      params.destino === 'optimo' ? 'optimo' : 'en_revision';

    if (router) {
      router.estado = nuevoEstado;
      router.ubicacion = 'oficina';
      router.clienteActual = params.cliente;
      router.tecnicoActual = params.tecnico;
      if (params.fabricante) router.fabricante = params.fabricante;
      router.actualizadoEn = ahora;
    } else {
      router = {
        id: crypto.randomUUID(),
        serial: params.serial,
        tipo: params.tipo,
        estado: nuevoEstado,
        ubicacion: 'oficina',
        fabricante: params.fabricante,
        clienteActual: params.cliente,
        tecnicoActual: params.tecnico,
        fechaIngreso: ahora,
        creadoEn: ahora,
        actualizadoEn: ahora,
      };
    }
    await this.routers.save(router);
    await this.registrar('retorno', router, params.usuario, {
      cliente: params.cliente,
      tecnico: params.tecnico,
      motivo: params.motivo,
      destino: params.destino,
    });
    return router;
  }

  /** Registrar salida: el técnico se lleva el router. */
  async registrarSalida(params: {
    serial: string;
    tecnico: string;
    motivo: string;
    usuario: string;
  }): Promise<Router> {
    const router = await this.routers.getBySerial(params.serial);
    if (!router) throw new Error(`Serial ${params.serial} no existe`);

    router.ubicacion = 'campo';
    router.tecnicoActual = params.tecnico;
    router.actualizadoEn = Date.now();
    await this.routers.save(router);
    await this.registrar('salida', router, params.usuario, {
      tecnico: params.tecnico,
      motivo: params.motivo,
    });
    return router;
  }

  /** Asignar cliente a un router que ya salió. */
  async asignarCliente(params: {
    serial: string;
    cliente: string;
    motivo: string;
    usuario: string;
  }): Promise<Router> {
    const router = await this.routers.getBySerial(params.serial);
    if (!router) throw new Error(`Serial ${params.serial} no existe`);

    router.clienteActual = params.cliente;
    router.actualizadoEn = Date.now();
    await this.routers.save(router);
    await this.registrar('asignacion_cliente', router, params.usuario, {
      cliente: params.cliente,
      motivo: params.motivo,
    });
    return router;
  }

  async desasignarTecnico(params: {
    serial: string;
    usuario: string;
  }): Promise<Router> {
    const router = await this.routers.getBySerial(params.serial);
    if (!router) throw new Error(`Serial ${params.serial} no existe`);

    const tecnicoSnapshot = router.tecnicoActual;
    const clienteSnapshot = router.clienteActual;

    router.ubicacion = 'oficina';
    router.tecnicoActual = undefined;
    router.clienteActual = undefined;
    router.actualizadoEn = Date.now();
    await this.routers.save(router);
    await this.registrar('desasignacion', router, params.usuario, {
      tecnico: tecnicoSnapshot,
      cliente: clienteSnapshot,
    });
    return router;
  }

  /** Registrar revisión: pasa de en_revision a optimo o dañado. */
  async registrarRevision(params: {
    serial: string;
    resultado: 'optimo' | 'merma';
    detalle?: string;
    nuevoTipo?: TipoRouter;
    usuario: string;
  }): Promise<Router> {
    const router = await this.routers.getBySerial(params.serial);
    if (!router) throw new Error(`Serial ${params.serial} no existe`);

    const clienteSnapshot = router.clienteActual;
    const tecnicoSnapshot = router.tecnicoActual;
    const tipoOriginal = router.tipo;

    const movs = await this.movimientos.getBySerial(params.serial);
    const ultimoRetorno = movs
      .filter(m => m.tipo === 'retorno')
      .sort((a, b) => b.fecha - a.fecha)[0];

    router.estado = params.resultado === 'optimo' ? 'optimo' : 'dañado';

    if (params.resultado === 'optimo') {
      router.clienteActual = undefined;
      router.tecnicoActual = undefined;
      if (params.nuevoTipo && params.nuevoTipo !== router.tipo) {
        router.tipo = params.nuevoTipo;
      }
    }

    router.actualizadoEn = Date.now();
    await this.routers.save(router);

    const tipo: TipoMovimiento = params.resultado === 'optimo' ? 'revision' : 'merma';
    await this.registrar(tipo, router, params.usuario, {
      routerTipo: tipoOriginal,
      detalle: params.detalle,
      resultado: params.resultado,
      cliente: clienteSnapshot,
      tecnico: tecnicoSnapshot,
      fechaRetorno: ultimoRetorno?.fecha,
    });
    return router;
  }
}