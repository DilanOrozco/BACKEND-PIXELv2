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
import {
  CloudinaryDesignStorageService,
  DesignFileStorageError,
  type DesignUploadFile,
} from "./cloudinary-design-storage.service";

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
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidosParaRequerimientos",
    async () => [pedidoBase],
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
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidosParaRequerimientos",
    async () => [pedidoBase],
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

test("DisenoService crea disenos distintos para estampados del mismo producto", async (t) => {
  const pedido = {
    ...pedidoBase,
    detalles: [
      {
        idDetallePedido: 501,
        requiereDiseno: true,
        origenDiseno: "PIXEL",
        estampados: [
          {
            idDetalleEstampadoPedido: 601,
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: null,
          },
          {
            idDetalleEstampadoPedido: 602,
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: null,
          },
        ],
      },
    ],
    disenos: [
      {
        idDiseno: 30,
        idDetallePedido: 501,
        idDetalleEstampadoPedido: 601,
        esDisenoGeneral: false,
        estado: "ENVIADO",
      },
    ],
  };
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedido,
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

  await servicio().crearDiseno(
    {
      idPedido: 100,
      tipoObjetivo: "ESTAMPADO",
      idEstampadoPedido: 602,
      descripcion: "Diseno de manga",
    },
    { idUsuario: 99, rol: "Admin" },
  );

  const data = crear.mock.calls[0]?.arguments[0] as any;
  assert.equal(data.idDetallePedido, 501);
  assert.equal(data.idDetalleEstampadoPedido, 602);
  assert.equal(data.esDisenoGeneral, false);
  assert.equal(data.origenDiseno, "PIXEL");
});

test("DisenoService bloquea dos objetivos simultaneos", async () => {
  await assert.rejects(
    () =>
      servicio().crearDiseno(
        {
          idPedido: 100,
          tipoObjetivo: "ESTAMPADO",
          idEstampadoPedido: 601,
          grupoDisenoCompartido: "LOGO-1",
        },
        { idUsuario: 99, rol: "Admin" },
      ),
    /no puede usar otro objetivo simultaneamente/,
  );
});

test("DisenoService permite cargar version corregida del mismo estampado", async (t) => {
  const pedido = {
    ...pedidoBase,
    detalles: [
      {
        idDetallePedido: 501,
        requiereDiseno: true,
        origenDiseno: "PIXEL",
        estampados: [
          {
            idDetalleEstampadoPedido: 601,
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: null,
          },
        ],
      },
    ],
    disenos: [
      {
        idDiseno: 30,
        idDetallePedido: 501,
        idDetalleEstampadoPedido: 601,
        esDisenoGeneral: false,
        estado: "RECHAZADO",
      },
    ],
  };
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedido,
  );
  t.mock.method(
    AbonoService.prototype,
    "pedidoTienePagoInicialValido",
    async () => true,
  );
  const crear = t.mock.method(
    DisenoRepository.prototype,
    "crearDiseno",
    async (data: any) => ({ ...disenoBase, idDiseno: 31, ...data }),
  );
  t.mock.method(
    NotificationService.prototype,
    "disenoEnviadoParaRevision",
    async () => ({
      event: "DISENO_ENVIADO_PARA_REVISION",
      cliente: "enviado",
    }),
  );

  const corregido = await servicio().crearDiseno(
    {
      idPedido: 100,
      tipoObjetivo: "ESTAMPADO",
      idDetalleEstampadoPedido: 601,
      archivoUrl: "https://pixel.test/correccion.png",
    },
    { idUsuario: 99, rol: "Admin" },
  );

  assert.equal(crear.mock.calls.length, 1);
  assert.equal(corregido.idDiseno, 31);
  assert.equal(corregido.idDetalleEstampadoPedido, 601);
});

