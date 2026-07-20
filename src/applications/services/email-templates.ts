import { escapeHtml, type MailData } from "./email.service";

export const EMAIL_EVENTS = {
  COTIZACION_CREADA: "COTIZACION_CREADA",
  PEDIDO_CREADO_DESDE_COTIZACION: "PEDIDO_CREADO_DESDE_COTIZACION",
  PRIMER_ABONO_CONFIRMADO: "PRIMER_ABONO_CONFIRMADO",
  PEDIDO_FINALIZADO: "PEDIDO_FINALIZADO",
} as const;

export type EmailEvent = (typeof EMAIL_EVENTS)[keyof typeof EMAIL_EVENTS];

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const numeroSeguro = (valor: unknown) => {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
};

const moneda = (valor: unknown) => formatoMoneda.format(numeroSeguro(valor));

const textoSeguro = (valor: unknown, fallback = "No registrado") => {
  if (valor === null || valor === undefined) {
    return fallback;
  }

  const texto = String(valor).trim();
  return texto === "" ? fallback : texto;
};

const porcentaje = (valor: unknown) => {
  const numero = numeroSeguro(valor);

  if (numero <= 0) {
    return "Sin descuento / 0%";
  }

  return `${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
  }).format(numero)}%`;
};

const normalizarItems = (entidad: any) => {
  const detalles = entidad?.detalles ?? entidad?.items ?? [];

  return detalles.map((detalle: any) => {
    const cantidad = numeroSeguro(detalle?.cantidad);
    const precioBase = numeroSeguro(
      detalle?.precioBase ?? detalle?.precioUnitario,
    );
    const precioUnitario = numeroSeguro(
      detalle?.precioUnitario ?? detalle?.precioBase,
    );
    const subtotalBruto = numeroSeguro(
      detalle?.subtotalBruto ?? detalle?.subtotal ?? precioBase * cantidad,
    );
    const descuentoTotal = numeroSeguro(detalle?.descuentoTotal);
    const subtotalConDescuento = numeroSeguro(
      detalle?.subtotalConDescuento ??
        detalle?.subtotalFinal ??
        subtotalBruto - descuentoTotal,
    );

    return {
      producto: textoSeguro(
        detalle?.producto?.nombre ?? detalle?.descripcion,
        "Producto cotizable",
      ),
      categoria: textoSeguro(
        detalle?.producto?.categoriaProducto?.nombre,
        "Sin categoria",
      ),
      cantidad,
      precioBase,
      descuentoPorcentaje: numeroSeguro(detalle?.descuentoPorcentaje),
      descuentoValorUnitario: numeroSeguro(detalle?.descuentoValorUnitario),
      precioUnitario,
      subtotalBruto,
      descuentoTotal,
      subtotalConDescuento,
    };
  });
};

const calcularResumen = (entidad: any, items: any[]) => {
  const subtotalBruto = numeroSeguro(
    entidad?.subtotalBruto ??
      entidad?.subtotal ??
      items.reduce((acc, item) => acc + item.subtotalBruto, 0),
  );
  const descuentoTotal = numeroSeguro(
    entidad?.descuentoTotal ??
      items.reduce((acc, item) => acc + item.descuentoTotal, 0),
  );
  const costosAdicionales = numeroSeguro(entidad?.costosAdicionales);
  const total = numeroSeguro(
    entidad?.total ?? subtotalBruto - descuentoTotal + costosAdicionales,
  );
  const subtotalConDescuento = numeroSeguro(
    entidad?.subtotalConDescuento ??
      entidad?.subtotalFinal ??
      subtotalBruto - descuentoTotal,
  );

  return {
    subtotalBruto,
    descuentoTotal,
    costosAdicionales,
    subtotalConDescuento,
    total,
    tieneDescuento: descuentoTotal > 0,
  };
};

const resumenTexto = (items: any[]) =>
  items
    .map(
      (item) =>
        [
          `- ${item.producto} (${item.categoria})`,
          `  Cantidad: ${item.cantidad}`,
          `  Precio base unitario: ${moneda(item.precioBase)}`,
          `  Descuento aplicado: ${porcentaje(item.descuentoPorcentaje)}`,
          `  Precio unitario con descuento: ${moneda(item.precioUnitario)}`,
          `  Subtotal bruto: ${moneda(item.subtotalBruto)}`,
          `  Valor descontado: -${moneda(item.descuentoTotal)}`,
          `  Subtotal con descuento: ${moneda(item.subtotalConDescuento)}`,
        ].join("\n"),
    )
    .join("\n");

