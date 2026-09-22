import assert from "node:assert/strict";
import test from "node:test";
import { CompraRepository } from "../../infrastructure/repositories/compra.repository";
import { CompraService } from "./compra.service";

const admin = { idUsuario: 1, rol: "Admin" };
const secretaria = { idUsuario: 2, rol: "Secretaria" };
const disenador = { idUsuario: 3, rol: "Diseñador" };
const cliente = { idUsuario: 4, rol: "Cliente" };

const compraPendiente = {
  idCompra: 10,
  idPedido: 20,
  idProveedor: 30,
  compradoPorId: 1,
  estado: "PENDIENTE",
  total: 25000,
  fechaCompra: new Date("2026-09-01T12:00:00.000Z"),
  observaciones: "Inicial",
  proveedor: { idProveedor: 30, nombre: "Textiles" },
  compradoPor: { idUsuario: 1, nombre: "Admin" },
  pedido: {
    idPedido: 20,
    estadoPedido: "EN_PROCESO",
    estadoPago: "PARCIAL",
    cliente: {
      idCliente: 5,
      nombre: "Cliente",
      correo: "cliente@pixel.test",
      telefono: "3000000000",
    },
  },
  detalles: [
    {
      idDetalleCompra: 40,
      descripcionInsumo: "Tela",
      cantidad: 2,
      costoUnitario: 12500,
      subtotal: 25000,
    },
  ],
};

const datosCompra = {
  idPedido: "20",
  idProveedor: "30",
  observaciones: "  Compra urgente  ",
  detalles: [
    { descripcionInsumo: " Tela ", cantidad: "2", costoUnitario: "12500.126" },
    { descripcionInsumo: "Hilo", cantidad: 3, costoUnitario: 1000 },
  ],
};

test("CompraService crea una compra calculando subtotales y total en backend", async (t) => {
  t.mock.method(CompraRepository.prototype, "buscarPedidoPorId", async () => ({
    idPedido: 20,
    estadoPedido: "EN_PROCESO",
  }) as any);
  t.mock.method(CompraRepository.prototype, "buscarProveedorPorId", async () => ({
    idProveedor: 30,
    estado: true,
  }) as any);
  const crear = t.mock.method(
    CompraRepository.prototype,
    "crearCompra",
    async (data: any) => ({ idCompra: 10, ...data }) as any,
  );

  await new CompraService().crearCompra(
    { ...datosCompra, confirmar: true },
    admin,
  );

  assert.deepEqual(crear.mock.calls[0]?.arguments[0], {
    idPedido: 20,
    idProveedor: 30,
    compradoPorId: 1,
    estado: "COMPRADA",
    total: 28000.26,
    observaciones: "Compra urgente",
    detalles: [
      {
        descripcionInsumo: "Tela",
        cantidad: 2,
        costoUnitario: 12500.13,
        subtotal: 25000.26,
      },
      {
        descripcionInsumo: "Hilo",
        cantidad: 3,
        costoUnitario: 1000,
        subtotal: 3000,
      },
    ],
  });
});

test("CompraService valida autenticacion, permisos, pedido y proveedor al crear", async (t) => {
  let pedido: any = null;
  let proveedor: any = null;
  t.mock.method(
    CompraRepository.prototype,
    "buscarPedidoPorId",
    async () => pedido,
  );
  t.mock.method(
    CompraRepository.prototype,
    "buscarProveedorPorId",
    async () => proveedor,
  );
  const service = new CompraService();

  await assert.rejects(() => service.crearCompra(datosCompra, undefined), /no autenticado/i);
  await assert.rejects(() => service.crearCompra(datosCompra, disenador), /permisos/i);
  await assert.rejects(
    () => service.crearCompra({ ...datosCompra, detalles: [] }, admin),
    /al menos un detalle/i,
  );
  await assert.rejects(() => service.crearCompra(datosCompra, admin), /Pedido no encontrado/i);

  pedido = { estadoPedido: "FINALIZADO" };
  await assert.rejects(() => service.crearCompra(datosCompra, admin), /pedidos finalizados/i);

  pedido = { estadoPedido: "EN_PROCESO" };
  await assert.rejects(() => service.crearCompra(datosCompra, admin), /Proveedor no encontrado/i);

  proveedor = { estado: false };
  await assert.rejects(() => service.crearCompra(datosCompra, admin), /proveedor esta inactivo/i);
});