const pedidoConOrigenPendiente = () => ({
  ...pedidoBase,
  detalles: [
    {
      idDetallePedido: 501,
      requiereDiseno: true,
      origenDiseno: "PENDIENTE_DEFINIR",
      esDisenoGeneral: false,
      estampados: [
        {
          idDetalleEstampadoPedido: 601,
          origenDiseno: "PENDIENTE_DEFINIR",
          grupoDisenoCompartido: null,
        },
        {
          idDetalleEstampadoPedido: 602,
          origenDiseno: "PENDIENTE_DEFINIR",
          grupoDisenoCompartido: "LOGO-1",
        },
      ],
    },
    {
      idDetallePedido: 502,
      requiereDiseno: true,
      origenDiseno: "PENDIENTE_DEFINIR",
      esDisenoGeneral: false,
      estampados: [
        {
          idDetalleEstampadoPedido: 603,
          origenDiseno: "PENDIENTE_DEFINIR",
          grupoDisenoCompartido: "LOGO-1",
        },
      ],
    },
    {
      idDetallePedido: 503,
      requiereDiseno: true,
      origenDiseno: "PENDIENTE_DEFINIR",
      esDisenoGeneral: true,
      estampados: [
        {
          idDetalleEstampadoPedido: 604,
          origenDiseno: "PENDIENTE_DEFINIR",
          grupoDisenoCompartido: null,
        },
      ],
    },
    {
      idDetallePedido: 504,
      requiereDiseno: true,
      origenDiseno: "PENDIENTE_DEFINIR",
      esDisenoGeneral: false,
      estampados: [],
    },
  ],
  disenos: [],
});

const actualizarOrigenFixture = (
  pedido: ReturnType<typeof pedidoConOrigenPendiente>,
  idRequerimiento: string,
  origen: "CLIENTE" | "PIXEL",
) => {
  const copia = structuredClone(pedido);
  if (idRequerimiento === "STAMP-601") {
    copia.detalles[0]!.estampados[0]!.origenDiseno = origen;
  } else if (idRequerimiento === "GROUP-LOGO-1") {
    copia.detalles[0]!.estampados[1]!.origenDiseno = origen;
    copia.detalles[1]!.estampados[0]!.origenDiseno = origen;
  } else if (idRequerimiento === "PRODUCT-503") {
    copia.detalles[2]!.origenDiseno = origen;
    copia.detalles[2]!.estampados[0]!.origenDiseno = origen;
  } else {
    copia.detalles[3]!.origenDiseno = origen;
  }
  return copia;
};

for (const caso of [
  { id: "STAMP-601", origen: "PIXEL" as const },
  { id: "GROUP-LOGO-1", origen: "CLIENTE" as const },
  { id: "PRODUCT-503", origen: "PIXEL" as const },
  { id: "LEGACY-504", origen: "CLIENTE" as const },
]) {
  test(`DisenoService define origen para ${caso.id} sin crear diseno`, async (t) => {
    const inicial = pedidoConOrigenPendiente();
    const actualizado = actualizarOrigenFixture(
      inicial,
      caso.id,
      caso.origen,
    );
    let lecturas = 0;
    t.mock.method(
      DisenoRepository.prototype,
      "buscarPedidoPorId",
      async () => (lecturas++ === 0 ? inicial : actualizado),
    );
    const actualizarDetalle = t.mock.method(
      DisenoRepository.prototype,
      "actualizarOrigenDetallePedido",
      async (idDetallePedido: number) => ({ idDetallePedido }),
    );
    const actualizarEstampados = t.mock.method(
      DisenoRepository.prototype,
      "actualizarOrigenEstampadosPedido",
      async (ids: number[]) => ({ count: ids.length }),
    );
    const crear = t.mock.method(
      DisenoRepository.prototype,
      "crearDiseno",
      async () => disenoBase,
    );

    const resultado = await servicio().definirOrigenRequerimiento(
      100,
      caso.id,
      { origenDiseno: caso.origen },
      { idUsuario: 99, rol: "Admin" },
    );

    assert.equal(resultado.origenDiseno, caso.origen);
    assert.equal(
      resultado.estadoCoberturaDiseno,
      caso.origen === "CLIENTE"
        ? "PENDIENTE_RECEPCION_CLIENTE"
        : "PENDIENTE_CREACION_PIXEL",
    );
    assert.equal(crear.mock.calls.length, 0);
    assert.equal(
      actualizarDetalle.mock.calls.length +
        actualizarEstampados.mock.calls.length >
        0,
      true,
    );
  });
}