const resumenHtml = (items: any[]) =>
  items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.producto)}</td>
          <td>${escapeHtml(item.categoria)}</td>
          <td>${escapeHtml(item.cantidad)}</td>
          <td>${escapeHtml(moneda(item.precioBase))}</td>
          <td>${escapeHtml(porcentaje(item.descuentoPorcentaje))}</td>
          <td>${escapeHtml(moneda(item.precioUnitario))}</td>
          <td>${escapeHtml(moneda(item.subtotalBruto))}</td>
          <td>-${escapeHtml(moneda(item.descuentoTotal))}</td>
          <td>${escapeHtml(moneda(item.subtotalConDescuento))}</td>
        </tr>
      `,
    )
    .join("");

const tablaItems = (items: any[]) => `
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr>
        <th>Producto</th>
        <th>Categoria</th>
        <th>Cantidad</th>
        <th>Precio base unitario</th>
        <th>Descuento</th>
        <th>Precio unitario con descuento</th>
        <th>Subtotal bruto</th>
        <th>Valor descontado</th>
        <th>Subtotal con descuento</th>
      </tr>
    </thead>
    <tbody>${resumenHtml(items)}</tbody>
  </table>
`;

const resumenTotalesTexto = (resumen: any) =>
  resumen.tieneDescuento
    ? [
        `Subtotal antes de descuento: ${moneda(resumen.subtotalBruto)}`,
        `Valor descontado: -${moneda(resumen.descuentoTotal)}`,
        `Subtotal con descuento: ${moneda(resumen.subtotalConDescuento)}`,
        `Costos adicionales: ${moneda(resumen.costosAdicionales)}`,
        `Total final: ${moneda(resumen.total)}`,
      ].join("\n")
    : [
        `Subtotal: ${moneda(resumen.subtotalBruto)}`,
        "Descuento aplicado: Sin descuento / 0%",
        `Costos adicionales: ${moneda(resumen.costosAdicionales)}`,
        `Total final: ${moneda(resumen.total)}`,
      ].join("\n");

const resumenTotalesHtml = (resumen: any) =>
  resumen.tieneDescuento
    ? `
      <p><strong>Subtotal antes de descuento:</strong> ${escapeHtml(moneda(resumen.subtotalBruto))}</p>
      <p><strong>Valor descontado:</strong> -${escapeHtml(moneda(resumen.descuentoTotal))}</p>
      <p><strong>Subtotal con descuento:</strong> ${escapeHtml(moneda(resumen.subtotalConDescuento))}</p>
      <p><strong>Costos adicionales:</strong> ${escapeHtml(moneda(resumen.costosAdicionales))}</p>
      <p><strong>Total final:</strong> ${escapeHtml(moneda(resumen.total))}</p>
    `
    : `
      <p><strong>Subtotal:</strong> ${escapeHtml(moneda(resumen.subtotalBruto))}</p>
      <p><strong>Descuento aplicado:</strong> Sin descuento / 0%</p>
      <p><strong>Costos adicionales:</strong> ${escapeHtml(moneda(resumen.costosAdicionales))}</p>
      <p><strong>Total final:</strong> ${escapeHtml(moneda(resumen.total))}</p>
    `;

export const buildCotizacionCreadaClienteTemplate = (payload: any): MailData => {
  const items = normalizarItems(payload);
  const resumen = calcularResumen(payload, items);
  const acceso = payload.accesoCliente;
  const mensajeAccesoTexto = acceso?.linkCrearPassword
    ? [
        "Creamos un acceso para que puedas consultar el estado de tu pedido.",
        `Crea tu contrasena aqui: ${acceso.linkCrearPassword}`,
      ]
    : acceso?.usuarioExistente
      ? [
          "Ya tienes una cuenta para consultar el estado de tu pedido.",
          "Puedes iniciar sesion con tu correo cuando quieras revisar el proceso.",
        ]
      : [];
  const mensajeAccesoHtml = acceso?.linkCrearPassword
    ? `
      <p>Creamos un acceso para que puedas consultar el estado de tu pedido.</p>
      <p><a href="${escapeHtml(acceso.linkCrearPassword)}">Crear contrasena de acceso</a></p>
    `
    : acceso?.usuarioExistente
      ? `
        <p>Ya tienes una cuenta para consultar el estado de tu pedido.</p>
        <p>Puedes iniciar sesion con tu correo cuando quieras revisar el proceso.</p>
      `
      : "";

  return {
    to: payload.cliente.correo,
    subject: `Cotizacion PIXEL #${payload.idCotizacion}`,
    text: [
      `Hola ${payload.cliente.nombre}.`,
      "",
      `Recibimos tu cotizacion #${payload.idCotizacion}.`,
      resumenTexto(items),
      "",
      resumenTotalesTexto(resumen),
      `Observaciones: ${textoSeguro(payload.observaciones, "Sin observaciones")}`,
      "",
      "El valor final sera confirmado por nuestro equipo.",
      "Por este mismo correo te notificaremos si la cotizacion avanza a pedido.",
      ...mensajeAccesoTexto,
      "",
      "PIXEL",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(payload.cliente.nombre)}.</p>
      <p>Recibimos tu cotizacion #${escapeHtml(payload.idCotizacion)}.</p>
      ${tablaItems(items)}
      ${resumenTotalesHtml(resumen)}
      <p><strong>Observaciones:</strong> ${escapeHtml(textoSeguro(payload.observaciones, "Sin observaciones"))}</p>
      <p>El valor final sera confirmado por nuestro equipo.</p>
      <p>Por este mismo correo te notificaremos si la cotizacion avanza a pedido.</p>
      ${mensajeAccesoHtml}
      <p>PIXEL</p>
    `,
  };
};

export const buildCotizacionCreadaStaffTemplate = (to: string, payload: any): MailData => {
  const items = normalizarItems(payload);
  const resumen = calcularResumen(payload, items);

  return {
    to,
    subject: `Nueva cotizacion publica #${payload.idCotizacion}`,
    text: [
      `Cliente: ${payload.cliente.nombre}`,
      `Correo: ${payload.cliente.correo ?? "No registrado"}`,
      `Telefono: ${payload.cliente.telefono ?? "No registrado"}`,
      "",
      resumenTexto(items),
      "",
      resumenTotalesTexto(resumen),
      `Observaciones: ${textoSeguro(payload.observaciones, "Sin observaciones")}`,
    ].join("\n"),
  };
};

