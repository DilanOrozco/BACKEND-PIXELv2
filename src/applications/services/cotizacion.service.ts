import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";
import {
  validarActualizarCotizacion,
  validarCotizar,
  validarCrearCotizacion,
  validarSolicitudCliente,
} from "../validators/cotizacion.validator";

const cotizacionRepository = new CotizacionRepository();
const usuarioRepository = new UsuarioRepository();
const tecnicaRepository = new TecnicaRepository();

const ESTADO_SOLICITADA = "SOLICITADA";
const ESTADO_COTIZADA = "COTIZADA";
const ESTADO_APROBADA = "APROBADA";
const ESTADO_RECHAZADA = "RECHAZADA";
const ESTADO_ANULADA = "ANULADA";

const TIPO_NORMAL = "NORMAL";
const TIPO_RAPIDA = "RAPIDA";

const esCliente = (usuarioAuth: any) => usuarioAuth?.rol === "Cliente";

const validarId = (idCotizacion: number) => {
  if (!Number.isInteger(idCotizacion) || idCotizacion <= 0) {
    throw new Error("El ID de la cotizacion no es valido.");
  }
};

const aNumero = (valor: any) => Number(valor ?? 0);

const limpiarTextoOpcional = (valor: any) => {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto === "" ? null : texto;
};

const calcularSubtotalDetalle = (
  cantidad: number,
  precioUnitario: number,
  costoDiseno: number,
) => cantidad * precioUnitario + costoDiseno;

export class CotizacionService {
  private async asegurarClienteExiste(idCliente: number) {
    const cliente = await usuarioRepository.buscarPorId(idCliente);

    if (!cliente) {
      throw new Error("El cliente no existe.");
    }

    if (cliente.rol?.nombre !== "Cliente") {
      throw new Error("El usuario seleccionado debe tener rol Cliente.");
    }

    return cliente;
  }

  private async asegurarTecnicasExisten(detalles: any[]) {
    const idsTecnicas = [
      ...new Set(detalles.map((detalle) => Number(detalle.idTecnica))),
    ];

    for (const idTecnica of idsTecnicas) {
      const tecnica = await tecnicaRepository.buscarPorId(idTecnica);

      if (!tecnica) {
        throw new Error(`La tecnica con ID ${idTecnica} no existe.`);
      }
    }
  }

  private prepararDetallesSolicitud(detalles: any[], incluirIdDetalle = false) {
    return detalles.map((detalle) => {
      const detallePreparado: any = {
        idTecnica: Number(detalle.idTecnica),
        descripcion: detalle.descripcion.trim(),
        cantidad: Number(detalle.cantidad),
        precioUnitario: null,
        costoDiseno: null,
        subtotal: null,
        imagenReferencia: limpiarTextoOpcional(detalle.imagenReferencia),
        observaciones: limpiarTextoOpcional(detalle.observaciones),
      };

      if (incluirIdDetalle && detalle.idDetalleCotizacion) {
        detallePreparado.idDetalleCotizacion = Number(
          detalle.idDetalleCotizacion,
        );
      }

      return detallePreparado;
    });
  }

  private prepararDetallesConPrecios(detalles: any[]) {
    return detalles.map((detalle) => {
      const cantidad = Number(detalle.cantidad);
      const precioUnitario = Number(detalle.precioUnitario);
      const costoDiseno = Number(detalle.costoDiseno || 0);
      const subtotal = calcularSubtotalDetalle(
        cantidad,
        precioUnitario,
        costoDiseno,
      );

      return {
        idTecnica: Number(detalle.idTecnica),
        descripcion: detalle.descripcion.trim(),
        cantidad,
        precioUnitario,
        costoDiseno,
        subtotal,
        imagenReferencia: limpiarTextoOpcional(detalle.imagenReferencia),
        observaciones: limpiarTextoOpcional(detalle.observaciones),
      };
    });
  }

  // Cliente: crea una solicitud sin precios. El idCliente y creadoPorId salen
  // del token, por lo que el body no puede suplantar a otro cliente.
  async crearSolicitudCliente(data: any, usuarioAuth: any) {
    const error = validarSolicitudCliente(data);

    if (error) {
      throw new Error(error);
    }

    await this.asegurarClienteExiste(Number(usuarioAuth.idUsuario));
    await this.asegurarTecnicasExisten(data.detalles);

    const detalles = this.prepararDetallesSolicitud(data.detalles);

    return await cotizacionRepository.crearCotizacionConDetalles({
      idCliente: Number(usuarioAuth.idUsuario),
      creadoPorId: Number(usuarioAuth.idUsuario),
      tipoCotizacion: TIPO_NORMAL,
      estado: ESTADO_SOLICITADA,
      subtotal: 0,
      costosAdicionales: 0,
      total: 0,
      observaciones: limpiarTextoOpcional(data.observaciones),
      detalles,
    });
  }