test("DisenoService no redefine un origen ya resuelto", async (t) => {
  const pedido = pedidoConOrigenPendiente();
  pedido.detalles[0]!.estampados[0]!.origenDiseno = "PIXEL";
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedido,
  );
  const actualizar = t.mock.method(
    DisenoRepository.prototype,
    "actualizarOrigenEstampadosPedido",
    async () => ({ count: 1 }),
  );

  await assert.rejects(
    () =>
      servicio().definirOrigenRequerimiento(
        100,
        "STAMP-601",
        { origenDiseno: "CLIENTE" },
        { idUsuario: 99, rol: "Admin" },
      ),
    /ya fue definido/,
  );
  assert.equal(actualizar.mock.calls.length, 0);
});

const agregarDisenoRecibidoFixture = (
  pedido: ReturnType<typeof pedidoConOrigenPendiente>,
  idRequerimiento: string,
) => {
  const copia = structuredClone(pedido);
  const base = {
    idDiseno: 90,
    idPedido: 100,
    idDetallePedido: null as number | null,
    idDetalleEstampadoPedido: null as number | null,
    grupoDisenoCompartido: null as string | null,
    esDisenoGeneral: false,
    estado: "ENVIADO",
    origenDiseno: "CLIENTE",
    archivoUrl: "https://pixel.test/cliente.png",
  };
  if (idRequerimiento === "STAMP-601") {
    base.idDetallePedido = 501;
    base.idDetalleEstampadoPedido = 601;
  } else if (idRequerimiento === "GROUP-LOGO-1") {
    base.grupoDisenoCompartido = "LOGO-1";
  } else if (idRequerimiento === "PRODUCT-503") {
    base.idDetallePedido = 503;
    base.esDisenoGeneral = true;
  } else {
    base.idDetallePedido = 504;
  }
  (copia as any).disenos = [base];
  return copia as any;
};

for (const idRequerimiento of [
  "STAMP-601",
  "GROUP-LOGO-1",
  "PRODUCT-503",
  "LEGACY-504",
]) {
  test(`DisenoService registra archivo CLIENTE para ${idRequerimiento}`, async (t) => {
    const pendiente = actualizarOrigenFixture(
      pedidoConOrigenPendiente(),
      idRequerimiento,
      "CLIENTE",
    );
    const actualizado = agregarDisenoRecibidoFixture(
      pendiente,
      idRequerimiento,
    );
    let lecturas = 0;
    t.mock.method(
      DisenoRepository.prototype,
      "buscarPedidoPorId",
      async () => (lecturas++ === 0 ? pendiente : actualizado),
    );
    const crear = t.mock.method(
      DisenoRepository.prototype,
      "crearDisenoOperacion",
      async (data: any) => ({ idDiseno: 90, ...data }),
    );
    t.mock.method(
      DisenoRepository.prototype,
      "buscarPorId",
      async () => ({
        ...disenoBase,
        idDiseno: 90,
        origenDiseno: "CLIENTE",
        estado: "ENVIADO",
      }),
    );

    const resultado =
      await servicio().registrarDisenoClientePorRequerimiento(
        100,
        idRequerimiento,
        {
          archivoDisenoInicialUrl:
            "https://pixel.test/cliente.png",
          medioRecepcion: "WHATSAPP",
          observaciones: "Recibido por WhatsApp.",
        },
        { idUsuario: 99, rol: "Admin" },
      );

    const data = crear.mock.calls[0]?.arguments[0] as any;
    assert.equal(data.estado, "ENVIADO");
    assert.equal(data.origenDiseno, "CLIENTE");
    assert.equal(data.idDisenador, null);
    assert.equal(data.medioRecepcion, "WHATSAPP");
    assert.equal(
      resultado.estadoCoberturaDiseno,
      "PENDIENTE_REVISION_CLIENTE",
    );
  });
}

