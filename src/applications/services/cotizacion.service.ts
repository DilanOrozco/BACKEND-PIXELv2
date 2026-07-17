import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { PedidoService } from "./pedido.service";
import { NotificationService } from "./notification.service";
import {
  validarActualizarCotizacion,
  validarCotizar,
  validarSolicitudCliente,
} from "../validators/cotizacion.validator";
import {
  paginatedResponse,
  parsePaginationQuery,
  type PaginationQuery,
} from "../../utils/pagination.util";

const cotizacionRepository = new CotizacionRepository();
const clienteRepository = new ClienteRepository();
const tecnicaRepository = new TecnicaRepository();
const pedidoService = new PedidoService();
const notificationService = new NotificationService();

const ESTADO_PENDIENTE = "PENDIENTE";
const ESTADO_APROBADA = "APROBADA";
const ESTADO_ANULADA = "ANULADA";

const TIPO_NORMAL = "NORMAL";

const esCliente = (usuarioAuth: any) => usuarioAuth?.rol === "Cliente";
const idClienteAutenticado = (usuarioAuth: any) =>
  Number(usuarioAuth?.idCliente ?? usuarioAuth?.idUsuario);

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

const limpiarCorreo = (valor: any) => {
  const texto = limpiarTextoOpcional(valor);
  return texto ? texto.toLowerCase() : null;
};

const calcularSubtotalDetalle = (
  cantidad: number,
  precioUnitario: number,
  costoDiseno: number,
) => cantidad * precioUnitario + costoDiseno;

const detalleTienePrecios = (detalle: any) => {
  return (
    detalle.precioUnitario !== null &&
    detalle.precioUnitario !== undefined &&
    detalle.costoDiseno !== null &&
    detalle.costoDiseno !== undefined &&
    detalle.subtotal !== null &&
    detalle.subtotal !== undefined
  );
};

const cotizacionTienePrecios = (cotizacion: any) => {
  return cotizacion.detalles.length > 0 && cotizacion.detalles.every(detalleTienePrecios);
};

