import { prisma } from "../../config/prisma";
import {
  DELETION_IMPACT_RECORD_LIMIT,
  type DeletionImpactAction,
  type DeletionImpactGroup,
  type DeletionImpactOptions,
  type DeletionImpactRecord,
} from "../../utils/deletion-impact.util";

export type DeletionImpactResource =
  | "usuario"
  | "cliente"
  | "cotizacion"
  | "tecnica"
  | "producto"
  | "categoriaProducto"
  | "compra"
  | "tarifaTecnica"
  | "abono"
  | "diseno"
  | "proveedor";

type ImpactGroupInput = Omit<DeletionImpactGroup, "registrosOmitidos">;

export type DeletionImpactRepositoryResult = {
  existe: boolean;
  groups: ImpactGroupInput[];
  options?: DeletionImpactOptions | undefined;
};

const cargarGrupo = async <T>(
  tipo: string,
  accion: DeletionImpactAction,
  cantidadPromise: Promise<number>,
  registrosPromise: Promise<T[]>,
  presentar: (registro: T) => DeletionImpactRecord,
): Promise<ImpactGroupInput> => {
  const [cantidad, registros] = await Promise.all([
    cantidadPromise,
    registrosPromise,
  ]);

  return {
    tipo,
    accion,
    cantidad,
    registros: registros.map(presentar),
  };
};

const nombreNumerado = (tipo: string, id: number) => `${tipo} #${id}`;

export class DeletionImpactRepository {
  async obtener(resource: DeletionImpactResource, id: number) {
    switch (resource) {
      case "usuario":
        return await this.obtenerUsuario(id);
      case "cliente":
        return await this.obtenerCliente(id);
      case "cotizacion":
        return await this.obtenerCotizacion(id);
      case "tecnica":
        return await this.obtenerTecnica(id);
      case "producto":
        return await this.obtenerProducto(id);
      case "categoriaProducto":
        return await this.obtenerCategoriaProducto(id);
      case "compra":
        return await this.obtenerCompra(id);
      case "tarifaTecnica":
        return await this.obtenerTarifaTecnica(id);
      case "abono":
        return await this.obtenerAbono(id);
      case "diseno":
        return await this.obtenerDiseno(id);
      case "proveedor":
        return await this.obtenerProveedor(id);
    }
  }

