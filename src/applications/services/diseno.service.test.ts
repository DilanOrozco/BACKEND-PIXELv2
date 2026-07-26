import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "../../../generated/prisma/client";
import { DisenoService } from "./diseno.service";
import {
  DisenoRepository,
  evaluarCoberturaDisenos,
} from "../../infrastructure/repositories/diseno.repository";
import { AbonoService } from "./abono.service";
import { NotificationService } from "./notification.service";

const transaccionFake = async <T>(
  handler: (tx: Prisma.TransactionClient) => Promise<T>,
) => handler({} as Prisma.TransactionClient);

const clienteA = {
  idCliente: 10,
  nombre: "Cliente A",
  documento: null,
  correo: "clientea@pixel.test",
  telefono: "3000000001",
  direccion: null,
};

const clienteB = {
  ...clienteA,
  idCliente: 20,
  nombre: "Cliente B",
  correo: "clienteb@pixel.test",
};

const pedidoBase = {
  idPedido: 100,
  idCliente: 10,
  estadoPedido: "PENDIENTE",
  estadoPago: "ABONADO",
  total: 100000,
  totalPagado: 50000,
  saldoPendiente: 50000,
  detalles: [
    {
      idDetallePedido: 501,
      requiereDiseno: true,
    },
  ],
  cliente: clienteA,
};

const disenoBase = {
  idDiseno: 1,
  idPedido: 100,
  idDetallePedido: 501,
  idDisenador: null,
  archivoUrl: "https://pixel.test/diseno.png",
  descripcion: "Mockup camiseta",
  observaciones: null,
  estado: "ENVIADO",
  origenDiseno: "DISENADOR",
  medioRecepcion: null,
  recibidoPorId: null,
  fechaRecepcion: null,
  medioRespuestaCliente: null,
  observacionesCliente: null,
  fechaRespuestaCliente: null,
  respuestaRegistradaPorId: null,
  fechaCreacion: new Date("2026-01-01"),
  fechaActualizacion: new Date("2026-01-01"),
  fechaEnvio: new Date("2026-01-01"),
  fechaAprobacion: null,
  detallePedido: {
    idDetallePedido: 501,
    idPedido: 100,
    idProducto: 1,
    idTecnica: 1,
    descripcion: "Camiseta",
    cantidad: 12,
    precioUnitario: 26001,
    subtotal: 312012,
    requiereDiseno: true,
    observaciones: null,
    producto: { idProducto: 1, nombre: "Camiseta" },
    tecnica: { idTecnica: 1, nombre: "DTF" },
  },
  pedido: pedidoBase,
  respuestaRegistradaPor: null,
  disenador: null,
};

const pedidoCompleto = {
  ...pedidoBase,
  idCotizacion: 50,
  fechaCreacion: new Date("2026-01-01"),
  fechaEntregaEstimada: null,
  fechaFinalizado: null,
  fechaEntregado: null,
  observaciones: null,
  detalles: [],
  abonos: [],
  disenos: [],
};

const servicio = () => new DisenoService(transaccionFake);