test("DisenoService rechaza archivo si el requerimiento no es CLIENTE", async (t) => {
  const pedido = actualizarOrigenFixture(
    pedidoConOrigenPendiente(),
    "STAMP-601",
    "PIXEL",
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedido,
  );
  const crear = t.mock.method(
    DisenoRepository.prototype,
    "crearDisenoOperacion",
    async () => ({ idDiseno: 90 }),
  );

  await assert.rejects(
    () =>
      servicio().registrarDisenoClientePorRequerimiento(
        100,
        "STAMP-601",
        {
          archivoDisenoInicialUrl:
            "https://pixel.test/cliente.png",
        },
        { idUsuario: 99, rol: "Admin" },
      ),
    /no esta configurado con diseno del cliente/,
  );
  assert.equal(crear.mock.calls.length, 0);
});

test("DisenoService no duplica archivo activo del mismo requerimiento", async (t) => {
  const pendiente = actualizarOrigenFixture(
    pedidoConOrigenPendiente(),
    "STAMP-601",
    "CLIENTE",
  );
  const pedido = agregarDisenoRecibidoFixture(
    pendiente,
    "STAMP-601",
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedido,
  );
  const crear = t.mock.method(
    DisenoRepository.prototype,
    "crearDisenoOperacion",
    async () => ({ idDiseno: 91 }),
  );

  await assert.rejects(
    () =>
      servicio().registrarDisenoClientePorRequerimiento(
        100,
        "STAMP-601",
        {
          archivoDisenoInicialUrl:
            "https://pixel.test/duplicado.png",
        },
        { idUsuario: 99, rol: "Admin" },
      ),
    /ya tiene un diseno activo/,
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

test("DisenoService cliente registra URL propia y crea diseno enviado sin duplicarlo", async (t) => {
  const pedidoCliente = {
    ...pedidoBase,
    detalles: [
      {
        idDetallePedido: 501,
        requiereDiseno: true,
        origenDiseno: "CLIENTE",
        archivoDisenoInicialUrl: null,
        esDisenoGeneral: false,
      },
    ],
    disenos: [],
  };
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoCliente,
  );
  const actualizarDetalle = t.mock.method(
    DisenoRepository.prototype,
    "actualizarArchivoDetallePedido",
    async () => ({ idDetallePedido: 501 }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarDisenoParaCargaCliente",
    async () => null,
  );
  const crear = t.mock.method(
    DisenoRepository.prototype,
    "crearDisenoOperacion",
    async () => ({ idDiseno: 80 }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPorId",
    async () => ({
      ...disenoBase,
      idDiseno: 80,
      origenDiseno: "CLIENTE",
      estado: "ENVIADO",
    }),
  );

  const diseno = await servicio().registrarUrlDisenoCliente(
    100,
    501,
    { archivoDisenoInicialUrl: "https://cdn.pixel.test/cliente.png" },
    { idUsuario: 70, idCliente: 10, rol: "Cliente" },
  );

  assert.equal(diseno.idDiseno, 80);
  assert.equal(actualizarDetalle.mock.calls.length, 1);
  assert.equal(crear.mock.calls.length, 1);
  assert.equal((crear.mock.calls[0]?.arguments[0] as any).idDisenador, null);
  assert.equal((crear.mock.calls[0]?.arguments[0] as any).estado, "ENVIADO");
});

test("DisenoService permite que Admin registre un diseno recibido del cliente", async (t) => {
  const pedidoCliente = {
    ...pedidoBase,
    detalles: [
      {
        idDetallePedido: 501,
        requiereDiseno: true,
        origenDiseno: "CLIENTE",
        archivoDisenoInicialUrl: null,
        esDisenoGeneral: false,
      },
    ],
    disenos: [],
  };
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoCliente,
  );
  t.mock.method(
    DisenoRepository.prototype,
    "actualizarArchivoDetallePedido",
    async () => ({ idDetallePedido: 501 }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarDisenoParaCargaCliente",
    async () => null,
  );
  const crear = t.mock.method(
    DisenoRepository.prototype,
    "crearDisenoOperacion",
    async () => ({ idDiseno: 82 }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPorId",
    async () => ({
      ...disenoBase,
      idDiseno: 82,
      origenDiseno: "CLIENTE",
      estado: "ENVIADO",
    }),
  );

  const diseno = await servicio().registrarUrlDisenoRecibidoAdmin(
    100,
    501,
    {
      archivoDisenoInicialUrl: "https://cdn.pixel.test/whatsapp.png",
      medioRecepcion: "WHATSAPP",
      observaciones: "Recibido por WhatsApp.",
    },
    { idUsuario: 99, rol: "Admin" },
  );

  const datosCreacion = crear.mock.calls[0]?.arguments[0] as any;
  assert.equal(diseno.estado, "ENVIADO");
  assert.equal(datosCreacion.idDisenador, null);
  assert.equal(datosCreacion.estado, "ENVIADO");
  assert.equal(datosCreacion.medioRecepcion, "WHATSAPP");
  assert.equal(datosCreacion.recibidoPorId, 99);
  assert.equal(datosCreacion.observaciones, "Recibido por WhatsApp.");
});

test("DisenoService conserva rechazo y crea una nueva version activa", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => ({
      ...pedidoBase,
      detalles: [
        {
          idDetallePedido: 501,
          requiereDiseno: true,
          origenDiseno: "CLIENTE",
          archivoDisenoInicialUrl: "https://pixel.test/anterior.png",
          esDisenoGeneral: false,
        },
      ],
      disenos: [
        {
          idDiseno: 81,
          idDetallePedido: 501,
          esDisenoGeneral: false,
          estado: "RECHAZADO",
        },
      ],
    }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "actualizarArchivoDetallePedido",
    async () => ({ idDetallePedido: 501 }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarDisenoParaCargaCliente",
    async () => ({ idDiseno: 81, estado: "RECHAZADO" }),
  );
  const actualizar = t.mock.method(
    DisenoRepository.prototype,
    "actualizarDisenoOperacion",
    async () => ({ idDiseno: 81 }),
  );
  const crear = t.mock.method(
    DisenoRepository.prototype,
    "crearDisenoOperacion",
    async () => ({ idDiseno: 99 }),
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPorId",
    async () => ({ ...disenoBase, idDiseno: 99, estado: "ENVIADO" }),
  );

  await servicio().registrarUrlDisenoCliente(
    100,
    501,
    { archivoDisenoInicialUrl: "https://pixel.test/corregido.png" },
    { idUsuario: 70, idCliente: 10, rol: "Cliente" },
  );

  assert.equal(actualizar.mock.calls.length, 0);
  assert.equal(crear.mock.calls.length, 1);
});

test("DisenoService bloquea URL invalida y detalle de otro cliente", async (t) => {
  const buscarPedido = t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => ({
      ...pedidoBase,
      idCliente: 20,
      cliente: clienteB,
    }),
  );

  await assert.rejects(
    () =>
      servicio().registrarUrlDisenoCliente(
        100,
        501,
        { archivoDisenoInicialUrl: "javascript:alert(1)" },
        { idUsuario: 70, idCliente: 10, rol: "Cliente" },
      ),
    /debe usar http o https/,
  );
  assert.equal(buscarPedido.mock.calls.length, 0);

  await assert.rejects(
    () =>
      servicio().registrarUrlDisenoCliente(
        100,
        501,
        { archivoDisenoInicialUrl: "https://pixel.test/diseno.png" },
        { idUsuario: 70, idCliente: 10, rol: "Cliente" },
      ),
    /No tienes permiso/,
  );
});

const archivoJpg: DesignUploadFile = {
  originalname: "arte-final.jpg",
  mimetype: "image/jpeg",
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  size: 4,
};

const archivoCloudinary = {
  secureUrl: "https://res.cloudinary.com/pixel/image/upload/diseno-uuid.jpg",
  publicId: "pixel/disenos/pedido-100/diseno-uuid",
  originalName: "arte-final.jpg",
  mimeType: "image/jpeg",
  format: "jpg",
  sizeBytes: 4,
  resourceType: "image",
};

test("DisenoService guarda archivo Cloudinary con metadata sin exponer publicId", async (t) => {
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
  t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "subirDiseno",
    async () => archivoCloudinary,
  );
  const crear = t.mock.method(
    DisenoRepository.prototype,
    "crearDiseno",
    async (data: any) => ({ ...disenoBase, ...data }),
  );
  t.mock.method(
    NotificationService.prototype,
    "disenoEnviadoParaRevision",
    async () => ({ event: "DISENO_ENVIADO_PARA_REVISION" }),
  );

  const resultado = await servicio().crearDiseno(
    {
      idPedido: 100,
      descripcion: "Arte final para camiseta",
      origenDiseno: "PIXEL",
    },
    { idUsuario: 99, rol: "Admin" },
    archivoJpg,
  );

  const data = crear.mock.calls[0]?.arguments[0] as any;
  assert.equal(data.archivoUrl, archivoCloudinary.secureUrl);
  assert.equal(data.archivoPublicId, archivoCloudinary.publicId);
  assert.equal(data.archivoNombreOriginal, "arte-final.jpg");
  assert.equal(data.archivoMimeType, "image/jpeg");
  assert.equal(data.archivoBytes, 4);
  assert.equal(resultado.archivoUrl, archivoCloudinary.secureUrl);
  assert.equal(resultado.archivoPublicId, undefined);
  assert.deepEqual(resultado.archivo, {
    url: archivoCloudinary.secureUrl,
    nombre: "arte-final.jpg",
    tipo: "image/jpeg",
    formato: "jpg",
    bytes: 4,
    resourceType: "image",
  });
});

test("DisenoService no escribe en BD cuando Cloudinary falla", async (t) => {
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
  t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "subirDiseno",
    async () => {
      throw new DesignFileStorageError("No pudimos almacenar el archivo. Intenta nuevamente.");
    },
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
          descripcion: "Arte final",
          origenDiseno: "PIXEL",
        },
        { idUsuario: 99, rol: "Admin" },
        archivoJpg,
      ),
    /No pudimos almacenar el archivo/,
  );
  assert.equal(crear.mock.calls.length, 0);
});