  // Empleado: crea una solicitud presencial para un cliente elegido por la
  // empresa. Tambien inicia sin precios y queda lista para cotizar.
  async crearCotizacionNormal(data: any, usuarioAuth: any) {
    if (!data.idCliente) {
      throw new Error("El cliente es obligatorio.");
    }

    const error = validarSolicitudCliente(data);

    if (error) {
      throw new Error(error);
    }

    await this.asegurarClienteExiste(Number(data.idCliente));
    await this.asegurarTecnicasExisten(data.detalles);

    const detalles = this.prepararDetallesSolicitud(data.detalles);

    return await cotizacionRepository.crearCotizacionConDetalles({
      idCliente: Number(data.idCliente),
      creadoPorId: Number(usuarioAuth.idUsuario),
      tipoCotizacion: TIPO_NORMAL,
      estado: ESTADO_SOLICITADA,
      subtotal: 0,
      costosAdicionales: 0,
      total: 0,
      observaciones: limpiarTextoOpcional(data.observaciones),
      detalles,
    });
  }

  // Empleado: cotizacion presencial ya valorizada. Nace aprobada y deja un
  // marcador de pedido simulado hasta que exista el modulo de pedidos real.
  async crearCotizacionRapida(data: any, usuarioAuth: any) {
    const error = validarCrearCotizacion(data);

    if (error) {
      throw new Error(error);
    }

    await this.asegurarClienteExiste(Number(data.idCliente));
    await this.asegurarTecnicasExisten(data.detalles);

    const detalles = this.prepararDetallesConPrecios(data.detalles);
    const subtotal = detalles.reduce(
      (acc: number, item: any) => acc + item.subtotal,
      0,
    );
    const costosAdicionales = aNumero(data.costosAdicionales);
    const total = subtotal + costosAdicionales;

    const cotizacion = await cotizacionRepository.crearCotizacionConDetalles({
      idCliente: Number(data.idCliente),
      creadoPorId: Number(usuarioAuth.idUsuario),
      tipoCotizacion: TIPO_RAPIDA,
      estado: ESTADO_APROBADA,
      subtotal,
      costosAdicionales,
      total,
      observaciones: limpiarTextoOpcional(data.observaciones),
      detalles,
    });

    return {
      ...cotizacion,
      pedidoSimulado: {
        generado: true,
        mensaje: "Pedido simulado. El modulo de pedidos aun no esta implementado.",
      },
    };
  }

