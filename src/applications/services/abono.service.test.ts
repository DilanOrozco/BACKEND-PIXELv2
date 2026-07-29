import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "../../../generated/prisma/client";
import { AbonoService } from "./abono.service";
import { NotificationService } from "./notification.service";
import { AbonoRepository } from "../../infrastructure/repositories/abono.repository";

const admin = { idUsuario: 99, rol: "Admin" };

const pedidoBase = {
  idPedido: 1,
  idCliente: 10,
  estadoPedido: "PENDIENTE",
  estadoPago: "PENDIENTE",
  total: 100000,
  totalPagado: 0,
  saldoPendiente: 100000,
  cliente: {
    idCliente: 10,
    nombre: "Cliente A",
    documento: null,
    correo: "cliente@pixel.test",
    telefono: "3000000000",
    direccion: null,
  },
};

const abonoPendiente = {
  idAbono: 5,
  idPedido: 1,
  monto: 50000,
  metodoPago: "EFECTIVO",
  referencia: null,
  comprobanteUrl: null,
  estado: "PENDIENTE",
  fechaCreacion: new Date("2026-01-01"),
  confirmadoPorId: null,
  fechaConfirmacion: null,
  rechazadoPorId: null,
  fechaRechazo: null,
  motivoRechazo: null,
  montoDetectadoOcr: 49000,
  referenciaDetectadaOcr: "REF-PIXEL-1",
  fechaDetectadaOcr: new Date("2026-07-27T00:00:00.000Z"),
  bancoDetectadoOcr: "Nequi",
  confianzaOcr: 82,
  requiereRevisionManual: true,
  origenRegistro: "FRONTEND",
  pedido: pedidoBase,
  confirmadoPor: null,
  rechazadoPor: null,
};

const abonoConfirmado = {
  ...abonoPendiente,
  estado: "CONFIRMADO",
  confirmadoPorId: 99,
  fechaConfirmacion: new Date("2026-01-01"),
};

const transaccionFake = async <T>(
  handler: (tx: Prisma.TransactionClient) => Promise<T>,
) => handler({} as Prisma.TransactionClient);

test("AbonoService registra abono sin confirmar", async (t) => {
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );
  const crearMock = t.mock.method(
    AbonoRepository.prototype,
    "crearAbono",
    async (_data: unknown) => abonoPendiente,
  );

  const abono = await new AbonoService(transaccionFake).crearAbono(
    {
      idPedido: 1,
      monto: 50000,
      metodoPago: "EFECTIVO",
    },
    admin,
  );

  assert.equal(abono?.estado, "PENDIENTE");
  assert.equal(crearMock.mock.calls.length, 1);
  assert.equal((crearMock.mock.calls[0]?.arguments[0] as any).estado, "PENDIENTE");
  assert.equal((abono as any).totalPedido, 100000);
  assert.equal((abono as any).totalConfirmado, 0);
  assert.equal((abono as any).saldoPendiente, 100000);
  assert.equal((abono as any).montoMinimoPrimerAbono, 50000);
  assert.equal((abono as any).estadoPago, "PENDIENTE");
  assert.equal((abono as any).pedido.cliente.idCliente, 10);
  assert.equal((abono as any).pedido.total, 100000);
  assert.equal((abono as any).pedido.totalPagadoConfirmado, 0);
  assert.equal((abono as any).pedido.saldoPendiente, 100000);
  assert.equal((abono as any).datosDetectados.monto, 49000);
  assert.equal((abono as any).datosDetectados.referencia, "REF-PIXEL-1");
  assert.equal((abono as any).datosDefinitivos.monto, 50000);
  assert.equal((abono as any).origenRegistroCodigo, "PORTAL_CLIENTE");
  assert.equal(
    (abono as any).origenRegistroLabel,
    "Enviado desde el portal del cliente",
  );
});

