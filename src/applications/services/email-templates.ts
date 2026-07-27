import { escapeHtml, type MailData } from "./email.service";

export const EMAIL_EVENTS = {
  COTIZACION_CREADA: "COTIZACION_CREADA",
  COTIZACION_PRESENCIAL_CREADA: "COTIZACION_PRESENCIAL_CREADA",
  COTIZACION_MODIFICADA: "COTIZACION_MODIFICADA",
  PEDIDO_CREADO_DESDE_COTIZACION: "PEDIDO_CREADO_DESDE_COTIZACION",
  PRIMER_ABONO_CONFIRMADO: "PRIMER_ABONO_CONFIRMADO",
  PEDIDO_PENDIENTE_SALDO_FINAL: "PEDIDO_PENDIENTE_SALDO_FINAL",
  PEDIDO_FINALIZADO: "PEDIDO_FINALIZADO",
  PEDIDO_EN_PRODUCCION: "PEDIDO_EN_PRODUCCION",
  PEDIDO_ENTREGADO: "PEDIDO_ENTREGADO",
  DISENO_ENVIADO_PARA_REVISION: "DISENO_ENVIADO_PARA_REVISION",
  PEDIDO_ANULADO: "PEDIDO_ANULADO",
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
  const detalles =
    entidad?.cotizacion?.detalles ?? entidad?.detalles ?? entidad?.items ?? [];

  return detalles.map((detalle: any) => {
    const cantidad = numeroSeguro(detalle?.cantidad);
    const precioBase = numeroSeguro(
      detalle?.precioBase ?? detalle?.precioUnitario,
    );
    const precioUnitario = numeroSeguro(
      detalle?.precioUnitario ?? detalle?.precioBase,
    );
    const subtotalBrutoCalculado = precioBase * cantidad;
    const subtotalBruto = numeroSeguro(
      detalle?.subtotalBruto ?? detalle?.subtotal ?? subtotalBrutoCalculado,
    );
    const descuentoTotal = numeroSeguro(
      detalle?.descuentoTotal ??
        (detalle?.descuentoPorcentaje !== undefined
          ? subtotalBruto * (numeroSeguro(detalle.descuentoPorcentaje) / 100)
          : 0),
    );
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
        detalle?.producto?.categoriaProducto?.nombre ??
          detalle?.categoriaProducto?.nombre,
        "No especificada",
      ),
      tecnica: textoSeguro(detalle?.tecnica?.nombre, "No especificada"),
      cantidad,
      precioBase,
      descuentoPorcentaje: numeroSeguro(detalle?.descuentoPorcentaje),
      descuentoValorUnitario: numeroSeguro(detalle?.descuentoValorUnitario),
      precioUnitario,
      costoDiseno: numeroSeguro(detalle?.costoDiseno),
      subtotalBruto,
      descuentoTotal,
      subtotalConDescuento,
    };
  });
};