export class CotizacionService {
  private async asegurarClienteExiste(idCliente: number) {
    const cliente = await clienteRepository.buscarPorId(idCliente);

    if (!cliente) {
      throw new Error("El cliente no existe.");
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

  private async resolverClientePresencial(data: any) {
    if (data.idCliente) {
      const cliente = await this.asegurarClienteExiste(Number(data.idCliente));
      return cliente.idCliente;
    }

    const clienteEntrada = data.cliente;

    if (
      !clienteEntrada ||
      typeof clienteEntrada !== "object" ||
      Array.isArray(clienteEntrada)
    ) {
      throw new Error("Debes seleccionar o registrar los datos del cliente.");
    }

    if (
      typeof clienteEntrada.nombre !== "string" ||
      clienteEntrada.nombre.trim() === ""
    ) {
      throw new Error("El nombre del cliente es obligatorio.");
    }

    const correo = limpiarCorreo(clienteEntrada.correo);
    const telefono = limpiarTextoOpcional(clienteEntrada.telefono);

    if (!correo && !telefono) {
      throw new Error("Debes enviar correo o telefono del cliente.");
    }

    const clienteExistente =
      await clienteRepository.buscarPorCorreoOTelefono(correo, telefono);

    const cliente = clienteExistente
      ? await clienteRepository.actualizarCliente(clienteExistente.idCliente, {
          nombre: clienteEntrada.nombre.trim(),
          documento: limpiarTextoOpcional(clienteEntrada.documento),
          correo: correo ?? clienteExistente.correo,
          telefono: telefono ?? clienteExistente.telefono,
          direccion: limpiarTextoOpcional(clienteEntrada.direccion),
        })
      : await clienteRepository.crearCliente({
          nombre: clienteEntrada.nombre.trim(),
          documento: limpiarTextoOpcional(clienteEntrada.documento),
          correo,
          telefono,
          direccion: limpiarTextoOpcional(clienteEntrada.direccion),
        });

    return cliente.idCliente;
  }

  private validarDatosClientePresencial(data: any) {
    if (data.idCliente) {
      return;
    }

    const clienteEntrada = data.cliente;

    if (
      !clienteEntrada ||
      typeof clienteEntrada !== "object" ||
      Array.isArray(clienteEntrada)
    ) {
      throw new Error("Debes seleccionar o registrar los datos del cliente.");
    }

    if (
      typeof clienteEntrada.nombre !== "string" ||
      clienteEntrada.nombre.trim() === ""
    ) {
      throw new Error("El nombre del cliente es obligatorio.");
    }

    const correo = limpiarCorreo(clienteEntrada.correo);
    const telefono = limpiarTextoOpcional(clienteEntrada.telefono);

    if (!correo && !telefono) {
      throw new Error("Debes enviar correo o telefono del cliente.");
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

  // Cliente: crea una solicitud sin precios. El idCliente y creadoPorId salen
  // del token, por lo que el body no puede suplantar a otro cliente.
  async crearSolicitudCliente(data: any, usuarioAuth: any) {
    const error = validarSolicitudCliente(data);

    if (error) {
      throw new Error(error);
    }

    const idCliente = idClienteAutenticado(usuarioAuth);
    await this.asegurarClienteExiste(idCliente);
    await this.asegurarTecnicasExisten(data.detalles);

    const detalles = this.prepararDetallesSolicitud(data.detalles);

    return await cotizacionRepository.crearCotizacionConDetalles({
      idCliente,
      creadoPorId: Number(usuarioAuth.idUsuario),
      tipoCotizacion: TIPO_NORMAL,
      estado: ESTADO_PENDIENTE,
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
    const error = validarSolicitudCliente(data);

    if (error) {
      throw new Error(error);
    }

    this.validarDatosClientePresencial(data);

    let idCliente: number;

    if (data.idCliente) {
      idCliente = await this.resolverClientePresencial(data);
      await this.asegurarTecnicasExisten(data.detalles);
    } else {
      await this.asegurarTecnicasExisten(data.detalles);
      idCliente = await this.resolverClientePresencial(data);
    }

    const detalles = this.prepararDetallesSolicitud(data.detalles);

    return await cotizacionRepository.crearCotizacionConDetalles({
      idCliente,
      creadoPorId: Number(usuarioAuth.idUsuario),
      tipoCotizacion: TIPO_NORMAL,
      estado: ESTADO_PENDIENTE,
      subtotal: 0,
      costosAdicionales: 0,
      total: 0,
      observaciones: limpiarTextoOpcional(data.observaciones),
      detalles,
    });
  }

  async listarCotizaciones(usuarioAuth: any, query: PaginationQuery = {}) {
    const pagination = parsePaginationQuery(query, {
      defaultSortBy: "idCotizacion",
      allowedSortBy: ["idCotizacion", "fechaCreacion", "total", "estado"],
      maxLimit: 10,
    });
    const filtros = esCliente(usuarioAuth)
      ? { idCliente: idClienteAutenticado(usuarioAuth) }
      : {};

    if (pagination.isPaginated) {
      const resultado = await cotizacionRepository.listarCotizacionesPaginado(
        filtros,
        pagination,
      );

      return paginatedResponse(resultado.data, pagination, resultado.total);
    }

    const cotizaciones = esCliente(usuarioAuth)
      ? await cotizacionRepository.listarPorCliente(idClienteAutenticado(usuarioAuth))
      : await cotizacionRepository.listarCotizaciones();

    if (cotizaciones.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return { data: cotizaciones };
  }

  async buscarPorId(idCotizacion: number, usuarioAuth: any) {
    validarId(idCotizacion);

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    if (esCliente(usuarioAuth) && cotizacion.idCliente !== idClienteAutenticado(usuarioAuth)) {
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
          (item: any) => item.idCliente === idClienteAutenticado(usuarioAuth),
        )
      : resultados;

    if (cotizaciones.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return cotizaciones;
  }

  // Cliente: puede editar su solicitud mientras siga pendiente y aun no tenga
  // precios asignados. Otra prenda requiere otra cotizacion.
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

    if (cotizacion.estado !== ESTADO_PENDIENTE) {
      throw new Error("Solo se pueden editar cotizaciones en estado PENDIENTE.");
    }

    if (cotizacionTienePrecios(cotizacion)) {
      throw new Error(
        "No se puede editar una cotizacion que ya tiene precios asignados.",
      );
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

  // Empleado: asigna precios al detalle existente. La cotizacion permanece
  // PENDIENTE hasta que el cliente o la empresa la apruebe o la anule.
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

    if (cotizacion.estado !== ESTADO_PENDIENTE) {
      throw new Error("Solo se pueden cotizar solicitudes en estado PENDIENTE.");
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
        estado: ESTADO_PENDIENTE,
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

    if (cotizacion.estado !== ESTADO_PENDIENTE) {
      throw new Error("Solo se pueden actualizar cotizaciones en estado PENDIENTE.");
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

    if (cotizacion.estado !== ESTADO_PENDIENTE) {
      throw new Error("Solo se pueden anular cotizaciones en estado PENDIENTE.");
    }

    return await cotizacionRepository.cambiarEstado(
      idCotizacion,
      ESTADO_ANULADA,
    );
  }

  async aprobarCotizacion(idCotizacion: number, usuarioAuth: any) {
    const cotizacion = await this.buscarPorId(idCotizacion, usuarioAuth);

    if (cotizacion.estado !== ESTADO_PENDIENTE) {
      throw new Error("Solo se pueden aprobar cotizaciones en estado PENDIENTE.");
    }

    if (!cotizacionTienePrecios(cotizacion)) {
      throw new Error(
        "Solo se pueden aprobar cotizaciones con precios asignados.",
      );
    }

    const pedidoData = pedidoService.prepararPedidoDesdeCotizacion(
      cotizacion,
      {
        observaciones: `Pedido creado automaticamente al aprobar la cotizacion #${idCotizacion}.`,
      },
      usuarioAuth,
      "Creacion automatica de pedido",
    );

    const resultado = await cotizacionRepository.aprobarYCrearPedido(
      idCotizacion,
      ESTADO_APROBADA,
      pedidoData,
    );

    await notificationService.pedidoCreadoDesdeCotizacion(resultado.pedido);

    return {
      ...resultado,
      pedido: pedidoService.formatearPedido(resultado.pedido),
    };
  }

  async eliminarCotizacion(idCotizacion: number) {
    validarId(idCotizacion);

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    await cotizacionRepository.eliminarCotizacion(idCotizacion);

    return cotizacion;
  }

}