  async listarCotizaciones(usuarioAuth: any) {
    const cotizaciones = esCliente(usuarioAuth)
      ? await cotizacionRepository.listarPorCliente(Number(usuarioAuth.idUsuario))
      : await cotizacionRepository.listarCotizaciones();

    if (cotizaciones.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return cotizaciones;
  }

  async buscarPorId(idCotizacion: number, usuarioAuth: any) {
    validarId(idCotizacion);

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    if (esCliente(usuarioAuth) && cotizacion.idCliente !== usuarioAuth.idUsuario) {
      throw new Error("No tienes permisos para ver esta cotizacion.");
    }

    return cotizacion;
  }

  async buscarParcial(termino: string, usuarioAuth: any) {
    if (!termino || termino.trim() === "") {
      throw new Error("Debe ingresar un termino de busqueda.");
    }

    const resultados = await cotizacionRepository.buscarParcial(termino.trim());

    const cotizaciones = esCliente(usuarioAuth)
      ? resultados.filter(
          (item: any) => item.idCliente === Number(usuarioAuth.idUsuario),
        )
      : resultados;

    if (cotizaciones.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return cotizaciones;
  }

  // Cliente: puede editar su solicitud solo mientras siga SOLICITADA. Editar
  // significa ajustar el detalle existente; otra prenda requiere otra cotizacion.
  async editarSolicitudCliente(
    idCotizacion: number,
    data: any,
    usuarioAuth: any,
  ) {
    validarId(idCotizacion);

    const error = validarSolicitudCliente(data, {
      requiereDetalleExistente: true,
    });

    if (error) {
      throw new Error(error);
    }

    const cotizacion = await this.buscarPorId(idCotizacion, usuarioAuth);

    if (cotizacion.estado !== ESTADO_SOLICITADA) {
      throw new Error("Solo se pueden editar solicitudes en estado SOLICITADA.");
    }

    if (cotizacion.detalles.length !== 1) {
      throw new Error(
        "Esta solicitud no cumple la regla de un unico detalle por cotizacion.",
      );
    }

    const detalleActual = cotizacion.detalles[0];

    if (!detalleActual) {
      throw new Error("La cotizacion no tiene detalle para actualizar.");
    }

    const idDetalleActual = Number(detalleActual.idDetalleCotizacion);
    const idDetalleRecibido = Number(data.detalles[0].idDetalleCotizacion);

    if (idDetalleActual !== idDetalleRecibido) {
      throw new Error(
        "Solo puedes modificar el detalle existente de esta cotizacion.",
      );
    }

    await this.asegurarTecnicasExisten(data.detalles);

    const detalles = this.prepararDetallesSolicitud(data.detalles, true);

    return await cotizacionRepository.actualizarSolicitudCliente(
      idCotizacion,
      {
        observaciones: limpiarTextoOpcional(data.observaciones),
        subtotal: 0,
        costosAdicionales: 0,
        total: 0,
      },
      detalles,
    );
  }

  // Empleado: asigna precios al detalle existente y mueve la cotizacion de
  // SOLICITADA a COTIZADA.
  async cotizarCotizacion(idCotizacion: number, data: any) {
    validarId(idCotizacion);

    const error = validarCotizar(data);

    if (error) {
      throw new Error(error);
    }

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    if (cotizacion.estado !== ESTADO_SOLICITADA) {
      throw new Error("Solo se pueden cotizar solicitudes en estado SOLICITADA.");
    }

    if (cotizacion.detalles.length !== 1) {
      throw new Error(
        "Esta solicitud no cumple la regla de un unico detalle por cotizacion.",
      );
    }

    const idsActuales = new Set(
      cotizacion.detalles.map((detalle: any) => detalle.idDetalleCotizacion),
    );
    const idsRecibidos = new Set(
      data.detalles.map((detalle: any) =>
        Number(detalle.idDetalleCotizacion),
      ),
    );

    for (const idDetalle of idsActuales) {
      if (!idsRecibidos.has(idDetalle)) {
        throw new Error("Debe cotizar el detalle existente de la solicitud.");
      }
    }

    const detallesCotizados = data.detalles.map((detalle: any) => {
      const detalleActual = cotizacion.detalles.find(
        (item: any) =>
          item.idDetalleCotizacion === Number(detalle.idDetalleCotizacion),
      );

      if (!detalleActual) {
        throw new Error(
          `El detalle ${detalle.idDetalleCotizacion} no pertenece a esta cotizacion.`,
        );
      }

      const cantidad = Number(detalleActual.cantidad);
      const precioUnitario = Number(detalle.precioUnitario);
      const costoDiseno = Number(detalle.costoDiseno);
      const subtotal = calcularSubtotalDetalle(
        cantidad,
        precioUnitario,
        costoDiseno,
      );

      return {
        idDetalleCotizacion: Number(detalle.idDetalleCotizacion),
        precioUnitario,
        costoDiseno,
        subtotal,
        observaciones:
          detalle.observaciones !== undefined
            ? limpiarTextoOpcional(detalle.observaciones)
            : detalleActual.observaciones,
      };
    });

    const subtotal = detallesCotizados.reduce(
      (acc: number, item: any) => acc + item.subtotal,
      0,
    );
    const costosAdicionales = aNumero(data.costosAdicionales);
    const total = subtotal + costosAdicionales;

    return await cotizacionRepository.cotizarCotizacion(
      idCotizacion,
      {
        estado: ESTADO_COTIZADA,
        subtotal,
        costosAdicionales,
        total,
        observaciones: limpiarTextoOpcional(data.observaciones),
      },
      detallesCotizados,
    );
  }

  // Admin/Secretaria: actualizacion limitada. No cambia detalles ni estado.
  async actualizarCotizacion(idCotizacion: number, data: any) {
    validarId(idCotizacion);

    const error = validarActualizarCotizacion(data);

    if (error) {
      throw new Error(error);
    }

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    if (
      cotizacion.estado !== ESTADO_SOLICITADA &&
      cotizacion.estado !== ESTADO_COTIZADA
    ) {
      throw new Error(
        "Solo se pueden actualizar cotizaciones SOLICITADAS o COTIZADAS.",
      );
    }

    const dataActualizar: any = {};

    if (data.observaciones !== undefined) {
      dataActualizar.observaciones = limpiarTextoOpcional(data.observaciones);
    }

    if (data.costosAdicionales !== undefined) {
      const costosAdicionales = Number(data.costosAdicionales);

      dataActualizar.costosAdicionales = costosAdicionales;
      dataActualizar.total = aNumero(cotizacion.subtotal) + costosAdicionales;
    }

    return await cotizacionRepository.actualizarCotizacion(
      idCotizacion,
      dataActualizar,
    );
  }

  async anularCotizacion(idCotizacion: number, usuarioAuth: any) {
    const cotizacion = await this.buscarPorId(idCotizacion, usuarioAuth);

    if (cotizacion.estado !== ESTADO_SOLICITADA) {
      throw new Error("Solo se pueden anular solicitudes en estado SOLICITADA.");
    }

    return await cotizacionRepository.cambiarEstado(
      idCotizacion,
      ESTADO_ANULADA,
    );
  }

  async aprobarCotizacion(idCotizacion: number, usuarioAuth: any) {
    const cotizacion = await this.buscarPorId(idCotizacion, usuarioAuth);

    if (cotizacion.estado !== ESTADO_COTIZADA) {
      throw new Error("Solo se pueden aprobar cotizaciones en estado COTIZADA.");
    }

    return await cotizacionRepository.cambiarEstado(
      idCotizacion,
      ESTADO_APROBADA,
    );
  }

  async rechazarCotizacion(idCotizacion: number, usuarioAuth: any) {
    const cotizacion = await this.buscarPorId(idCotizacion, usuarioAuth);

    if (cotizacion.estado !== ESTADO_COTIZADA) {
      throw new Error("Solo se pueden rechazar cotizaciones en estado COTIZADA.");
    }

    return await cotizacionRepository.cambiarEstado(
      idCotizacion,
      ESTADO_RECHAZADA,
    );
  }
}