const calcularResumen = (entidad: any, items: any[]) => {
  const fuenteResumen = entidad?.cotizacion ?? entidad;
  const subtotalBruto = numeroSeguro(
    fuenteResumen?.subtotalBruto ??
      fuenteResumen?.subtotal ??
      items.reduce((acc, item) => acc + item.subtotalBruto, 0),
  );
  const descuentoTotal = numeroSeguro(
    fuenteResumen?.descuentoTotal ??
      items.reduce((acc, item) => acc + item.descuentoTotal, 0),
  );
  const costoDiseno = items.reduce((acc, item) => acc + item.costoDiseno, 0);
  const costosAdicionales = numeroSeguro(fuenteResumen?.costosAdicionales);
  const total = numeroSeguro(
    entidad?.total ?? fuenteResumen?.total ?? subtotalBruto - descuentoTotal + costoDiseno + costosAdicionales,
  );
  const subtotalConDescuento = numeroSeguro(
    fuenteResumen?.subtotalConDescuento ??
      fuenteResumen?.subtotalFinal ??
      subtotalBruto - descuentoTotal,
  );

  return {
    subtotalBruto,
    descuentoTotal,
    costoDiseno,
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
          item.categoria ? `- ${item.producto} (${item.categoria})` : `- ${item.producto}`,
          `  Tecnica: ${item.tecnica}`,
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
          <td>${escapeHtml(item.categoria || "No especificada")}</td>
          <td>${escapeHtml(item.tecnica)}</td>
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
        <th>Tecnica</th>
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

const resumenFinalCotizacionTexto = (resumen: any) =>
  [
    ...(resumen.costoDiseno > 0
      ? [`Costo de diseno: ${moneda(resumen.costoDiseno)}`]
      : []),
    `Costos adicionales: ${moneda(resumen.costosAdicionales)}`,
    `Total final: ${moneda(resumen.total)}`,
  ].join("\n");

const resumenFinalCotizacionHtml = (resumen: any) => `
  ${
    resumen.costoDiseno > 0
      ? `<p><strong>Costo de diseno:</strong> ${escapeHtml(moneda(resumen.costoDiseno))}</p>`
      : ""
  }
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
    subject: "Recibimos tu solicitud de cotizacion - PIXEL",
    text: [
      `Hola ${payload.cliente.nombre}.`,
      "",
      "Recibimos tu solicitud de cotizacion.",
      resumenTexto(items),
      "",
      resumenFinalCotizacionTexto(resumen),
      `Observaciones: ${textoSeguro(payload.observaciones, "Sin observaciones")}`,
      "",
      "Un asesor de PIXEL se comunicara contigo por telefono o correo para confirmar detalles como diseno, referencias, abonos, tiempos de entrega y cualquier ajuste necesario.",
      "El valor final sera confirmado por nuestro equipo.",
      "Por este mismo correo te notificaremos si la solicitud avanza a pedido.",
      ...mensajeAccesoTexto,
      "",
      "PIXEL",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(payload.cliente.nombre)}.</p>
      <p>Recibimos tu solicitud de cotizacion.</p>
      ${tablaItems(items)}
      ${resumenFinalCotizacionHtml(resumen)}
      <p><strong>Observaciones:</strong> ${escapeHtml(textoSeguro(payload.observaciones, "Sin observaciones"))}</p>
      <p>Un asesor de PIXEL se comunicara contigo por telefono o correo para confirmar detalles como diseno, referencias, abonos, tiempos de entrega y cualquier ajuste necesario.</p>
      <p>El valor final sera confirmado por nuestro equipo.</p>
      <p>Por este mismo correo te notificaremos si la solicitud avanza a pedido.</p>
      ${mensajeAccesoHtml}
      <p>PIXEL</p>
    `,
  };
};