test("DisenoService elimina el archivo recien subido si falla la persistencia", async (t) => {
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
  t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "subirDiseno",
    async () => archivoCloudinary,
  );
  const limpiar = t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "eliminarRecienSubido",
    async () => true,
  );
  t.mock.method(
    DisenoRepository.prototype,
    "crearDiseno",
    async () => {
      throw new Error("Fallo controlado de persistencia");
    },
  );

  await assert.rejects(
    () =>
      servicio().crearDiseno(
        {
          idPedido: 100,
          descripcion: "Arte final",
          origenDiseno: "PIXEL",
        },
        { idUsuario: 99, rol: "Admin" },
        archivoJpg,
      ),
    /Fallo controlado de persistencia/,
  );
  assert.equal(limpiar.mock.calls.length, 1);
  assert.deepEqual(limpiar.mock.calls[0]?.arguments, [
    archivoCloudinary.publicId,
    "image",
  ]);
});

test("DisenoService valida ownership antes de subir archivo del cliente", async (t) => {
  const pedido = actualizarOrigenFixture(
    pedidoConOrigenPendiente(),
    "STAMP-601",
    "CLIENTE",
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => ({ ...pedido, idCliente: 20, cliente: clienteB }),
  );
  const subir = t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "subirDiseno",
    async () => archivoCloudinary,
  );

  await assert.rejects(
    () =>
      servicio().registrarDisenoClientePorRequerimiento(
        100,
        "STAMP-601",
        {},
        { idUsuario: 70, idCliente: 10, rol: "Cliente" },
        archivoJpg,
        true,
      ),
    /No tienes permiso/,
  );
  assert.equal(subir.mock.calls.length, 0);
});