test("CompraService filtra listados y oculta costos al diseñador", async (t) => {
  let compras: any[] = [compraPendiente];
  const listar = t.mock.method(
    CompraRepository.prototype,
    "listarCompras",
    async () => compras as any,
  );
  const service = new CompraService();
  const resultado = await service.listarCompras(
    {
      idPedido: "20",
      idProveedor: "30",
      estado: "PENDIENTE",
      compradoPorId: "1",
      desde: "2026-09-01",
      hasta: "2026-09-30",
    },
    disenador,
  );
  const filtros = listar.mock.calls[0]?.arguments[0] as any;

  assert.equal(filtros.idPedido, 20);
  assert.equal(filtros.idProveedor, 30);
  assert.equal(filtros.compradoPorId, 1);
  assert.equal(filtros.desde.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(filtros.hasta.toISOString(), "2026-09-30T23:59:59.999Z");
  assert.equal("total" in resultado[0]!, false);
  assert.equal("costoUnitario" in resultado[0]!.detalles![0]!, false);
  assert.equal(resultado[0]!.pedido?.cliente?.idCliente, 5);

  await assert.rejects(() => service.listarCompras({}, disenador), /solo puede consultar compras por pedido/i);
  await assert.rejects(() => service.listarCompras({}, cliente), /permiso/i);
  await assert.rejects(() => service.listarCompras({ estado: "OTRA" }, admin), /estado de la compra/i);

  compras = [];
  await assert.rejects(() => service.listarCompras({}, admin), /No se encontraron resultados/i);
});

test("CompraService consulta por pedido e id con validaciones de existencia", async (t) => {
  let pedido: any = { idPedido: 20, estadoPedido: "EN_PROCESO" };
  let compra: any = compraPendiente;
  t.mock.method(CompraRepository.prototype, "buscarPedidoPorId", async () => pedido);
  t.mock.method(
    CompraRepository.prototype,
    "listarPorPedido",
    async () => [compraPendiente] as any,
  );
  t.mock.method(CompraRepository.prototype, "buscarPorId", async () => compra);
  const service = new CompraService();

  const listado = await service.listarPorPedido(20, disenador);
  assert.equal("total" in listado[0]!, false);
  assert.equal((await service.buscarPorId(10, admin)).total, 25000);

  await assert.rejects(() => service.listarPorPedido(0, admin), /ID del pedido/i);
  await assert.rejects(() => service.buscarPorId(Number.NaN, admin), /ID de la compra/i);
  pedido = null;
  await assert.rejects(() => service.listarPorPedido(20, admin), /Pedido no encontrado/i);
  compra = null;
  await assert.rejects(() => service.buscarPorId(10, admin), /Compra no encontrada/i);
});

test("CompraService actualiza solo compras pendientes y recalcula detalles", async (t) => {
  let compra: any = compraPendiente;
  t.mock.method(CompraRepository.prototype, "buscarPorId", async () => compra);
  t.mock.method(CompraRepository.prototype, "buscarProveedorPorId", async () => ({
    idProveedor: 31,
    estado: true,
  }) as any);
  const actualizar = t.mock.method(
    CompraRepository.prototype,
    "actualizarCompra",
    async (_id: number, data: any) => ({ ...compraPendiente, ...data }) as any,
  );
  const service = new CompraService();

  await service.actualizarCompra(
    10,
    {
      idProveedor: "31",
      observaciones: "  Actualizada ",
      detalles: [{ descripcionInsumo: "Tela", cantidad: 2, costoUnitario: 5000 }],
    },
    secretaria,
  );

  assert.deepEqual(actualizar.mock.calls[0]?.arguments[1], {
    idProveedor: 31,
    observaciones: "Actualizada",
    detalles: [
      {
        descripcionInsumo: "Tela",
        cantidad: 2,
        costoUnitario: 5000,
        subtotal: 10000,
      },
    ],
    total: 10000,
  });

  compra = { ...compraPendiente, estado: "COMPRADA" };
  await assert.rejects(
    () => service.actualizarCompra(10, { observaciones: null }, admin),
    /solo se pueden actualizar compras pendientes/i,
  );
});

test("CompraService confirma, anula, elimina y resume compras pendientes", async (t) => {
  let compra: any = compraPendiente;
  t.mock.method(CompraRepository.prototype, "buscarPorId", async () => compra);
  const confirmar = t.mock.method(
    CompraRepository.prototype,
    "confirmarCompra",
    async () => ({ ...compraPendiente, estado: "COMPRADA" }) as any,
  );
  const anular = t.mock.method(
    CompraRepository.prototype,
    "anularCompra",
    async (_id: number, observaciones: string | null) => ({
      ...compraPendiente,
      estado: "ANULADA",
      observaciones,
    }) as any,
  );
  const eliminar = t.mock.method(
    CompraRepository.prototype,
    "eliminarCompra",
    async () => compraPendiente as any,
  );
  const resumen = t.mock.method(
    CompraRepository.prototype,
    "obtenerResumen",
    async () => ({ totalCompras: 25000, cantidadCompras: 1 }) as any,
  );
  const service = new CompraService();

  await service.confirmarCompra(10, admin);
  await service.anularCompra(10, { observaciones: " Error del proveedor " }, secretaria);
  await service.eliminarCompra(10, admin);
  await service.obtenerResumen({ idPedido: "20", desde: "2026-09-01" }, admin);

  assert.equal(confirmar.mock.callCount(), 1);
  assert.match(anular.mock.calls[0]?.arguments[1] ?? "", /Anulacion de compra \(Secretaria #2\): Error del proveedor/);
  assert.equal(eliminar.mock.callCount(), 1);
  assert.equal((resumen.mock.calls[0]?.arguments[0] as any).idPedido, 20);

  compra = { ...compraPendiente, estado: "COMPRADA" };
  await assert.rejects(() => service.confirmarCompra(10, admin), /compras pendientes/i);
  await assert.rejects(() => service.anularCompra(10, {}, admin), /compras pendientes/i);
  await assert.rejects(() => service.eliminarCompra(10, admin), /compras pendientes/i);
});