export const buildCotizacionPresencialCreadaClienteTemplate = (
  payload: any,
): MailData => {
  const items = normalizarItems(payload);
  const resumen = calcularResumen(payload, items);
  const acceso = payload.accesoCliente;
  const mensajeAccesoTexto = acceso?.linkCrearPassword
    ? [
        "Creamos un acceso para que puedas consultar el seguimiento si tu pedido avanza.",
        `Crea tu contrasena aqui: ${acceso.linkCrearPassword}`,
      ]
    : acceso?.usuarioExistente
      ? [
          "Puedes iniciar sesion con tu correo para consultar el seguimiento si tu pedido avanza.",
        ]
      : [];
  const mensajeAccesoHtml = acceso?.linkCrearPassword
    ? `<p>Creamos un acceso para que puedas consultar el seguimiento si tu pedido avanza.</p>
       <p><a href="${escapeHtml(acceso.linkCrearPassword)}">Crear contrasena de acceso</a></p>`
    : acceso?.usuarioExistente
      ? "<p>Puedes iniciar sesion con tu correo para consultar el seguimiento si tu pedido avanza.</p>"
      : "";

  return {
    to: payload.cliente.correo,
    subject: "Registramos tu cotizacion presencial - PIXEL",
    text: [
      `Hola ${payload.cliente.nombre}.`,
      "",
      "Registramos tu cotizacion presencial.",
      resumenTexto(items),
      "",
      resumenFinalCotizacionTexto(resumen),
      `Observaciones: ${textoSeguro(payload.observaciones, "Sin observaciones")}`,
      "",
      "Un asesor de PIXEL se comunicara contigo para confirmar detalles, abonos y tiempos de entrega.",
      ...mensajeAccesoTexto,
      "",
      "PIXEL",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(payload.cliente.nombre)}.</p>
      <p>Registramos tu cotizacion presencial.</p>
      ${tablaItems(items)}
      ${resumenFinalCotizacionHtml(resumen)}
      <p><strong>Observaciones:</strong> ${escapeHtml(textoSeguro(payload.observaciones, "Sin observaciones"))}</p>
      <p>Un asesor de PIXEL se comunicara contigo para confirmar detalles, abonos y tiempos de entrega.</p>
      ${mensajeAccesoHtml}
      <p>PIXEL</p>
    `,
  };
};

export const buildCotizacionModificadaTemplate = (payload: any): MailData => {
  const cotizacion = payload.cotizacion;
  const items = normalizarItems(cotizacion);
  const resumen = calcularResumen(cotizacion, items);
  const motivo = textoSeguro(
    payload.motivoCambio,
    "Se realizaron ajustes en la cotizacion.",
  );

  return {
    to: cotizacion.cliente.correo,
    subject: "Tu cotizacion fue modificada - PIXEL",
    text: [
      `Hola ${cotizacion.cliente.nombre}.`,
      "",
      "Tu cotizacion fue modificada.",
      `Motivo del cambio: ${motivo}`,
      payload.totalAnterior !== undefined
        ? `Total anterior: ${moneda(payload.totalAnterior)}`
        : "",
      "",
      resumenTexto(items),
      "",
      resumenFinalCotizacionTexto(resumen),
      `Observaciones: ${textoSeguro(cotizacion.observaciones, "Sin observaciones")}`,
      "",
      "Un asesor de PIXEL se comunicara contigo para confirmar detalles del diseno, forma de pago, abonos y tiempos de entrega.",
      "El valor final sera confirmado por nuestro equipo.",
      "",
      "PIXEL",
    ]
      .filter((linea) => linea !== "")
      .join("\n"),
    html: `
      <p>Hola ${escapeHtml(cotizacion.cliente.nombre)}.</p>
      <p>Tu cotizacion fue modificada.</p>
      <p><strong>Motivo del cambio:</strong> ${escapeHtml(motivo)}</p>
      ${
        payload.totalAnterior !== undefined
          ? `<p><strong>Total anterior:</strong> ${escapeHtml(moneda(payload.totalAnterior))}</p>`
          : ""
      }
      ${tablaItems(items)}
      ${resumenFinalCotizacionHtml(resumen)}
      <p><strong>Observaciones:</strong> ${escapeHtml(textoSeguro(cotizacion.observaciones, "Sin observaciones"))}</p>
      <p>Un asesor de PIXEL se comunicara contigo para confirmar detalles del diseno, forma de pago, abonos y tiempos de entrega.</p>
      <p>El valor final sera confirmado por nuestro equipo.</p>
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
      resumenFinalCotizacionTexto(resumen),
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
      "Tu pedido fue creado correctamente.",
      `Numero de pedido: ${pedido.idPedido}.`,
      resumenTexto(items),
      "",
      resumenFinalCotizacionTexto(resumen),
      "Estado actual: PENDIENTE.",
      "Siguiente paso: realizar el primer abono.",
      "Para iniciar el proceso, debes realizar el primer abono. Nuestro equipo te indicara los pasos por telefono o correo.",
      "Un asesor de PIXEL se comunicara contigo para confirmar detalles del diseno, forma de pago, abonos y tiempos de entrega.",
      "",
      "Gracias por confiar en PIXEL.",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(pedido.cliente.nombre)}.</p>
      <p>Tu pedido fue creado correctamente.</p>
      <p><strong>Numero de pedido:</strong> ${escapeHtml(pedido.idPedido)}</p>
      ${tablaItems(items)}
      ${resumenFinalCotizacionHtml(resumen)}
      <p><strong>Estado actual:</strong> PENDIENTE.</p>
      <p><strong>Siguiente paso:</strong> realizar el primer abono.</p>
      <p>Para iniciar el proceso, debes realizar el primer abono. Nuestro equipo te indicara los pasos por telefono o correo.</p>
      <p>Un asesor de PIXEL se comunicara contigo para confirmar detalles del diseno, forma de pago, abonos y tiempos de entrega.</p>
      <p>Gracias por confiar en PIXEL.</p>
    `,
  };
};

export const buildPrimerAbonoConfirmadoTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);

  return {
    to: pedido.cliente.correo,
    subject: "Abono confirmado, iniciamos tu pedido - PIXEL",
    text: [
      `Hola ${pedido.cliente.nombre}.`,
      "",
      `Confirmamos el primer abono del pedido #${pedido.idPedido}.`,
      `Monto confirmado: ${moneda(payload.abono?.monto)}`,
      `Saldo pendiente: ${moneda(pedido.saldoPendiente)}`,
      resumenTexto(items),
      resumenFinalCotizacionTexto(resumen),
      "Estado actual: EN PROCESO o pendiente de etapa interna segun el flujo actual.",
      "Siguiente paso: inicia la etapa de diseno/produccion. Si aplica, envianos detalles, disenos o referencias pendientes.",
      "",
      "Seguimos atentos a tu pedido. PIXEL",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(pedido.cliente.nombre)}.</p>
      <p>Confirmamos el primer abono del pedido #${escapeHtml(pedido.idPedido)}.</p>
      <p><strong>Monto confirmado:</strong> ${escapeHtml(moneda(payload.abono?.monto))}</p>
      <p><strong>Saldo pendiente:</strong> ${escapeHtml(moneda(pedido.saldoPendiente))}</p>
      ${tablaItems(items)}
      ${resumenFinalCotizacionHtml(resumen)}
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
      resumenFinalCotizacionTexto(resumen),
      "Estado actual: FINALIZADO.",
      `Siguiente paso: ${entrega}`,
      "",
      "Gracias por elegir PIXEL.",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(pedido.cliente.nombre)}.</p>
      <p>Tu pedido #${escapeHtml(pedido.idPedido)} fue finalizado y esta listo para reclamar/recoger.</p>
      ${tablaItems(items)}
      ${resumenFinalCotizacionHtml(resumen)}
      <p><strong>Estado actual:</strong> FINALIZADO.</p>
      <p><strong>Siguiente paso:</strong> ${escapeHtml(entrega)}</p>
      <p>Gracias por elegir PIXEL.</p>
    `,
  };
};

export const buildPedidoEnProduccionTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);

  return {
    to: pedido.cliente.correo,
    subject: "Tu diseno fue aprobado y tu pedido entro en produccion - PIXEL",
    text: [
      `Hola ${pedido.cliente.nombre}.`,
      "",
      "Tu diseno fue aprobado y tu pedido ya entro en produccion.",
      `Numero de pedido: ${pedido.idPedido}`,
      resumenTexto(items),
      resumenFinalCotizacionTexto(resumen),
      "",
      "Cuando la produccion termine, te notificaremos el saldo final o segundo abono si aplica.",
      "Un asesor de PIXEL se comunicara contigo si necesitamos confirmar algun detalle adicional.",
      "",
      "PIXEL",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(pedido.cliente.nombre)}.</p>
      <p>Tu diseno fue aprobado y tu pedido ya entro en produccion.</p>
      <p><strong>Numero de pedido:</strong> ${escapeHtml(pedido.idPedido)}</p>
      ${tablaItems(items)}
      ${resumenFinalCotizacionHtml(resumen)}
      <p>Cuando la produccion termine, te notificaremos el saldo final o segundo abono si aplica.</p>
      <p>Un asesor de PIXEL se comunicara contigo si necesitamos confirmar algun detalle adicional.</p>
      <p>PIXEL</p>
    `,
  };
};