test("DisenoService no reemplaza un archivo activo y conserva su historial", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPorId",
    async () => ({
      ...disenoBase,
      archivoPublicId: "pixel/disenos/pedido-100/anterior",
    }),
  );
  const subir = t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "subirDiseno",
    async () => archivoCloudinary,
  );

  await assert.rejects(
    () =>
      servicio().actualizarDiseno(
        1,
        {},
        { idUsuario: 99, rol: "Admin" },
        archivoJpg,
      ),
    /conservar el historial/,
  );
  assert.equal(subir.mock.calls.length, 0);
});

test("DisenoService mantiene consultable un diseno historico con URL externa", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPorId",
    async () => disenoBase,
  );
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidosParaRequerimientos",
    async () => [],
  );

  const resultado = await servicio().buscarPorId(
    1,
    { idUsuario: 99, rol: "Admin" },
  );

  assert.equal(resultado?.archivoUrl, disenoBase.archivoUrl);
  assert.deepEqual(resultado?.archivo, {
    url: disenoBase.archivoUrl,
    nombre: null,
    tipo: null,
    formato: null,
    bytes: null,
    resourceType: null,
  });
});

test("DisenoService exige archivo en la carga por requerimiento", async (t) => {
  const buscarPedido = t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );

  await assert.rejects(
    () =>
      servicio().registrarDisenoClientePorRequerimiento(
        100,
        "LEGACY-501",
        {},
        { idUsuario: 99, rol: "Admin" },
      ),
    /Debes adjuntar un archivo/,
  );
  assert.equal(buscarPedido.mock.calls.length, 0);
});

