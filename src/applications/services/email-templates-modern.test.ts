import test from "node:test";
import assert from "node:assert/strict";
import { EmailService, type MailData } from "./email.service";
import {
  buildCotizacionCreadaClienteTemplate,
  buildCotizacionModificadaTemplate,
  buildCotizacionPresencialCreadaClienteTemplate,
  buildDisenoEnviadoParaRevisionTemplate,
  buildPedidoAnuladoTemplate,
  buildPedidoCreadoTemplate,
  buildPedidoEnProduccionTemplate,
  buildPedidoEntregadoTemplate,
  buildPedidoFinalizadoTemplate,
  buildPedidoPendienteSaldoFinalTemplate,
  buildPrimerAbonoConfirmadoTemplate,
  buildPropuestaCotizacionEnviadaTemplate,
  buildRespuestaCotizacionTemplate,
  buildSolicitudCotizacionRecibidaTemplate,
} from "./email-templates";

const cliente = { nombre: "Ana Pérez", correo: "ana@pixel.test" };
const detalle = {
  descripcion: "Camiseta",
  cantidad: 12,
  precioBase: 30000,
  precioUnitario: 28000,
  descuentoPorcentaje: 6.67,
  subtotalBruto: 360000,
  descuentoTotal: 24000,
  subtotalConDescuento: 336000,
  producto: { nombre: "Camiseta", categoriaProducto: { nombre: "Textiles" } },
  tecnica: { nombre: "DTF" },
  estampados: [
    { tecnica: { nombre: "DTF" }, ubicacion: "Frente", anchoCm: 10, altoCm: 12 },
  ],
};
const pedido = {
  idPedido: 54,
  cliente,
  detalles: [detalle],
  total: 336000,
  totalPagado: 168000,
  saldoPendiente: 168000,
  estadoPedido: "EN_PROCESO",
  fechaEntregaEstimada: "2026-08-20",
};

const assertCorreoSeguro = (correo: { text: string; html?: string }) => {
  const contenido = `${correo.text}\n${correo.html ?? ""}`;
  assert.match(correo.html ?? "", /^<!doctype html>/i);
  assert.match(correo.html ?? "", /max-width:640px/);
  assert.match(correo.html ?? "", /PIXEL/);
  assert.doesNotMatch(contenido, /\b(?:undefined|null|NaN|GMT|UTC|Prisma|Tesseract|OCR)\b/i);
  assert.doesNotMatch(contenido, /estadoCoberturaDiseno|PENDIENTE_CREACION_PIXEL/);
  assert.equal((correo.html?.match(/<html\b/gi) ?? []).length, 1);
  assert.equal((correo.html?.match(/<\/html>/gi) ?? []).length, 1);
};

test("solicitudes recibidas no exponen precios internos", () => {
  const payload = {
    idCotizacion: 125,
    cliente,
    detalles: [detalle],
    precioSugeridoInterno: 336000,
    accesoCliente: {
      linkCrearPassword: "https://pixel.test/crear-password-cliente/token",
      fechaExpiracion: new Date("2026-08-11T04:59:00.000Z"),
    },
  };
  const correos = [
    buildSolicitudCotizacionRecibidaTemplate(payload),
    buildCotizacionCreadaClienteTemplate(payload),
    buildCotizacionPresencialCreadaClienteTemplate(payload),
  ];

  for (const correo of correos) {
    assertCorreoSeguro(correo);
    assert.doesNotMatch(correo.text, /336\.000|precio sugerido|total final/i);
    assert.match(correo.html ?? "", /Crear mi contraseña/);
    assert.match(correo.html ?? "", /10 de agosto de 2026, 11:59 p\. m\./);
  }
});

test("propuesta oficial usa cards, vigencia humana y precio COP", () => {
  const correo = buildPropuestaCotizacionEnviadaTemplate({
    cotizacion: { idCotizacion: 125 },
    cliente,
    version: {
      numeroVersion: 1,
      precioFinal: 851000,
      enviadaAt: new Date("2026-08-09T15:00:00.000Z"),
      validaHasta: new Date("2026-08-11T04:59:00.000Z"),
      desgloseVisible: {
        items: [{ nombre: "Camiseta", cantidad: 12, subtotal: 851000, estampados: detalle.estampados }],
        descuentoManual: 0,
      },
    },
  });

  assertCorreoSeguro(correo);
  assert.equal(correo.subject, "Tu propuesta de cotización está lista - PIXEL");
  assert.match(correo.html ?? "", /\$ 851\.000/);
  assert.match(correo.html ?? "", /10 de agosto de 2026, 11:59 p\. m\./);
  assert.match(correo.html ?? "", /Revisar propuesta/);
  assert.doesNotMatch(correo.text, /precio sugerido|margen|motivoAjusteManual/i);
});

test("correos del flujo de pedido comparten layout y lenguaje humano", () => {
  const correos = [
    buildPedidoCreadoTemplate({ pedido }),
    buildPrimerAbonoConfirmadoTemplate({ pedido, abono: { monto: 168000, fechaConfirmacion: new Date("2026-08-10T15:00:00Z") } }),
    buildDisenoEnviadoParaRevisionTemplate({ diseno: { descripcion: "Frente camiseta", pedido } }),
    buildPedidoEnProduccionTemplate({ pedido }),
    buildPedidoPendienteSaldoFinalTemplate({ pedido }),
    buildPedidoFinalizadoTemplate({ pedido: { ...pedido, fechaFinalizado: new Date("2026-08-12T15:00:00Z") } }),
    buildPedidoEntregadoTemplate({ pedido: { ...pedido, fechaEntregado: new Date("2026-08-13T15:00:00Z") } }),
    buildPedidoAnuladoTemplate({ pedido, motivo: "Solicitud del cliente" }),
    buildCotizacionModificadaTemplate({ cotizacion: { ...pedido, cliente }, motivoCambio: "Ajuste solicitado" }),
    buildRespuestaCotizacionTemplate({ cliente, pedido, version: { numeroVersion: 1 }, respuesta: { decision: "ACEPTAR", medio: "SISTEMA", precioAceptado: 336000 } }),
  ];

  for (const correo of correos) assertCorreoSeguro(correo);
  assert.match(correos[0]?.html ?? "", /Ver mi pedido/);
  assert.match(correos[2]?.html ?? "", /Revisar diseño/);
  assert.doesNotMatch(correos[9]?.html ?? "", />ACEPTAR<|>SISTEMA</);
});

test("recuperacion de contraseña usa layout, CTA y expiracion humana", async (t) => {
  const envio = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async (data: MailData) => ({ sent: true, skipped: false, data }),
  );
  await new EmailService().sendPasswordReset(
    cliente.correo,
    cliente.nombre,
    "https://pixel.test/reset-password/token",
    new Date("2026-08-11T04:59:00.000Z"),
  );
  const correo = envio.mock.calls[0]?.arguments[0];
  assert.ok(correo);
  assertCorreoSeguro(correo);
  assert.equal(correo.subject, "Restablece tu contraseña - PIXEL");
  assert.match(correo.html ?? "", /Cambiar contraseña/);
  assert.match(correo.html ?? "", /10 de agosto de 2026, 11:59 p\. m\./);
});