export const buildDisenoEnviadoParaRevisionTemplate = (payload: any): MailData => {
  const diseno = payload.diseno;
  const pedido = diseno?.pedido;
  const cliente = pedido?.cliente;
  const descripcion = textoSeguro(diseno?.descripcion, "Diseno de tu pedido");

  return {
    to: cliente.correo,
    subject: "Tu diseno esta listo para revision - PIXEL",
    text: [
      `Hola ${cliente.nombre}.`,
      "",
      `El diseno de tu pedido #${pedido.idPedido} esta listo para revision.`,
      `Diseno: ${descripcion}`,
      "Puedes revisarlo desde tu panel de cliente, si ya tienes acceso, y aprobarlo o solicitar ajustes.",
      "Si recibes el diseno por otro medio, tambien puedes responder a nuestro equipo.",
      "",
      "PIXEL",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(cliente.nombre)}.</p>
      <p>El diseno de tu pedido #${escapeHtml(pedido.idPedido)} esta listo para revision.</p>
      <p><strong>Diseno:</strong> ${escapeHtml(descripcion)}</p>
      <p>Puedes revisarlo desde tu panel de cliente, si ya tienes acceso, y aprobarlo o solicitar ajustes.</p>
      <p>Si recibes el diseno por otro medio, tambien puedes responder a nuestro equipo.</p>
      <p>PIXEL</p>
    `,
  };
};

export const buildPedidoAnuladoTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);
  const motivo = textoSeguro(payload.motivo, "Nuestro equipo registró la anulacion del pedido.");

  return {
    to: pedido.cliente.correo,
    subject: "Actualizacion de tu pedido anulado - PIXEL",
    text: [
      `Hola ${pedido.cliente.nombre}.`,
      "",
      `Tu pedido #${pedido.idPedido} fue anulado.`,
      `Motivo: ${motivo}`,
      resumenTexto(items),
      resumenFinalCotizacionTexto(resumen),
      "Nuestro equipo puede orientarte si necesitas informacion adicional.",
      "",
      "PIXEL",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(pedido.cliente.nombre)}.</p>
      <p>Tu pedido #${escapeHtml(pedido.idPedido)} fue anulado.</p>
      <p><strong>Motivo:</strong> ${escapeHtml(motivo)}</p>
      ${tablaItems(items)}
      ${resumenFinalCotizacionHtml(resumen)}
      <p>Nuestro equipo puede orientarte si necesitas informacion adicional.</p>
      <p>PIXEL</p>
    `,
  };
};

export const buildPedidoEntregadoTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);

  return {
    to: pedido.cliente.correo,
    subject: "Tu pedido fue entregado - PIXEL",
    text: [
      `Hola ${pedido.cliente.nombre}.`,
      "",
      `Confirmamos que tu pedido #${pedido.idPedido} fue entregado o reclamado.`,
      resumenTexto(items),
      resumenFinalCotizacionTexto(resumen),
      "Gracias por confiar en PIXEL.",
      "Puedes contactarnos si necesitas soporte o quieres realizar un nuevo pedido.",
      "",
      "PIXEL",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(pedido.cliente.nombre)}.</p>
      <p>Confirmamos que tu pedido #${escapeHtml(pedido.idPedido)} fue entregado o reclamado.</p>
      ${tablaItems(items)}
      ${resumenFinalCotizacionHtml(resumen)}
      <p>Gracias por confiar en PIXEL.</p>
      <p>Puedes contactarnos si necesitas soporte o quieres realizar un nuevo pedido.</p>
      <p>PIXEL</p>
    `,
  };
};

export const buildPedidoPendienteSaldoFinalTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);
  const saldoPendiente = numeroSeguro(
    pedido?.saldoPendiente ?? numeroSeguro(pedido?.total) - numeroSeguro(pedido?.totalPagado),
  );

  return {
    to: pedido.cliente.correo,
    subject: "Tu pedido termino produccion y falta el saldo final - PIXEL",
    text: [
      `Hola ${pedido.cliente.nombre}.`,
      "",
      `Tu pedido #${pedido.idPedido} ya termino produccion.`,
      resumenTexto(items),
      resumenFinalCotizacionTexto(resumen),
      `Saldo pendiente: ${moneda(saldoPendiente)}`,
      "Para poder reclamar o recibir tu pedido, primero debemos confirmar el pago del saldo final.",
      "Un asesor de PIXEL se comunicara contigo para coordinar el pago y la entrega.",
      "",
      "Gracias por confiar en PIXEL.",
    ].join("\n"),
    html: `
      <p>Hola ${escapeHtml(pedido.cliente.nombre)}.</p>
      <p>Tu pedido #${escapeHtml(pedido.idPedido)} ya termino produccion.</p>
      ${tablaItems(items)}
      ${resumenFinalCotizacionHtml(resumen)}
      <p><strong>Saldo pendiente:</strong> ${escapeHtml(moneda(saldoPendiente))}</p>
      <p>Para poder reclamar o recibir tu pedido, primero debemos confirmar el pago del saldo final.</p>
      <p>Un asesor de PIXEL se comunicara contigo para coordinar el pago y la entrega.</p>
      <p>Gracias por confiar en PIXEL.</p>
    `,
  };
};