test("DisenoService valida el requerimiento antes de subir a Cloudinary", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPedidoPorId",
    async () => ({
      ...pedidoBase,
      detalles: [
        {
          idDetallePedido: 501,
          requiereDiseno: true,
          origenDiseno: "CLIENTE",
          esDisenoGeneral: false,
          estampados: [],
        },
      ],
      disenos: [],
    }),
  );
  const subir = t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "subirDiseno",
    async () => archivoCloudinary,
  );

  await assert.rejects(
    () =>
      servicio().registrarDisenoClientePorRequerimiento(
        100,
        "LEGACY-999",
        {},
        { idUsuario: 99, rol: "Admin" },
        archivoJpg,
      ),
    /no pertenece al pedido/,
  );
  assert.equal(subir.mock.calls.length, 0);
});

test("DisenoService limpia Cloudinary solo al eliminar un diseno no historico", async (t) => {
  t.mock.method(
    DisenoRepository.prototype,
    "buscarPorId",
    async () => ({
      ...disenoBase,
      estado: "PENDIENTE",
      archivoPublicId: archivoCloudinary.publicId,
      archivoResourceType: "image",
    }),
  );
  const eliminarDb = t.mock.method(
    DisenoRepository.prototype,
    "eliminarDiseno",
    async () => ({ idDiseno: 1 }),
  );
  const limpiar = t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "eliminarRecienSubido",
    async () => true,
  );

  const eliminado = await servicio().eliminarDiseno(
    1,
    { idUsuario: 99, rol: "Admin" },
  );

  assert.equal(eliminarDb.mock.calls.length, 1);
  assert.equal(limpiar.mock.calls.length, 1);
  assert.equal(eliminado.archivoPublicId, undefined);
});