  private async obtenerUsuario(idUsuario: number): Promise<DeletionImpactRepositoryResult> {
    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario },
      select: { idUsuario: true },
    });
    if (!usuario) return { existe: false, groups: [] };

    const disenosWhere = {
      OR: [
        { idDisenador: idUsuario },
        { respuestaRegistradaPorId: idUsuario },
        { recibidoPorId: idUsuario },
      ],
    };
    const abonosWhere = {
      OR: [
        { confirmadoPorId: idUsuario },
        { rechazadoPorId: idUsuario },
        { corregidoPorId: idUsuario },
      ],
    };

    const groups = await Promise.all([
      cargarGrupo(
        "Tokens de recuperacion de contrasena",
        "ELIMINAR",
        prisma.passwordResetToken.count({ where: { idUsuario } }),
        prisma.passwordResetToken.findMany({
          where: { idUsuario },
          select: { idPasswordResetToken: true },
          orderBy: { idPasswordResetToken: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({
          id: item.idPasswordResetToken,
          nombre: nombreNumerado("Token", item.idPasswordResetToken),
        }),
      ),
      cargarGrupo(
        "Cliente vinculado",
        "DESVINCULAR",
        prisma.cliente.count({ where: { idUsuario } }),
        prisma.cliente.findMany({
          where: { idUsuario },
          select: { idCliente: true, nombre: true },
          orderBy: { idCliente: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idCliente, nombre: item.nombre }),
      ),
      cargarGrupo(
        "Cotizaciones gestionadas",
        "DESVINCULAR",
        prisma.cotizacion.count({ where: { creadoPorId: idUsuario } }),
        prisma.cotizacion.findMany({
          where: { creadoPorId: idUsuario },
          select: { idCotizacion: true },
          orderBy: { idCotizacion: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({
          id: item.idCotizacion,
          nombre: nombreNumerado("Cotizacion", item.idCotizacion),
        }),
      ),
      cargarGrupo(
        "Abonos gestionados",
        "DESVINCULAR",
        prisma.abonos.count({ where: abonosWhere }),
        prisma.abonos.findMany({
          where: abonosWhere,
          select: { idAbono: true },
          orderBy: { idAbono: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idAbono, nombre: nombreNumerado("Abono", item.idAbono) }),
      ),
      cargarGrupo(
        "Disenos gestionados",
        "DESVINCULAR",
        prisma.diseno.count({ where: disenosWhere }),
        prisma.diseno.findMany({
          where: disenosWhere,
          select: { idDiseno: true, descripcion: true },
          orderBy: { idDiseno: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({
          id: item.idDiseno,
          nombre: item.descripcion || nombreNumerado("Diseno", item.idDiseno),
        }),
      ),
      cargarGrupo(
        "Compras registradas",
        "DESVINCULAR",
        prisma.compra.count({ where: { compradoPorId: idUsuario } }),
        prisma.compra.findMany({
          where: { compradoPorId: idUsuario },
          select: { idCompra: true },
          orderBy: { idCompra: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idCompra, nombre: nombreNumerado("Compra", item.idCompra) }),
      ),
      cargarGrupo(
        "Respuestas de cotizacion registradas",
        "DESVINCULAR",
        prisma.cotizacionRespuesta.count({ where: { idUsuarioInterno: idUsuario } }),
        prisma.cotizacionRespuesta.findMany({
          where: { idUsuarioInterno: idUsuario },
          select: { idRespuesta: true },
          orderBy: { idRespuesta: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({
          id: item.idRespuesta,
          nombre: nombreNumerado("Respuesta", item.idRespuesta),
        }),
      ),
    ]);

    return { existe: true, groups };
  }

  private async obtenerCliente(idCliente: number): Promise<DeletionImpactRepositoryResult> {
    const cliente = await prisma.cliente.findUnique({
      where: { idCliente },
      select: { idCliente: true },
    });
    if (!cliente) return { existe: false, groups: [] };

    const cotizacionWhere = { idCliente };
    const pedidoWhere = { idCliente };
    const groups = await Promise.all([
      cargarGrupo(
        "Cotizaciones",
        "ELIMINAR",
        prisma.cotizacion.count({ where: cotizacionWhere }),
        prisma.cotizacion.findMany({
          where: cotizacionWhere,
          select: { idCotizacion: true },
          orderBy: { idCotizacion: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idCotizacion, nombre: nombreNumerado("Cotizacion", item.idCotizacion) }),
      ),
      cargarGrupo(
        "Detalles de cotizacion",
        "ELIMINAR",
        prisma.detalleCotizacion.count({ where: { cotizacion: cotizacionWhere } }),
        prisma.detalleCotizacion.findMany({
          where: { cotizacion: cotizacionWhere },
          select: { idDetalleCotizacion: true, descripcion: true },
          orderBy: { idDetalleCotizacion: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetalleCotizacion, nombre: item.descripcion }),
      ),
      cargarGrupo(
        "Versiones de cotizacion",
        "ELIMINAR",
        prisma.cotizacionVersion.count({ where: { cotizacion: cotizacionWhere } }),
        prisma.cotizacionVersion.findMany({
          where: { cotizacion: cotizacionWhere },
          select: { idVersion: true, numeroVersion: true },
          orderBy: { idVersion: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idVersion, nombre: `Propuesta #${item.numeroVersion}` }),
      ),
      cargarGrupo(
        "Respuestas de cotizacion",
        "ELIMINAR",
        prisma.cotizacionRespuesta.count({ where: { cotizacion: cotizacionWhere } }),
        prisma.cotizacionRespuesta.findMany({
          where: { cotizacion: cotizacionWhere },
          select: { idRespuesta: true },
          orderBy: { idRespuesta: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idRespuesta, nombre: nombreNumerado("Respuesta", item.idRespuesta) }),
      ),
      ...this.cargarGruposPedido(pedidoWhere),
    ]);
    const totalDirecto = groups
      .filter((group) => group.tipo === "Cotizaciones" || group.tipo === "Pedidos")
      .reduce((total, group) => total + group.cantidad, 0);

    return {
      existe: true,
      groups,
      options: totalDirecto > 0
        ? {
            puedeEliminar: false,
            motivoBloqueo:
              "El cliente tiene cotizaciones o pedidos relacionados. Debe desactivarse para conservar la trazabilidad.",
          }
        : undefined,
    };
  }

  private cargarGruposPedido(pedidoWhere: { idCliente: number } | { idCotizacion: number }) {
    return [
      cargarGrupo(
        "Pedidos",
        "ELIMINAR",
        prisma.pedido.count({ where: pedidoWhere }),
        prisma.pedido.findMany({
          where: pedidoWhere,
          select: { idPedido: true },
          orderBy: { idPedido: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idPedido, nombre: nombreNumerado("Pedido", item.idPedido) }),
      ),
      cargarGrupo(
        "Detalles de pedido",
        "ELIMINAR",
        prisma.detallePedido.count({ where: { pedido: pedidoWhere } }),
        prisma.detallePedido.findMany({
          where: { pedido: pedidoWhere },
          select: { idDetallePedido: true, descripcion: true },
          orderBy: { idDetallePedido: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetallePedido, nombre: item.descripcion }),
      ),
      cargarGrupo(
        "Estampados de pedido",
        "ELIMINAR",
        prisma.detalleEstampadoPedido.count({ where: { detallePedido: { pedido: pedidoWhere } } }),
        prisma.detalleEstampadoPedido.findMany({
          where: { detallePedido: { pedido: pedidoWhere } },
          select: { idDetalleEstampadoPedido: true, ubicacion: true },
          orderBy: { idDetalleEstampadoPedido: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetalleEstampadoPedido, nombre: item.ubicacion }),
      ),
      cargarGrupo(
        "Abonos",
        "ELIMINAR",
        prisma.abonos.count({ where: { pedido: pedidoWhere } }),
        prisma.abonos.findMany({
          where: { pedido: pedidoWhere },
          select: { idAbono: true },
          orderBy: { idAbono: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idAbono, nombre: nombreNumerado("Abono", item.idAbono) }),
      ),
      cargarGrupo(
        "Disenos",
        "ELIMINAR",
        prisma.diseno.count({ where: { pedido: pedidoWhere } }),
        prisma.diseno.findMany({
          where: { pedido: pedidoWhere },
          select: { idDiseno: true, descripcion: true },
          orderBy: { idDiseno: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDiseno, nombre: item.descripcion || nombreNumerado("Diseno", item.idDiseno) }),
      ),
      cargarGrupo(
        "Compras",
        "ELIMINAR",
        prisma.compra.count({ where: { pedido: pedidoWhere } }),
        prisma.compra.findMany({
          where: { pedido: pedidoWhere },
          select: { idCompra: true },
          orderBy: { idCompra: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idCompra, nombre: nombreNumerado("Compra", item.idCompra) }),
      ),
      cargarGrupo(
        "Detalles de compra",
        "ELIMINAR",
        prisma.detalleCompra.count({ where: { compra: { pedido: pedidoWhere } } }),
        prisma.detalleCompra.findMany({
          where: { compra: { pedido: pedidoWhere } },
          select: { idDetalleCompra: true, descripcionInsumo: true },
          orderBy: { idDetalleCompra: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetalleCompra, nombre: item.descripcionInsumo }),
      ),
      cargarGrupo(
        "Ventas",
        "ELIMINAR",
        prisma.venta.count({ where: { pedido: pedidoWhere } }),
        prisma.venta.findMany({
          where: { pedido: pedidoWhere },
          select: { idVenta: true },
          orderBy: { idVenta: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idVenta, nombre: nombreNumerado("Venta", item.idVenta) }),
      ),
    ];
  }

  private async obtenerCotizacion(idCotizacion: number): Promise<DeletionImpactRepositoryResult> {
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { idCotizacion },
      select: { idCotizacion: true },
    });
    if (!cotizacion) return { existe: false, groups: [] };

    const cotizacionWhere = { idCotizacion };
    const groups = await Promise.all([
      cargarGrupo(
        "Detalles de cotizacion",
        "ELIMINAR",
        prisma.detalleCotizacion.count({ where: { idCotizacion } }),
        prisma.detalleCotizacion.findMany({
          where: { idCotizacion },
          select: { idDetalleCotizacion: true, descripcion: true },
          orderBy: { idDetalleCotizacion: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetalleCotizacion, nombre: item.descripcion }),
      ),
      cargarGrupo(
        "Estampados de cotizacion",
        "ELIMINAR",
        prisma.detalleEstampadoCotizacion.count({ where: { detalleCotizacion: cotizacionWhere } }),
        prisma.detalleEstampadoCotizacion.findMany({
          where: { detalleCotizacion: cotizacionWhere },
          select: { idDetalleEstampadoCotizacion: true, ubicacion: true },
          orderBy: { idDetalleEstampadoCotizacion: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetalleEstampadoCotizacion, nombre: item.ubicacion }),
      ),
      cargarGrupo(
        "Versiones de cotizacion",
        "ELIMINAR",
        prisma.cotizacionVersion.count({ where: { idCotizacion } }),
        prisma.cotizacionVersion.findMany({
          where: { idCotizacion },
          select: { idVersion: true, numeroVersion: true },
          orderBy: { idVersion: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idVersion, nombre: `Propuesta #${item.numeroVersion}` }),
      ),
      cargarGrupo(
        "Respuestas de cotizacion",
        "ELIMINAR",
        prisma.cotizacionRespuesta.count({ where: { idCotizacion } }),
        prisma.cotizacionRespuesta.findMany({
          where: { idCotizacion },
          select: { idRespuesta: true },
          orderBy: { idRespuesta: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idRespuesta, nombre: nombreNumerado("Respuesta", item.idRespuesta) }),
      ),
      ...this.cargarGruposPedido({ idCotizacion }),
    ]);
    const pedidos = groups.find((group) => group.tipo === "Pedidos")?.cantidad ?? 0;

    return {
      existe: true,
      groups,
      options: pedidos > 0
        ? {
            puedeEliminar: false,
            motivoBloqueo:
              "La cotizacion ya fue convertida en pedido. Su eliminacion comprometeria la trazabilidad comercial, financiera y de produccion.",
          }
        : undefined,
    };
  }

  private async obtenerTecnica(idTecnica: number): Promise<DeletionImpactRepositoryResult> {
    const tecnica = await prisma.tecnica.findUnique({
      where: { idTecnica },
      select: { idTecnica: true },
    });
    if (!tecnica) return { existe: false, groups: [] };

    const estampadosCotizacionWhere = {
      OR: [{ idTecnica }, { tarifaAplicada: { idTecnica } }],
    };
    const groups = await Promise.all([
      cargarGrupo(
        "Tarifas tecnicas",
        "ELIMINAR",
        prisma.tarifaTecnica.count({ where: { idTecnica } }),
        prisma.tarifaTecnica.findMany({
          where: { idTecnica },
          select: { idTarifa: true, nombre: true },
          orderBy: { idTarifa: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idTarifa, nombre: item.nombre }),
      ),
      cargarGrupo(
        "Descuentos tecnicos legacy",
        "ELIMINAR",
        prisma.descuentoTecnica.count({ where: { idTecnica } }),
        prisma.descuentoTecnica.findMany({
          where: { idTecnica },
          select: { idDescuento: true, cantidadMinima: true },
          orderBy: { idDescuento: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDescuento, nombre: `Desde ${item.cantidadMinima} unidades` }),
      ),
      cargarGrupo(
        "Detalles de cotizacion",
        "DESVINCULAR",
        prisma.detalleCotizacion.count({ where: { idTecnica } }),
        prisma.detalleCotizacion.findMany({
          where: { idTecnica },
          select: { idDetalleCotizacion: true, descripcion: true },
          orderBy: { idDetalleCotizacion: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetalleCotizacion, nombre: item.descripcion }),
      ),
      cargarGrupo(
        "Estampados de cotizacion",
        "DESVINCULAR",
        prisma.detalleEstampadoCotizacion.count({ where: estampadosCotizacionWhere }),
        prisma.detalleEstampadoCotizacion.findMany({
          where: estampadosCotizacionWhere,
          select: { idDetalleEstampadoCotizacion: true, ubicacion: true },
          orderBy: { idDetalleEstampadoCotizacion: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetalleEstampadoCotizacion, nombre: item.ubicacion }),
      ),
      cargarGrupo(
        "Detalles de pedido",
        "DESVINCULAR",
        prisma.detallePedido.count({ where: { idTecnica } }),
        prisma.detallePedido.findMany({
          where: { idTecnica },
          select: { idDetallePedido: true, descripcion: true },
          orderBy: { idDetallePedido: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetallePedido, nombre: item.descripcion }),
      ),
      cargarGrupo(
        "Estampados de pedido",
        "DESVINCULAR",
        prisma.detalleEstampadoPedido.count({ where: { idTecnica } }),
        prisma.detalleEstampadoPedido.findMany({
          where: { idTecnica },
          select: { idDetalleEstampadoPedido: true, ubicacion: true },
          orderBy: { idDetalleEstampadoPedido: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetalleEstampadoPedido, nombre: item.ubicacion }),
      ),
    ]);

    return { existe: true, groups };
  }

  private async obtenerProducto(idProducto: number): Promise<DeletionImpactRepositoryResult> {
    const producto = await prisma.productoCotizable.findUnique({
      where: { idProducto },
      select: { idProducto: true },
    });
    if (!producto) return { existe: false, groups: [] };

    const detallesCotizacionWhere = {
      OR: [{ idProducto }, { rangoDescuentoAplicado: { idProducto } }],
    };
    const groups = await Promise.all([
      cargarGrupo(
        "Rangos de descuento legacy",
        "ELIMINAR",
        prisma.precioProductoRango.count({ where: { idProducto } }),
        prisma.precioProductoRango.findMany({
          where: { idProducto },
          select: { idRango: true, cantidadMin: true },
          orderBy: { idRango: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idRango, nombre: `Desde ${item.cantidadMin} unidades` }),
      ),
      cargarGrupo(
        "Detalles de cotizacion",
        "DESVINCULAR",
        prisma.detalleCotizacion.count({ where: detallesCotizacionWhere }),
        prisma.detalleCotizacion.findMany({
          where: detallesCotizacionWhere,
          select: { idDetalleCotizacion: true, descripcion: true },
          orderBy: { idDetalleCotizacion: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetalleCotizacion, nombre: item.descripcion }),
      ),
      cargarGrupo(
        "Detalles de pedido",
        "DESVINCULAR",
        prisma.detallePedido.count({ where: { idProducto } }),
        prisma.detallePedido.findMany({
          where: { idProducto },
          select: { idDetallePedido: true, descripcion: true },
          orderBy: { idDetallePedido: "asc" },
          take: DELETION_IMPACT_RECORD_LIMIT,
        }),
        (item) => ({ id: item.idDetallePedido, nombre: item.descripcion }),
      ),
    ]);

    return { existe: true, groups };
  }

  private async obtenerCategoriaProducto(idCategoriaProducto: number): Promise<DeletionImpactRepositoryResult> {
    const categoria = await prisma.categoriaProducto.findUnique({
      where: { idCategoriaProducto },
      select: { idCategoriaProducto: true },
    });
    if (!categoria) return { existe: false, groups: [] };

    const productos = await cargarGrupo(
      "Productos cotizables",
      "DESVINCULAR",
      prisma.productoCotizable.count({ where: { idCategoriaProducto } }),
      prisma.productoCotizable.findMany({
        where: { idCategoriaProducto },
        select: { idProducto: true, nombre: true },
        orderBy: { idProducto: "asc" },
        take: DELETION_IMPACT_RECORD_LIMIT,
      }),
      (item) => ({ id: item.idProducto, nombre: item.nombre }),
    );

    return {
      existe: true,
      groups: [productos],
      options: productos.cantidad > 0
        ? {
            puedeEliminar: false,
            motivoBloqueo:
              "La categoria tiene productos asociados. Debe desactivarse para conservar la clasificacion existente.",
          }
        : undefined,
    };
  }

  private async obtenerCompra(idCompra: number): Promise<DeletionImpactRepositoryResult> {
    const compra = await prisma.compra.findUnique({
      where: { idCompra },
      select: { idCompra: true, estado: true },
    });
    if (!compra) return { existe: false, groups: [] };

    const detalles = await cargarGrupo(
      "Detalles de compra",
      "ELIMINAR",
      prisma.detalleCompra.count({ where: { idCompra } }),
      prisma.detalleCompra.findMany({
        where: { idCompra },
        select: { idDetalleCompra: true, descripcionInsumo: true },
        orderBy: { idDetalleCompra: "asc" },
        take: DELETION_IMPACT_RECORD_LIMIT,
      }),
      (item) => ({ id: item.idDetalleCompra, nombre: item.descripcionInsumo }),
    );
    const puedeEliminar = compra.estado === "PENDIENTE";

    return {
      existe: true,
      groups: [detalles],
      options: puedeEliminar
        ? undefined
        : {
            puedeEliminar: false,
            motivoBloqueo:
              "Solo se pueden eliminar compras pendientes. Las compras confirmadas o anuladas se conservan como historial.",
          },
    };
  }

  private async obtenerTarifaTecnica(idTarifa: number): Promise<DeletionImpactRepositoryResult> {
    const tarifa = await prisma.tarifaTecnica.findUnique({
      where: { idTarifa },
      select: { idTarifa: true },
    });
    if (!tarifa) return { existe: false, groups: [] };

    const estampados = await cargarGrupo(
      "Estampados de cotizacion",
      "DESVINCULAR",
      prisma.detalleEstampadoCotizacion.count({ where: { idTarifaAplicada: idTarifa } }),
      prisma.detalleEstampadoCotizacion.findMany({
        where: { idTarifaAplicada: idTarifa },
        select: { idDetalleEstampadoCotizacion: true, ubicacion: true },
        orderBy: { idDetalleEstampadoCotizacion: "asc" },
        take: DELETION_IMPACT_RECORD_LIMIT,
      }),
      (item) => ({ id: item.idDetalleEstampadoCotizacion, nombre: item.ubicacion }),
    );

    return { existe: true, groups: [estampados] };
  }

  private async obtenerAbono(idAbono: number): Promise<DeletionImpactRepositoryResult> {
    const abono = await prisma.abonos.findUnique({
      where: { idAbono },
      select: { idAbono: true, estado: true },
    });
    if (!abono) return { existe: false, groups: [] };

    return {
      existe: true,
      groups: [],
      options: abono.estado === "PENDIENTE"
        ? undefined
        : {
            puedeEliminar: false,
            motivoBloqueo:
              "Solo se pueden eliminar abonos pendientes. Los abonos revisados se conservan como historial financiero.",
          },
    };
  }

  private async obtenerDiseno(idDiseno: number): Promise<DeletionImpactRepositoryResult> {
    const diseno = await prisma.diseno.findUnique({
      where: { idDiseno },
      select: { idDiseno: true, estado: true },
    });
    if (!diseno) return { existe: false, groups: [] };

    const bloqueado = diseno.estado === "APROBADO" || diseno.estado === "RECHAZADO";
    return {
      existe: true,
      groups: [],
      options: bloqueado
        ? {
            puedeEliminar: false,
            motivoBloqueo:
              "Los disenos aprobados o rechazados se conservan como historial del pedido.",
          }
        : undefined,
    };
  }

  private async obtenerProveedor(idProveedor: number): Promise<DeletionImpactRepositoryResult> {
    const proveedor = await prisma.proveedor.findUnique({
      where: { idProveedor },
      select: { idProveedor: true },
    });
    if (!proveedor) return { existe: false, groups: [] };

    const cantidadCompras = await prisma.compra.count({ where: { idProveedor } });
    return {
      existe: true,
      groups: [],
      options: cantidadCompras > 0
        ? {
            puedeEliminar: false,
            motivoBloqueo: `El proveedor tiene ${cantidadCompras} compra(s) asociada(s). La relacion restringe la eliminacion; desactive el proveedor en su lugar.`,
          }
        : undefined,
    };
  }
}