test("AbonoService registra abono confirmado y envia evento despues de DB", async (t) => {
  let dentroTransaccion = false;
  const transaccionControlada = async <T>(
    handler: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => {
    dentroTransaccion = true;
    const resultado = await handler({} as Prisma.TransactionClient);
    dentroTransaccion = false;
    return resultado;
  };

  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "sumarAbonosConfirmados",
    async () => 0,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "crearAbonoOperacion",
    async () => ({ idAbono: 5, idPedido: 1, monto: 50000, estado: "CONFIRMADO" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "actualizarResumenPagoPedido",
    async (_idPedido: number, data: unknown) => data,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "existeDisenoAprobado",
    async () => false,
  );
  const ventaMock = t.mock.method(
    AbonoRepository.prototype,
    "upsertVentaDesdePago",
    async () => ({ idVenta: 1, estado: "PARCIAL" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorId",
    async () => abonoConfirmado,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoCompleto",
    async () => ({
      ...pedidoBase,
      detalles: [
        {
          idDetallePedido: 1,
          idProducto: 1,
          cantidad: 12,
          precioUnitario: 26001,
          subtotal: 312012,
          producto: { idProducto: 1, nombre: "Camiseta" },
        },
      ],
      cotizacion: {
        subtotal: 336000,
        descuentoTotal: 23988,
        costosAdicionales: 0,
        total: 312012,
        detalles: [
          {
            idProducto: 1,
            cantidad: 12,
            precioBase: 28000,
            descuentoPorcentaje: 7.14,
            precioUnitario: 26001,
            subtotalBruto: 336000,
            descuentoTotal: 23988,
            subtotalConDescuento: 312012,
            producto: { nombre: "Camiseta" },
          },
        ],
      },
    }),
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "primerAbonoConfirmado",
    async (abono: any) => {
      assert.equal(dentroTransaccion, false);
      assert.equal(abono.pedido.cotizacion.detalles.length, 1);
      assert.equal(abono.pedido.cotizacion.detalles[0].precioBase, 28000);
      return { event: "PRIMER_ABONO_CONFIRMADO", cliente: "enviado" };
    },
  );

  const abono = await new AbonoService(transaccionControlada).crearAbono(
    {
      idPedido: 1,
      monto: 50000,
      metodoPago: "EFECTIVO",
      confirmar: true,
    },
    admin,
  );

  assert.equal(abono?.estado, "CONFIRMADO");
  assert.equal(notificationMock.mock.calls.length, 1);
  assert.equal(ventaMock.mock.calls.length, 1);
});

test("AbonoService confirmar primer abono envia evento y actualiza saldo", async (t) => {
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorIdOperacion",
    async () => ({ idAbono: 5, idPedido: 1, monto: 50000, estado: "PENDIENTE" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "sumarAbonosConfirmados",
    async () => 0,
  );
  const actualizarPagoMock = t.mock.method(
    AbonoRepository.prototype,
    "actualizarResumenPagoPedido",
    async (_idPedido: number, data: unknown) => data,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "actualizarAbonoOperacion",
    async () => ({ idAbono: 5, idPedido: 1, monto: 50000, estado: "CONFIRMADO" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "existeDisenoAprobado",
    async () => false,
  );
  const ventaMock = t.mock.method(
    AbonoRepository.prototype,
    "upsertVentaDesdePago",
    async () => ({ idVenta: 1, estado: "PARCIAL" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorId",
    async () => abonoConfirmado,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoCompleto",
    async () => ({ ...pedidoBase, detalles: [], cotizacion: { detalles: [] } }),
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "primerAbonoConfirmado",
    async () => ({ event: "PRIMER_ABONO_CONFIRMADO", cliente: "enviado" }),
  );

  const abono = await new AbonoService(transaccionFake).confirmarAbono(
    5,
    admin,
  );

  const pago = actualizarPagoMock.mock.calls[0]?.arguments[1] as any;
  assert.equal(abono?.estado, "CONFIRMADO");
  assert.equal(pago.totalPagado, 50000);
  assert.equal(pago.saldoPendiente, 50000);
  assert.equal(pago.estadoPago, "PARCIAL");
  assert.equal(notificationMock.mock.calls.length, 1);
  assert.equal(ventaMock.mock.calls.length, 1);
});

test("AbonoService confirmar segundo abono no reenvia evento de primer abono", async (t) => {
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorIdOperacion",
    async () => ({ idAbono: 6, idPedido: 1, monto: 50000, estado: "PENDIENTE" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "sumarAbonosConfirmados",
    async () => 50000,
  );
  const actualizarPagoMock = t.mock.method(
    AbonoRepository.prototype,
    "actualizarResumenPagoPedido",
    async (_idPedido: number, data: unknown) => data,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "actualizarAbonoOperacion",
    async () => ({ idAbono: 6, idPedido: 1, monto: 50000, estado: "CONFIRMADO" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "existeDisenoAprobado",
    async () => false,
  );
  const ventaMock = t.mock.method(
    AbonoRepository.prototype,
    "upsertVentaDesdePago",
    async () => ({ idVenta: 1, estado: "COMPLETA" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorId",
    async () => ({ ...abonoConfirmado, idAbono: 6 }),
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "primerAbonoConfirmado",
    async () => ({ event: "PRIMER_ABONO_CONFIRMADO", cliente: "enviado" }),
  );

  await new AbonoService(transaccionFake).confirmarAbono(6, admin);

  const resumenPago = actualizarPagoMock.mock.calls[0]?.arguments[1] as any;
  const venta = ventaMock.mock.calls[0]?.arguments[0] as any;
  assert.equal(resumenPago.totalPagado, 100000);
  assert.equal(resumenPago.saldoPendiente, 0);
  assert.equal(resumenPago.estadoPago, "COMPLETO");
  assert.equal(venta.estado, "COMPLETA");
  assert.equal(notificationMock.mock.calls.length, 0);
  assert.equal(ventaMock.mock.calls.length, 1);
});

test("AbonoService no confirma dos veces el mismo abono", async (t) => {
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorIdOperacion",
    async () => ({ idAbono: 5, idPedido: 1, monto: 50000, estado: "CONFIRMADO" }),
  );
  const actualizarMock = t.mock.method(
    AbonoRepository.prototype,
    "actualizarAbonoOperacion",
    async () => abonoConfirmado,
  );

  await assert.rejects(
    () => new AbonoService(transaccionFake).confirmarAbono(5, admin),
    /El abono ya fue confirmado/,
  );
  assert.equal(actualizarMock.mock.calls.length, 0);
});

test("AbonoService responde error controlado si el pedido no existe", async (t) => {
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoPorId",
    async () => null,
  );

  await assert.rejects(
    () =>
      new AbonoService(transaccionFake).crearAbono(
        {
          idPedido: 999,
          monto: 50000,
          metodoPago: "EFECTIVO",
        },
        admin,
      ),
    /Pedido no encontrado/,
  );
});

test("AbonoService pago completo deja saldo cero y estado COMPLETO", async () => {
  const service = new AbonoService(transaccionFake);

  assert.equal(service.calcularEstadoPago(100000, 100000), "COMPLETO");
});

test("AbonoService cliente sube comprobante propio y OCR no confirma el pago", async (t) => {
  const modoAnterior = process.env.RECEIPT_ANALYSIS_MODE;
  process.env.RECEIPT_ANALYSIS_MODE = "FRONTEND_WITH_BACKEND_FALLBACK";
  t.after(() => {
    if (modoAnterior === undefined) {
      delete process.env.RECEIPT_ANALYSIS_MODE;
    } else {
      process.env.RECEIPT_ANALYSIS_MODE = modoAnterior;
    }
  });

  let transacciones = 0;
  const transaction = async <T>(
    handler: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => {
    transacciones += 1;
    return await handler({} as Prisma.TransactionClient);
  };
  const storage = {
    savePaymentReceipt: async () => ({
      relativePath: "comprobantes/cliente-10/pedido-1/abono-test.png",
      originalName: "pago.png",
      safeName: "abono-test.png",
      mimeType: "image/png",
      sizeBytes: 100,
      sha256: "hash-unico",
    }),
    resolveSafePath: () => "C:\\temp\\abono-test.png",
    deleteFile: async () => true,
  };
  const ocr = {
    analyzePaymentReceipt: async () => ({
      textoCompleto: "Valor enviado: $50.000",
      montoDetectado: 50000,
      referenciaDetectada: "ABC123",
      fechaDetectada: new Date("2026-07-26"),
      bancoDetectado: "Nequi",
      confianza: 88,
      candidatosMonto: [50000],
      requiereRevisionManual: false,
      advertencias: [],
    }),
  };

  t.mock.method(AbonoRepository.prototype, "buscarPedidoPorId", async () => pedidoBase);
  t.mock.method(AbonoRepository.prototype, "buscarPorHash", async () => null);
  const crearMock = t.mock.method(
    AbonoRepository.prototype,
    "crearAbono",
    async (data: any) => ({ idAbono: 50, ...data }),
  );

  const resultado = await new AbonoService(
    transaction,
    storage as any,
    ocr as any,
  ).crearDesdeComprobanteCliente(
    1,
    { originalname: "pago.png" } as Express.Multer.File,
    "Pago enviado desde el panel",
    { idUsuario: 7, idCliente: 10, rol: "Cliente" },
  );
  const creado = crearMock.mock.calls[0]?.arguments[0] as any;

  assert.equal(resultado.abono.estado, "PENDIENTE");
  assert.equal(resultado.ocr.montoDetectado, 50000);
  assert.equal(creado.monto, null);
  assert.equal(creado.estado, "PENDIENTE");
  assert.equal(creado.origenRegistro, "BACKEND");
  assert.equal(resultado.datosDetectados.origenAnalisis, "BACKEND");
  assert.equal(resultado.abono.comprobantePath, undefined);
  assert.equal(resultado.abono.comprobanteDisponible, true);
  assert.equal(transacciones, 0);
});

test("AbonoService usa sugerencias frontend sin ejecutar OCR ni confirmar", async (t) => {
  const modoAnterior = process.env.RECEIPT_ANALYSIS_MODE;
  process.env.RECEIPT_ANALYSIS_MODE = "FRONTEND_ONLY";
  t.after(() => {
    if (modoAnterior === undefined) {
      delete process.env.RECEIPT_ANALYSIS_MODE;
    } else {
      process.env.RECEIPT_ANALYSIS_MODE = modoAnterior;
    }
  });

  let ejecucionesOcr = 0;
  const storage = {
    savePaymentReceipt: async () => ({
      relativePath: "comprobantes/cliente-10/pedido-1/frontend.jpg",
      originalName: "frontend.jpg",
      safeName: "frontend.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 100,
      sha256: "hash-frontend",
    }),
    resolveSafePath: () => "C:\\temp\\frontend.jpg",
    deleteFile: async () => true,
  };
  const ocr = {
    analyzePaymentReceipt: async () => {
      ejecucionesOcr += 1;
      return assert.fail("OCR no debe ejecutarse con analisis frontend");
    },
  };

  t.mock.method(AbonoRepository.prototype, "buscarPedidoPorId", async () => pedidoBase);
  t.mock.method(AbonoRepository.prototype, "buscarPorHash", async () => null);
  const crearMock = t.mock.method(
    AbonoRepository.prototype,
    "crearAbono",
    async (data: any) => ({ idAbono: 51, ...data }),
  );

  const resultado = await new AbonoService(
    transaccionFake,
    storage as any,
    ocr as any,
  ).crearDesdeComprobanteCliente(
    1,
    { originalname: "frontend.jpg" } as Express.Multer.File,
    {
      montoDetectado: "100000",
      referenciaDetectada: "M123456",
      fechaDetectada: "2026-07-26",
      bancoDetectado: "Nequi",
      calidadLectura: "82",
      requiereRevisionManual: "false",
      origenAnalisis: "FRONTEND",
    },
    { idUsuario: 7, idCliente: 10, rol: "Cliente" },
  );
  const creado = crearMock.mock.calls[0]?.arguments[0] as any;

  assert.equal(ejecucionesOcr, 0);
  assert.equal(creado.estado, "PENDIENTE");
  assert.equal(creado.monto, null);
  assert.equal(creado.referencia, null);
  assert.equal(creado.fechaPago, null);
  assert.equal(creado.montoDetectadoOcr, 100000);
  assert.equal(creado.referenciaDetectadaOcr, "M123456");
  assert.equal(creado.origenRegistro, "FRONTEND");
  assert.equal(resultado.datosDetectados.monto, 100000);
  assert.equal(resultado.datosDetectados.fecha, "2026-07-26");
  assert.equal(resultado.datosDetectados.origenAnalisis, "FRONTEND");
});

test("AbonoService rechaza sugerencias frontend invalidas antes de guardar archivo", async (t) => {
  let archivosGuardados = 0;
  const storage = {
    savePaymentReceipt: async () => {
      archivosGuardados += 1;
      return assert.fail("No debe guardar archivo con datos invalidos");
    },
  };

  t.mock.method(AbonoRepository.prototype, "buscarPedidoPorId", async () => pedidoBase);
  const service = new AbonoService(transaccionFake, storage as any, {} as any);
  const usuarioCliente = { idUsuario: 7, idCliente: 10, rol: "Cliente" };
  const archivo = { originalname: "invalido.png" } as Express.Multer.File;

  await assert.rejects(
    () =>
      service.crearDesdeComprobanteCliente(
        1,
        archivo,
        { montoDetectado: "0", origenAnalisis: "FRONTEND" },
        usuarioCliente,
      ),
    /monto detectado debe ser numerico y mayor a 0/i,
  );
  await assert.rejects(
    () =>
      service.crearDesdeComprobanteCliente(
        1,
        archivo,
        {
          fechaDetectada: "2026-02-30T10:00:00Z",
          origenAnalisis: "FRONTEND",
        },
        usuarioCliente,
      ),
    /fecha detectada debe tener formato ISO valido/i,
  );
  await assert.rejects(
    () =>
      service.crearDesdeComprobanteCliente(
        1,
        archivo,
        { calidadLectura: "101", origenAnalisis: "FRONTEND" },
        usuarioCliente,
      ),
    /calidad de lectura debe estar entre 0 y 100/i,
  );

  assert.equal(archivosGuardados, 0);
});

test("AbonoService conserva PDF frontend para revision manual sin ejecutar OCR", async (t) => {
  const modoAnterior = process.env.RECEIPT_ANALYSIS_MODE;
  process.env.RECEIPT_ANALYSIS_MODE = "FRONTEND_ONLY";
  t.after(() => {
    if (modoAnterior === undefined) {
      delete process.env.RECEIPT_ANALYSIS_MODE;
    } else {
      process.env.RECEIPT_ANALYSIS_MODE = modoAnterior;
    }
  });

  const storage = {
    savePaymentReceipt: async () => ({
      relativePath: "comprobantes/cliente-10/pedido-1/manual.pdf",
      originalName: "manual.pdf",
      safeName: "manual.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      sha256: "hash-pdf-manual",
    }),
    resolveSafePath: () => "C:\\temp\\manual.pdf",
    deleteFile: async () => true,
  };
  const ocr = {
    analyzePaymentReceipt: async () =>
      assert.fail("OCR no debe ejecutarse para PDF marcado como manual"),
  };

  t.mock.method(AbonoRepository.prototype, "buscarPedidoPorId", async () => pedidoBase);
  t.mock.method(AbonoRepository.prototype, "buscarPorHash", async () => null);
  const crearMock = t.mock.method(
    AbonoRepository.prototype,
    "crearAbono",
    async (data: any) => ({ idAbono: 52, ...data }),
  );

  const resultado = await new AbonoService(
    transaccionFake,
    storage as any,
    ocr as any,
  ).crearDesdeComprobanteCliente(
    1,
    { originalname: "manual.pdf" } as Express.Multer.File,
    {
      montoDetectado: "50000",
      requiereRevisionManual: "false",
      origenAnalisis: "FRONTEND",
    },
    { idUsuario: 7, idCliente: 10, rol: "Cliente" },
  );
  const creado = crearMock.mock.calls[0]?.arguments[0] as any;

  assert.equal(creado.estado, "PENDIENTE");
  assert.equal(creado.monto, null);
  assert.equal(creado.requiereRevisionManual, true);
  assert.equal(creado.origenRegistro, "FRONTEND");
  assert.equal(resultado.datosDetectados.requiereRevisionManual, true);
});

test("AbonoService FRONTEND_ONLY sin sugerencias crea revision manual sin OCR", async (t) => {
  const modoAnterior = process.env.RECEIPT_ANALYSIS_MODE;
  process.env.RECEIPT_ANALYSIS_MODE = "FRONTEND_ONLY";
  t.after(() => {
    if (modoAnterior === undefined) {
      delete process.env.RECEIPT_ANALYSIS_MODE;
    } else {
      process.env.RECEIPT_ANALYSIS_MODE = modoAnterior;
    }
  });

  const storage = {
    savePaymentReceipt: async () => ({
      relativePath: "comprobantes/cliente-10/pedido-1/sin-datos.png",
      originalName: "sin-datos.png",
      safeName: "sin-datos.png",
      mimeType: "image/png",
      sizeBytes: 100,
      sha256: "hash-sin-datos",
    }),
    resolveSafePath: () => "C:\\temp\\sin-datos.png",
    deleteFile: async () => true,
  };
  const ocr = {
    analyzePaymentReceipt: async () =>
      assert.fail("OCR no debe ejecutarse en modo FRONTEND_ONLY"),
  };

  t.mock.method(AbonoRepository.prototype, "buscarPedidoPorId", async () => pedidoBase);
  t.mock.method(AbonoRepository.prototype, "buscarPorHash", async () => null);
  const crearMock = t.mock.method(
    AbonoRepository.prototype,
    "crearAbono",
    async (data: any) => ({ idAbono: 53, ...data }),
  );

  const resultado = await new AbonoService(
    transaccionFake,
    storage as any,
    ocr as any,
  ).crearDesdeComprobanteCliente(
    1,
    { originalname: "sin-datos.png" } as Express.Multer.File,
    null,
    { idUsuario: 7, idCliente: 10, rol: "Cliente" },
  );
  const creado = crearMock.mock.calls[0]?.arguments[0] as any;

  assert.equal(creado.estado, "PENDIENTE");
  assert.equal(creado.origenRegistro, "MANUAL");
  assert.equal(creado.requiereRevisionManual, true);
  assert.equal(resultado.datosDetectados.origenAnalisis, "MANUAL");
});

test("AbonoService FRONTEND_ONLY envia lecturas parciales o dudosas a revision sin OCR", async (t) => {
  const modoAnterior = process.env.RECEIPT_ANALYSIS_MODE;
  process.env.RECEIPT_ANALYSIS_MODE = "FRONTEND_ONLY";
  t.after(() => {
    if (modoAnterior === undefined) {
      delete process.env.RECEIPT_ANALYSIS_MODE;
    } else {
      process.env.RECEIPT_ANALYSIS_MODE = modoAnterior;
    }
  });

  let archivosGuardados = 0;
  let ejecucionesOcr = 0;
  const logs: string[] = [];
  const storage = {
    savePaymentReceipt: async () => {
      archivosGuardados += 1;
      return {
        relativePath: `comprobantes/cliente-10/pedido-1/caso-${archivosGuardados}.png`,
        originalName: `caso-${archivosGuardados}.png`,
        safeName: `caso-${archivosGuardados}.png`,
        mimeType: "image/png",
        sizeBytes: 100,
        sha256: `hash-caso-${archivosGuardados}`,
      };
    },
    resolveSafePath: () => "C:\\temp\\caso.png",
    deleteFile: async () => true,
  };
  const ocr = {
    analyzePaymentReceipt: async () => {
      ejecucionesOcr += 1;
      return assert.fail("Tesseract no debe ejecutarse en FRONTEND_ONLY");
    },
  };

  t.mock.method(console, "info", (message: unknown) => {
    logs.push(String(message));
  });
  t.mock.method(AbonoRepository.prototype, "buscarPedidoPorId", async () => pedidoBase);
  t.mock.method(AbonoRepository.prototype, "buscarPorHash", async () => null);
  t.mock.method(
    AbonoRepository.prototype,
    "crearAbono",
    async (data: any) => ({ idAbono: 60 + archivosGuardados, ...data }),
  );

  const service = new AbonoService(transaccionFake, storage as any, ocr as any);
  const usuarioCliente = { idUsuario: 7, idCliente: 10, rol: "Cliente" };
  const casos = [
    {
      referenciaDetectada: "PARCIAL123",
      origenAnalisis: "FRONTEND",
    },
    {
      montoDetectado: "50000",
      calidadLectura: "25",
      origenAnalisis: "FRONTEND",
    },
    {
      montoDetectado: "50000",
      calidadLectura: "90",
      requiereRevisionManual: "true",
      origenAnalisis: "FRONTEND",
    },
  ];

  for (const [indice, datos] of casos.entries()) {
    const resultado = await service.crearDesdeComprobanteCliente(
      1,
      { originalname: `caso-${indice + 1}.png` } as Express.Multer.File,
      datos,
      usuarioCliente,
    );

    assert.equal(resultado.abono.estado, "PENDIENTE");
    assert.equal(resultado.datosDetectados.requiereRevisionManual, true);
  }

  assert.equal(archivosGuardados, casos.length);
  assert.equal(ejecucionesOcr, 0);
  assert.equal(logs.length, casos.length);
  assert.ok(
    logs.every(
      (log) =>
        log ===
        "[ReceiptAnalysis] mode=FRONTEND_ONLY source=MANUAL_REVIEW backendFallback=SKIPPED",
    ),
  );
  assert.ok(logs.every((log) => !log.includes("PARCIAL123")));
});

test("AbonoService bloquea comprobante ajeno y deduplica por hash", async (t) => {
  let guardados = 0;
  let eliminados = 0;
  const storage = {
    savePaymentReceipt: async () => {
      guardados += 1;
      return {
        relativePath: "comprobantes/cliente-10/pedido-1/repetido.png",
        originalName: "repetido.png",
        safeName: "repetido.png",
        mimeType: "image/png",
        sizeBytes: 100,
        sha256: "hash-repetido",
      };
    },
    resolveSafePath: () => "C:\\temp\\repetido.png",
    deleteFile: async () => {
      eliminados += 1;
      return true;
    },
  };
  const ocr = { analyzePaymentReceipt: async () => assert.fail("OCR no debe ejecutarse") };
  const service = new AbonoService(transaccionFake, storage as any, ocr as any);

  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoPorId",
    async (idPedido: number) => ({ ...pedidoBase, idPedido, idCliente: idPedido === 2 ? 20 : 10 }),
  );
  t.mock.method(AbonoRepository.prototype, "buscarPorHash", async () => ({
    ...abonoPendiente,
    montoDetectadoOcr: 50000,
    referenciaDetectadaOcr: "ABC123",
    fechaDetectadaOcr: null,
    bancoDetectadoOcr: "Nequi",
    confianzaOcr: 80,
    requiereRevisionManual: false,
    nombreOriginalComprobante: "repetido.png",
  }));

  await assert.rejects(
    () =>
      service.crearDesdeComprobanteCliente(
        2,
        { originalname: "ajeno.png" } as Express.Multer.File,
        null,
        { idUsuario: 7, idCliente: 10, rol: "Cliente" },
      ),
    /No tienes permiso/,
  );
  const duplicado = await service.crearDesdeComprobanteCliente(
    1,
    { originalname: "repetido.png" } as Express.Multer.File,
    null,
    { idUsuario: 7, idCliente: 10, rol: "Cliente" },
  );

  assert.equal(guardados, 1);
  assert.equal(eliminados, 1);
  assert.equal(duplicado.duplicado, true);
});

test("AbonoService protege descarga de comprobante por ownership", async (t) => {
  const storage = {
    getFileMetadata: async () => ({ sizeBytes: 100 }),
    getFileStream: () => ({ pipe: () => undefined }),
  };
  t.mock.method(
    AbonoRepository.prototype,
    "buscarComprobanteMetadata",
    async () => ({
      idAbono: 8,
      comprobantePath: "comprobantes/cliente-10/pedido-1/pago.png",
      nombreOriginalComprobante: "pago.png",
      comprobanteMimeType: "image/png",
      pedido: { idPedido: 1, idCliente: 10 },
    }),
  );
  const service = new AbonoService(transaccionFake, storage as any, {} as any);

  const propio = await service.obtenerComprobante(8, {
    idUsuario: 7,
    idCliente: 10,
    rol: "Cliente",
  });
  assert.equal(propio.mimeType, "image/png");

  await assert.rejects(
    () =>
      service.obtenerComprobante(8, {
        idUsuario: 9,
        idCliente: 20,
        rol: "Cliente",
      }),
    /No tienes permiso/,
  );
});