test("DisenoService cliente aprueba diseno propio y permite avanzar a produccion", async (t) => {
  let dentroTransaccion = false;
  const transaccionControlada = async <T>(
    handler: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => {
    dentroTransaccion = true;
    const resultado = await handler({} as Prisma.TransactionClient);
    dentroTransaccion = false;
    return resultado;
  };
  t.mock.method(DisenoRepository.prototype, "buscarPorIdOperacion", async () => disenoBase);
  t.mock.method(DisenoRepository.prototype, "buscarPorId", async () => ({
    ...disenoBase,
    estado: "APROBADO",
  }));
  t.mock.method(
    DisenoRepository.prototype,
    "buscarDisenoAprobadoPorDetalle",
    async () => null,
  );
  t.mock.method(
    DisenoRepository.prototype,
    "todosDisenosRequeridosAprobados",
    async () => true,
  );
  const actualizarDisenoMock = t.mock.method(
    DisenoRepository.prototype,
    "actualizarDisenoOperacion",
    async (_idDiseno: number, data: Record<string, unknown>) => ({
      ...disenoBase,
      ...data,
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoCompleto",
    async () => {
      assert.equal(dentroTransaccion, false);
      return pedidoCompleto;
    },
  );
  const actualizarPedidoMock = t.mock.method(
    DisenoRepository.prototype,
    "actualizarEstadoPedido",
    async (_idPedido: number, estadoPedido: string) => ({
      ...pedidoCompleto,
      estadoPedido,
    }),
  );
  const notificacionMock = t.mock.method(
    NotificationService.prototype,
    "pedidoEnProduccion",
    async () => ({ event: "PEDIDO_EN_PRODUCCION", cliente: "enviado" }),
  );

  const resultado = await new DisenoService(transaccionControlada).aprobarDiseno(
    1,
    { idUsuario: 77, idCliente: 10, rol: "Cliente" },
    { observaciones: "Aprobado desde panel" },
  );

  const data = actualizarDisenoMock.mock.calls[0]?.arguments[1] as any;
  assert.ok(resultado.diseno);
  assert.equal(resultado.diseno.estado, "APROBADO");
  assert.equal(data.medioRespuestaCliente, "SISTEMA");
  assert.equal(data.observacionesCliente, "Aprobado desde panel");
  assert.equal(data.respuestaRegistradaPorId, null);
  assert.equal(actualizarPedidoMock.mock.calls.length, 1);
  assert.equal(resultado.pasoAProduccion, true);
  assert.equal(notificacionMock.mock.calls.length, 1);
  assert.equal(notificacionMock.mock.calls[0]?.arguments[0].idPedido, 100);
});

test("DisenoService cliente rechaza diseno propio con observacion", async (t) => {
  t.mock.method(DisenoRepository.prototype, "buscarPorIdOperacion", async () => disenoBase);
  t.mock.method(DisenoRepository.prototype, "buscarPorId", async () => ({
    ...disenoBase,
    estado: "RECHAZADO",
  }));
  const actualizarDisenoMock = t.mock.method(
    DisenoRepository.prototype,
    "actualizarDisenoOperacion",
    async (_idDiseno: number, data: Record<string, unknown>) => ({
      ...disenoBase,
      ...data,
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoCompleto",
    async () => pedidoCompleto,
  );
  const actualizarPedidoMock = t.mock.method(
    DisenoRepository.prototype,
    "actualizarEstadoPedido",
    async () => pedidoCompleto,
  );

  const resultado = await servicio().rechazarDiseno(
    1,
    { idUsuario: 77, idCliente: 10, rol: "Cliente" },
    {
      medioRespuesta: "SISTEMA",
      observacionesCliente: "Cambiar color del logo",
    },
  );

  const data = actualizarDisenoMock.mock.calls[0]?.arguments[1] as any;
  assert.ok(resultado.diseno);
  assert.equal(resultado.diseno.estado, "RECHAZADO");
  assert.equal(data.observacionesCliente, "Cambiar color del logo");
  assert.equal(data.medioRespuestaCliente, "SISTEMA");
  assert.equal(actualizarPedidoMock.mock.calls.length, 0);
});

test("DisenoService cliente no puede responder diseno ajeno", async (t) => {
  t.mock.method(DisenoRepository.prototype, "buscarPorIdOperacion", async () => ({
    ...disenoBase,
    pedido: {
      ...pedidoBase,
      idCliente: 20,
      cliente: clienteB,
    },
  }));
  const actualizarDisenoMock = t.mock.method(
    DisenoRepository.prototype,
    "actualizarDisenoOperacion",
    async () => disenoBase,
  );

  await assert.rejects(
    () =>
      servicio().aprobarDiseno(
        1,
        { idUsuario: 77, idCliente: 10, rol: "Cliente" },
        {},
      ),
    /No tienes permiso para responder este diseno/,
  );
  assert.equal(actualizarDisenoMock.mock.calls.length, 0);
});

test("DisenoService admin aprueba diseno en nombre del cliente", async (t) => {
  t.mock.method(DisenoRepository.prototype, "buscarPorIdOperacion", async () => disenoBase);
  t.mock.method(DisenoRepository.prototype, "buscarPorId", async () => ({
    ...disenoBase,
    estado: "APROBADO",
  }));
  t.mock.method(
    DisenoRepository.prototype,
    "buscarDisenoAprobadoPorDetalle",
    async () => null,
  );
  t.mock.method(
    DisenoRepository.prototype,
    "todosDisenosRequeridosAprobados",
    async () => true,
  );
  const notificacionMock = t.mock.method(
    NotificationService.prototype,
    "pedidoEnProduccion",
    async () => ({ event: "PEDIDO_EN_PRODUCCION", cliente: "enviado" }),
  );
  const actualizarDisenoMock = t.mock.method(
    DisenoRepository.prototype,
    "actualizarDisenoOperacion",
    async (_idDiseno: number, data: Record<string, unknown>) => ({
      ...disenoBase,
      ...data,
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoCompleto",
    async () => pedidoCompleto,
  );
  t.mock.method(
    DisenoRepository.prototype,
    "actualizarEstadoPedido",
    async (_idPedido: number, estadoPedido: string) => ({
      ...pedidoCompleto,
      estadoPedido,
    }),
  );

  await servicio().aprobarDiseno(
    1,
    { idUsuario: 99, rol: "Admin" },
    {
      medioAprobacion: "WHATSAPP",
      observaciones: "El cliente aprobo por WhatsApp",
    },
  );

  const data = actualizarDisenoMock.mock.calls[0]?.arguments[1] as any;
  assert.equal(data.estado, "APROBADO");
  assert.equal(data.medioRespuestaCliente, "WHATSAPP");
  assert.equal(data.respuestaRegistradaPorId, 99);
  assert.equal(notificacionMock.mock.calls.length, 1);
});

test("DisenoService admin rechaza diseno en nombre del cliente", async (t) => {
  t.mock.method(DisenoRepository.prototype, "buscarPorIdOperacion", async () => disenoBase);
  t.mock.method(DisenoRepository.prototype, "buscarPorId", async () => ({
    ...disenoBase,
    estado: "RECHAZADO",
  }));
  const actualizarDisenoMock = t.mock.method(
    DisenoRepository.prototype,
    "actualizarDisenoOperacion",
    async (_idDiseno: number, data: Record<string, unknown>) => ({
      ...disenoBase,
      ...data,
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoCompleto",
    async () => pedidoCompleto,
  );

  await servicio().rechazarDiseno(
    1,
    { idUsuario: 99, rol: "Admin" },
    {
      medioRespuesta: "LLAMADA",
      observacionesCliente: "Cliente pidio otro tamano",
    },
  );

  const data = actualizarDisenoMock.mock.calls[0]?.arguments[1] as any;
  assert.equal(data.estado, "RECHAZADO");
  assert.equal(data.medioRespuestaCliente, "LLAMADA");
  assert.equal(data.observacionesCliente, "Cliente pidio otro tamano");
  assert.equal(data.respuestaRegistradaPorId, 99);
});

test("DisenoService no usa idUsuario como idCliente para clientes", async (t) => {
  t.mock.method(DisenoRepository.prototype, "buscarPorIdOperacion", async () => disenoBase);
  const actualizarDisenoMock = t.mock.method(
    DisenoRepository.prototype,
    "actualizarDisenoOperacion",
    async () => disenoBase,
  );

  await assert.rejects(
    () => servicio().aprobarDiseno(1, { idUsuario: 10, rol: "Cliente" }, {}),
    /cliente vinculado/,
  );
  assert.equal(actualizarDisenoMock.mock.calls.length, 0);
});

test("DisenoService no aprueba dos veces el mismo diseno", async (t) => {
  t.mock.method(DisenoRepository.prototype, "buscarPorIdOperacion", async () => ({
    ...disenoBase,
    estado: "APROBADO",
  }));
  const actualizarDisenoMock = t.mock.method(
    DisenoRepository.prototype,
    "actualizarDisenoOperacion",
    async () => disenoBase,
  );

  await assert.rejects(
    () =>
      servicio().aprobarDiseno(
        1,
        { idUsuario: 99, rol: "Admin" },
        {},
      ),
    /Solo se pueden responder disenos pendientes o enviados/,
  );
  assert.equal(actualizarDisenoMock.mock.calls.length, 0);
});

test("DisenoService no reenvia correo de produccion si el pedido ya esta en proceso", async (t) => {
  t.mock.method(DisenoRepository.prototype, "buscarPorIdOperacion", async () => ({
    ...disenoBase,
    pedido: { ...pedidoBase, estadoPedido: "EN_PROCESO" },
  }));
  const notificacionMock = t.mock.method(
    NotificationService.prototype,
    "pedidoEnProduccion",
    async () => ({ event: "PEDIDO_EN_PRODUCCION", cliente: "enviado" }),
  );

  await assert.rejects(
    () => servicio().aprobarDiseno(1, { idUsuario: 99, rol: "Admin" }, {}),
    /pedido debe estar PENDIENTE/,
  );

  assert.equal(notificacionMock.mock.calls.length, 0);
});

test("DisenoService crea diseno de origen DISENADOR asignando disenador autenticado", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );
  t.mock.method(
    AbonoService.prototype,
    "pedidoTienePagoInicialValido",
    async () => true,
  );
  const crearMock = t.mock.method(
    DisenoRepository.prototype,
    "crearDiseno",
    async (data: any) => ({
      ...disenoBase,
      ...data,
    }),
  );
  const notificacionMock = t.mock.method(
    NotificationService.prototype,
    "disenoEnviadoParaRevision",
    async () => ({ event: "DISENO_ENVIADO_PARA_REVISION", cliente: "enviado" }),
  );

  const diseno = await servicio().crearDiseno(
    {
      idPedido: 100,
      archivoUrl: "https://pixel.test/diseno.png",
      origenDiseno: "DISENADOR",
    },
    { idUsuario: 55, rol: "Disenador" },
  );

  const data = crearMock.mock.calls[0]?.arguments[0] as any;
  assert.equal(data.idDetallePedido, 501);
  assert.equal(data.idDisenador, 55);
  assert.equal(data.origenDiseno, "DISENADOR");
  assert.equal(diseno.idPedido, 100);
  assert.equal(notificacionMock.mock.calls.length, 1);
});

test("DisenoService crea diseno de origen CLIENTE sin exigir disenador", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );
  t.mock.method(
    AbonoService.prototype,
    "pedidoTienePagoInicialValido",
    async () => true,
  );
  const crearMock = t.mock.method(
    DisenoRepository.prototype,
    "crearDiseno",
    async (data: any) => ({
      ...disenoBase,
      ...data,
    }),
  );
  const notificacionMock = t.mock.method(
    NotificationService.prototype,
    "disenoEnviadoParaRevision",
    async () => ({ event: "DISENO_ENVIADO_PARA_REVISION", cliente: "enviado" }),
  );

  await servicio().crearDiseno(
    {
      idPedido: 100,
      archivoUrl: "https://wa.me/mock-diseno.png",
      origenDiseno: "CLIENTE",
      medioRecepcion: "WHATSAPP",
      observacionesCliente: "El cliente envio el diseno por WhatsApp.",
    },
    { idUsuario: 99, rol: "Admin" },
  );

  const data = crearMock.mock.calls[0]?.arguments[0] as any;
  assert.equal(data.idDetallePedido, 501);
  assert.equal(data.idDisenador, null);
  assert.equal(data.origenDiseno, "CLIENTE");
  assert.equal(data.medioRecepcion, "WHATSAPP");
  assert.equal(data.recibidoPorId, 99);
  assert.ok(data.fechaRecepcion);
  assert.equal(notificacionMock.mock.calls.length, 1);
});

test("DisenoService exige archivo o descripcion suficiente para origen CLIENTE", async () => {
  await assert.rejects(
    () =>
      servicio().crearDiseno(
        {
          idPedido: 100,
          origenDiseno: "CLIENTE",
          descripcion: "abc",
        },
        { idUsuario: 99, rol: "Admin" },
      ),
    /debe incluir archivo\/link o una descripcion suficiente/,
  );
});

test("DisenoService admin puede crear diseno recibido por WhatsApp ya aprobado", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );
  t.mock.method(
    AbonoService.prototype,
    "pedidoTienePagoInicialValido",
    async () => true,
  );
  const crearMock = t.mock.method(
    DisenoRepository.prototype,
    "crearDiseno",
    async (data: any) => ({
      ...disenoBase,
      ...data,
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "todosDisenosRequeridosAprobados",
    async () => true,
  );
  const actualizarPedidoMock = t.mock.method(
    DisenoRepository.prototype,
    "actualizarEstadoPedido",
    async (_idPedido: number, estadoPedido: string) => ({
      ...pedidoCompleto,
      estadoPedido,
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoCompleto",
    async () => ({ ...pedidoCompleto, estadoPedido: "EN_PROCESO" }),
  );
  const notificacionMock = t.mock.method(
    NotificationService.prototype,
    "pedidoEnProduccion",
    async () => ({ event: "PEDIDO_EN_PRODUCCION", cliente: "enviado" }),
  );

  await servicio().crearDiseno(
    {
      idPedido: 100,
      archivoUrl: "https://wa.me/mock-diseno.png",
      origenDiseno: "CLIENTE",
      medioRecepcion: "WHATSAPP",
      estado: "APROBADO",
    },
    { idUsuario: 99, rol: "Admin" },
  );

  const data = crearMock.mock.calls[0]?.arguments[0] as any;
  assert.equal(data.estado, "APROBADO");
  assert.equal(data.medioRespuestaCliente, "WHATSAPP");
  assert.equal(data.respuestaRegistradaPorId, 99);
  assert.ok(data.fechaAprobacion);
  assert.equal(actualizarPedidoMock.mock.calls.length, 1);
  assert.equal(notificacionMock.mock.calls.length, 1);
});

test("DisenoService cliente puede ver diseno recibido por WhatsApp si es de su pedido", async (t) => {
  const listarMock = t.mock.method(
    DisenoRepository.prototype,
    "listarPorCliente",
    async () => [
      {
        ...disenoBase,
        origenDiseno: "CLIENTE",
        medioRecepcion: "WHATSAPP",
      },
    ],
  );

  const disenos = await servicio().listarDisenosCliente({
    idUsuario: 77,
    idCliente: 10,
    rol: "Cliente",
  });

  assert.equal(disenos.length, 1);
  assert.ok(disenos[0]);
  assert.equal(disenos[0].medioRecepcion, "WHATSAPP");
  assert.equal(disenos[0].detallePedido?.idDetallePedido, 501);
  assert.equal(disenos[0].detallePedido?.producto?.nombre, "Camiseta");
  assert.deepEqual(listarMock.mock.calls[0]?.arguments, [10]);
});

test("DisenoService modulo admin sigue listando disenos", async (t) => {
  const listarMock = t.mock.method(
    DisenoRepository.prototype,
    "listarDisenos",
    async () => [disenoBase],
  );

  const disenos = await servicio().listarDisenos({}, {
    idUsuario: 99,
    rol: "Admin",
  });

  assert.equal(disenos.length, 1);
  assert.deepEqual(listarMock.mock.calls[0]?.arguments, [{}, undefined]);
});

test("DisenoService aprobar un solo diseno multiproducto no pasa pedido a produccion", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPorIdOperacion",
    async () => ({
      ...disenoBase,
      idDetallePedido: 501,
      pedido: {
        ...pedidoBase,
        detalles: [
          { idDetallePedido: 501, requiereDiseno: true },
          { idDetallePedido: 502, requiereDiseno: true },
        ],
      },
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarDisenoAprobadoPorDetalle",
    async () => null,
  );
  t.mock.method(
    DisenoRepository.prototype,
    "actualizarDisenoOperacion",
    async (_id: number, data: any) => ({ ...disenoBase, ...data }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "todosDisenosRequeridosAprobados",
    async () => false,
  );
  const actualizarPedido = t.mock.method(
    DisenoRepository.prototype,
    "actualizarEstadoPedido",
    async () => pedidoCompleto,
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPorId",
    async () => ({ ...disenoBase, estado: "APROBADO" }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoCompleto",
    async () => pedidoCompleto,
  );
  const notificar = t.mock.method(
    NotificationService.prototype,
    "pedidoEnProduccion",
    async () => ({ event: "PEDIDO_EN_PRODUCCION", cliente: "enviado" }),
  );

  const resultado = await servicio().aprobarDiseno(
    1,
    { idUsuario: 99, rol: "Admin" },
    {},
  );

  assert.equal(resultado.pasoAProduccion, false);
  assert.equal(resultado.todosDisenosRequeridosAprobados, false);
  assert.equal(actualizarPedido.mock.calls.length, 0);
  assert.equal(notificar.mock.calls.length, 0);
});

test("DisenoService aprobar el ultimo diseno multiproducto pasa pedido a produccion", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPorIdOperacion",
    async () => ({
      ...disenoBase,
      idDiseno: 2,
      idDetallePedido: 502,
      pedido: {
        ...pedidoBase,
        detalles: [
          { idDetallePedido: 501, requiereDiseno: true },
          { idDetallePedido: 502, requiereDiseno: true },
        ],
      },
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarDisenoAprobadoPorDetalle",
    async () => null,
  );
  t.mock.method(
    DisenoRepository.prototype,
    "actualizarDisenoOperacion",
    async (_id: number, data: any) => ({
      ...disenoBase,
      idDiseno: 2,
      idDetallePedido: 502,
      ...data,
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "todosDisenosRequeridosAprobados",
    async () => true,
  );
  const actualizarPedido = t.mock.method(
    DisenoRepository.prototype,
    "actualizarEstadoPedido",
    async (_id: number, estadoPedido: string) => ({
      ...pedidoCompleto,
      estadoPedido,
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPorId",
    async () => ({
      ...disenoBase,
      idDiseno: 2,
      idDetallePedido: 502,
      estado: "APROBADO",
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoCompleto",
    async () => ({ ...pedidoCompleto, estadoPedido: "EN_PROCESO" }),
  );
  const notificar = t.mock.method(
    NotificationService.prototype,
    "pedidoEnProduccion",
    async () => ({ event: "PEDIDO_EN_PRODUCCION", cliente: "enviado" }),
  );

  const resultado = await servicio().aprobarDiseno(
    2,
    { idUsuario: 99, rol: "Admin" },
    {},
  );

  assert.equal(resultado.pasoAProduccion, true);
  assert.equal(resultado.todosDisenosRequeridosAprobados, true);
  assert.equal(actualizarPedido.mock.calls.length, 1);
  assert.equal(notificar.mock.calls.length, 1);
});

test("DisenoService asocia diseno al detalle seleccionado en pedido multiproducto", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => ({
      ...pedidoBase,
      detalles: [
        { idDetallePedido: 501, requiereDiseno: true },
        { idDetallePedido: 502, requiereDiseno: true },
      ],
    }),
  );
  t.mock.method(
    AbonoService.prototype,
    "pedidoTienePagoInicialValido",
    async () => true,
  );
  const crear = t.mock.method(
    DisenoRepository.prototype,
    "crearDiseno",
    async (data: any) => ({ ...disenoBase, ...data }),
  );

  const diseno = await servicio().crearDiseno(
    {
      idPedido: 100,
      idDetallePedido: 502,
      descripcion: "Diseno para el segundo producto",
      origenDiseno: "ADMIN",
    },
    { idUsuario: 99, rol: "Admin" },
  );

  assert.equal((crear.mock.calls[0]?.arguments[0] as any).idDetallePedido, 502);
  assert.equal(diseno.idDetallePedido, 502);
});

test("DisenoService no crea diseno para producto que no lo requiere", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => ({
      ...pedidoBase,
      detalles: [{ idDetallePedido: 501, requiereDiseno: false }],
      disenos: [],
    }),
  );
  const crear = t.mock.method(
    DisenoRepository.prototype,
    "crearDiseno",
    async () => disenoBase,
  );

  await assert.rejects(
    () =>
      servicio().crearDiseno(
        {
          idPedido: 100,
          idDetallePedido: 501,
          descripcion: "No deberia crearse",
        },
        { idUsuario: 99, rol: "Admin" },
      ),
    /no requiere diseno/,
  );
  assert.equal(crear.mock.calls.length, 0);
});

test("DisenoService no duplica diseno entregado por cliente ni diseno general", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => ({
      ...pedidoBase,
      detalles: [
        { idDetallePedido: 501, requiereDiseno: true },
        { idDetallePedido: 502, requiereDiseno: true },
      ],
      disenos: [
        {
          idDiseno: 20,
          idDetallePedido: null,
          esDisenoGeneral: true,
          estado: "ENVIADO",
          origenDiseno: "CLIENTE",
          archivoUrl: "https://pixel.test/general.png",
        },
      ],
    }),
  );
  const crear = t.mock.method(
    DisenoRepository.prototype,
    "crearDiseno",
    async () => disenoBase,
  );

  await assert.rejects(
    () =>
      servicio().crearDiseno(
        {
          idPedido: 100,
          idDetallePedido: 501,
          descripcion: "Duplicado",
        },
        { idUsuario: 99, rol: "Admin" },
      ),
    /ya tiene un diseno general/,
  );
  assert.equal(crear.mock.calls.length, 0);
});

test("cobertura de disenos exige todos los detalles y conserva compatibilidad legacy", () => {
  const detalles = [
    { idDetallePedido: 501 },
    { idDetallePedido: 502 },
  ];

  assert.equal(
    evaluarCoberturaDisenos(detalles, [
      { idDetallePedido: 501, esDisenoGeneral: false },
    ]),
    false,
  );
  assert.equal(
    evaluarCoberturaDisenos(detalles, [
      { idDetallePedido: 501, esDisenoGeneral: false },
      { idDetallePedido: 502, esDisenoGeneral: false },
    ]),
    true,
  );
  assert.equal(
    evaluarCoberturaDisenos(detalles, [
      { idDetallePedido: null, esDisenoGeneral: true },
    ]),
    true,
  );
  assert.equal(
    evaluarCoberturaDisenos(detalles, [
      { idDetallePedido: null, esDisenoGeneral: false },
    ]),
    false,
  );
  assert.equal(
    evaluarCoberturaDisenos(
      [{ idDetallePedido: 501 }],
      [{ idDetallePedido: null, esDisenoGeneral: false }],
    ),
    true,
  );
});