export const buildPedidoCreadoTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);

  return {
    to: pedido.cliente.correo,
    subject: "Tu cotizacion fue aprobada y se creo tu pedido - PIXEL",
    text: [
      `Hola ${pedido.cliente.nombre}.`,
      "",
      `Tu cotizacion #${pedido.idCotizacion} fue aprobada y se creo el pedido #${pedido.idPedido}.`,
      resumenTexto(items),
      "",
      resumenTotalesTexto(resumen),
      "Estado actual: PENDIENTE.",
      "Siguiente paso: realiza el primer abono para iniciar el proceso.",
      "El pedido empezara cuando el abono sea registrado y confirmado por nuestro equipo.",
      "",
      "Gracias por confiar en PIXEL.",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(pedido.cliente.nombre)}.</p>
      <p>Tu cotizacion #${escapeHtml(pedido.idCotizacion)} fue aprobada y se creo el pedido #${escapeHtml(pedido.idPedido)}.</p>
      ${tablaItems(items)}
      ${resumenTotalesHtml(resumen)}
      <p><strong>Estado actual:</strong> PENDIENTE.</p>
      <p><strong>Siguiente paso:</strong> realiza el primer abono para iniciar el proceso.</p>
      <p>El pedido empezara cuando el abono sea registrado y confirmado por nuestro equipo.</p>
      <p>Gracias por confiar en PIXEL.</p>
    `,
  };
};

export const buildPrimerAbonoConfirmadoTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;

  return {
    to: pedido.cliente.correo,
    subject: "Abono confirmado, iniciamos tu pedido - PIXEL",
    text: [
      `Hola ${pedido.cliente.nombre}.`,
      "",
      `Confirmamos el primer abono del pedido #${pedido.idPedido}.`,
      `Monto confirmado: ${moneda(payload.abono?.monto)}`,
      `Total del pedido: ${moneda(pedido.total)}`,
      "Estado actual: EN PROCESO o pendiente de etapa interna segun el flujo actual.",
      "Siguiente paso: inicia la etapa de diseno/produccion. Si aplica, envianos detalles, disenos o referencias pendientes.",
      "",
      "Seguimos atentos a tu pedido. PIXEL",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(pedido.cliente.nombre)}.</p>
      <p>Confirmamos el primer abono del pedido #${escapeHtml(pedido.idPedido)}.</p>
      <p><strong>Monto confirmado:</strong> ${escapeHtml(moneda(payload.abono?.monto))}</p>
      <p><strong>Total del pedido:</strong> ${escapeHtml(moneda(pedido.total))}</p>
      <p><strong>Estado actual:</strong> EN PROCESO o pendiente de etapa interna segun el flujo actual.</p>
      <p><strong>Siguiente paso:</strong> inicia la etapa de diseno/produccion. Si aplica, envianos detalles, disenos o referencias pendientes.</p>
      <p>Seguimos atentos a tu pedido. PIXEL</p>
    `,
  };
};

export const buildPedidoFinalizadoTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);
  const entrega =
    process.env.PIXEL_DELIVERY_INFO ??
    "Nuestro equipo se comunicara contigo para coordinar la entrega.";

  return {
    to: pedido.cliente.correo,
    subject: "Tu pedido esta listo para reclamar - PIXEL",
    text: [
      `Hola ${pedido.cliente.nombre}.`,
      "",
      `Tu pedido #${pedido.idPedido} fue finalizado y esta listo para reclamar/recoger.`,
      resumenTexto(items),
      "",
      resumenTotalesTexto(resumen),
      "Estado actual: FINALIZADO.",
      `Siguiente paso: ${entrega}`,
      "",
      "Gracias por elegir PIXEL.",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(pedido.cliente.nombre)}.</p>
      <p>Tu pedido #${escapeHtml(pedido.idPedido)} fue finalizado y esta listo para reclamar/recoger.</p>
      ${tablaItems(items)}
      ${resumenTotalesHtml(resumen)}
      <p><strong>Estado actual:</strong> FINALIZADO.</p>
      <p><strong>Siguiente paso:</strong> ${escapeHtml(entrega)}</p>
      <p>Gracias por elegir PIXEL.</p>
    `,
  };
};
