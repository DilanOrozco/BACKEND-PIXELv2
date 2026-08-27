import { escapeHtml, type MailData } from "./email.service";
import {
  formatCurrencyCOP,
  formatEmailDate,
  formatEmailDateTime,
  humanizeOrderStatus,
} from "./email-formatters";
import {
  buildEmailLayout,
  emailButton,
  emailCallout,
  emailInfoRows,
  emailProductCard,
} from "./email-layout";

export const EMAIL_EVENTS = {
  SOLICITUD_COTIZACION_RECIBIDA: "SOLICITUD_COTIZACION_RECIBIDA",
  PROPUESTA_COTIZACION_ENVIADA: "PROPUESTA_COTIZACION_ENVIADA",
  RESPUESTA_COTIZACION_REGISTRADA: "RESPUESTA_COTIZACION_REGISTRADA",
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

const numeroSeguro = (valor: unknown) => {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
};

const moneda = formatCurrencyCOP;

const frontendUrl = (ruta: string) =>
  `${String(process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, "")}${ruta}`;

const saludoHtml = (nombre: unknown) =>
  `<p style="margin:0 0 14px;font-size:16px;line-height:24px;">Hola, <strong>${escapeHtml(textoSeguro(nombre, "cliente"))}</strong>.</p>`;

const parrafo = (contenido: string) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#3f384b;">${contenido}</p>`;

const textoSeguro = (valor: unknown, fallback = "No registrado") => {
  if (valor === null || valor === undefined) {
    return fallback;
  }

  const texto = String(valor).trim();
  return texto === "" ? fallback : texto;
};

const normalizarSolicitudItems = (entidad: any) =>
  (entidad?.detalles ?? entidad?.items ?? []).map((detalle: any) => ({
    producto: textoSeguro(
      detalle?.producto?.nombre ??
        detalle?.nombrePersonalizado ??
        detalle?.descripcionPersonalizada ??
        detalle?.descripcion,
      "Producto especial",
    ),
    cantidad: numeroSeguro(detalle?.cantidad),
    observaciones: textoSeguro(detalle?.observaciones, "Sin observaciones"),
    estampados: (detalle?.estampados ?? []).map((estampado: any) => ({
      tecnica: textoSeguro(estampado?.tecnica?.nombre, "Por definir"),
      ubicacion: textoSeguro(estampado?.ubicacion, "Por definir"),
      medidas:
        estampado?.anchoCm != null && estampado?.altoCm != null
          ? `${textoSeguro(estampado.anchoCm)} x ${textoSeguro(estampado.altoCm)} cm`
          : "Por definir",
    })),
  }));

const solicitudItemsTexto = (items: any[]) =>
  items
    .map((item) => {
      const servicios =
        item.estampados.length > 0
          ? item.estampados
              .map(
                (estampado: any) =>
                  `  - ${estampado.tecnica}, ${estampado.ubicacion}, ${estampado.medidas}`,
              )
              .join("\n")
          : "  - Servicios por definir";

      return `- ${item.producto} | Cantidad: ${item.cantidad}\n${servicios}\n  Observaciones: ${item.observaciones}`;
    })
    .join("\n");

const solicitudItemsHtml = (items: any[]) =>
  items
    .map((item) => {
      const servicios =
        item.estampados.length > 0
          ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #eeeaf5;"><strong style="font-size:13px;color:#4c1d95;">Servicios y estampados</strong>${item.estampados
              .map(
                (estampado: any) =>
                  `<p style="margin:7px 0 0;font-size:13px;line-height:20px;color:#4b4457;">${escapeHtml(estampado.tecnica)} · ${escapeHtml(estampado.ubicacion)} · ${escapeHtml(estampado.medidas)}</p>`,
              )
              .join("")}</div>`
          : emailCallout("Servicios y medidas por definir.", "warning");

      return emailProductCard({
        title: item.producto,
        rows: [
          { label: "Cantidad", value: item.cantidad },
          { label: "Observaciones", value: item.observaciones },
        ],
        servicesHtml: servicios,
      });
    })
    .join("");

export const buildSolicitudCotizacionRecibidaTemplate = (
  payload: any,
): MailData => {
  const items = normalizarSolicitudItems(payload);
  const nombre = textoSeguro(payload?.cliente?.nombre, "cliente");
  const linkAcceso = payload?.accesoCliente?.linkCrearPassword;
  const expiracionAcceso = payload?.accesoCliente?.fechaExpiracion;
  const accesoTexto = linkAcceso
    ? `\nCrea tu contrasena para consultar tus cotizaciones y pedidos: ${linkAcceso}${expiracionAcceso ? `\nEste enlace estara disponible hasta ${formatEmailDateTime(expiracionAcceso)}.` : ""}\n`
    : "";
  const accesoHtml = linkAcceso
    ? `${parrafo("Creamos un acceso para que puedas consultar tus cotizaciones y pedidos.")}${expiracionAcceso ? parrafo(`Este enlace estará disponible hasta el ${escapeHtml(formatEmailDateTime(expiracionAcceso))}.`) : ""}${emailButton("Crear mi contraseña", linkAcceso)}`
    : "";

  return {
    to: payload?.cliente?.correo,
    subject: "Recibimos tu solicitud de cotización - PIXEL",
    text: `Hola ${nombre},

Recibimos tu solicitud:
${solicitudItemsTexto(items)}

El equipo de PIXEL revisara la solicitud y confirmara el precio. Por ahora no existe una propuesta oficial ni un valor para aceptar.
${accesoTexto}

PIXEL`,
    html: buildEmailLayout({
      title: "Tu solicitud fue recibida correctamente",
      preheader: "Nuestro equipo revisará los detalles para preparar tu propuesta.",
      tone: "warning",
      body: `${saludoHtml(nombre)}
        ${parrafo("Gracias por contarnos qué necesitas. Ahora nuestro equipo revisará los productos, estampados, medidas y diseños para preparar el precio final.")}
        ${emailInfoRows([{ label: "Solicitud", value: payload?.idCotizacion ? `#${payload.idCotizacion}` : "Recibida" }])}
        ${solicitudItemsHtml(items)}
        ${emailCallout("Aún no existe un precio oficial. Te avisaremos por este mismo correo cuando tu propuesta esté lista.", "warning")}
        ${accesoHtml}`,
    }),
  };
};

export const buildPropuestaCotizacionEnviadaTemplate = (
  payload: any,
): MailData => {
  const version = payload?.version ?? {};
  const desglose = version?.desgloseVisible ?? {};
  const items = desglose.items ?? [];
  const disenos = Array.isArray(desglose.disenos)
    ? desglose.disenos
    : [];
  const conceptos = Array.isArray(desglose.conceptosAdicionales)
    ? desglose.conceptosAdicionales
    : [];
  const itemsSolicitud = normalizarSolicitudItems({ items });
  const cliente = textoSeguro(payload?.cliente?.nombre, "cliente");
  const url = frontendUrl("/mis-cotizaciones");
  const filas = items
    .map(
      (item: any, indice: number) => {
        const servicios = itemsSolicitud[indice]?.estampados ?? [];
        const serviciosHtml =
          servicios.length > 0
            ? `<ul>${servicios
                .map(
                  (servicio: any) =>
                    `<li>${escapeHtml(servicio.tecnica)} - ${escapeHtml(servicio.ubicacion)} - ${escapeHtml(servicio.medidas)}</li>`,
                )
                .join("")}</ul>`
            : "Por definir";
        return emailProductCard({
          title: textoSeguro(item.nombre, "Producto"),
          rows: [
            { label: "Cantidad", value: numeroSeguro(item.cantidad) },
            ...(item.precioUnitario !== undefined
              ? [{ label: "Precio unitario", value: moneda(item.precioUnitario) }]
              : []),
            { label: "Subtotal", value: moneda(item.subtotal) },
          ],
          servicesHtml: `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #eeeaf5;"><strong style="font-size:13px;color:#4c1d95;">Estampados y servicios</strong>${serviciosHtml}</div>`,
        });
      },
    )
    .join("");
  const textoItems = items
    .map(
      (item: any, indice: number) => {
        const servicios = itemsSolicitud[indice]?.estampados ?? [];
        const resumenServicios =
          servicios.length > 0
            ? servicios
                .map(
                  (servicio: any) =>
                    `${servicio.tecnica} (${servicio.ubicacion}, ${servicio.medidas})`,
                )
                .join("; ")
            : "Servicios por definir";
        return `- ${textoSeguro(item.nombre, "Producto")} | ${numeroSeguro(item.cantidad)} unidad(es) | ${resumenServicios} | ${moneda(item.subtotal)}`;
      },
    )
    .join("\n");
  const filasAdicionales = [
    ...disenos.map(
      (diseno: any) =>
        ({ label: textoSeguro(diseno.descripcion, "Diseño"), value: moneda(diseno.valor) }),
    ),
    ...conceptos.map(
      (concepto: any) =>
        ({ label: textoSeguro(concepto.concepto, "Concepto adicional"), value: moneda(concepto.valor) }),
    ),
  ];
  const textoAdicionales = [
    ...disenos.map(
      (diseno: any) =>
        `${textoSeguro(diseno.descripcion, "Diseno")}: ${moneda(diseno.valor)}`,
    ),
    ...conceptos.map(
      (concepto: any) =>
        `${textoSeguro(concepto.concepto, "Concepto adicional")}: ${moneda(concepto.valor)}`,
    ),
  ].join("\n");
  const ajusteComercial = Number(desglose.ajusteComercial ?? 0);
  const lineaAjusteTexto =
    ajusteComercial !== 0
      ? `Ajuste comercial: ${moneda(ajusteComercial)}`
      : "";
  return {
    to: payload?.cliente?.correo,
    subject: "Tu propuesta de cotización está lista - PIXEL",
    text: `Hola ${cliente},

Tu propuesta de cotización está lista.
Propuesta #${numeroSeguro(version.numeroVersion)}
${textoItems}

${textoAdicionales}
Descuento comercial: -${moneda(desglose.descuentoManual ?? version.descuentoManual)}
${lineaAjusteTexto}
Total final: ${moneda(version.precioFinal)}
Válida hasta: ${formatEmailDateTime(version.validaHasta)}

Puedes revisarla, aceptarla, rechazarla o solicitar un ajuste en ${url}.

PIXEL`,
    html: buildEmailLayout({
      title: "Tu propuesta está lista",
      preheader: `Valor final: ${moneda(version.precioFinal)}`,
      body: `${saludoHtml(cliente)}
        ${parrafo("Hemos revisado tu solicitud y preparamos una propuesta con los detalles y el valor final.")}
        ${emailInfoRows([
          { label: "Cotización", value: payload?.cotizacion?.idCotizacion ? `#${payload.cotizacion.idCotizacion}` : "PIXEL" },
          { label: "Propuesta", value: `#${numeroSeguro(version.numeroVersion)}` },
          { label: "Fecha", value: formatEmailDate(version.enviadaAt ?? new Date()) },
          { label: "Vigencia", value: `Hasta el ${formatEmailDateTime(version.validaHasta)}` },
        ])}
        ${filas}
        ${filasAdicionales.length > 0 ? emailInfoRows(filasAdicionales) : ""}
        ${emailInfoRows([
          { label: "Descuento comercial", value: `-${moneda(desglose.descuentoManual ?? version.descuentoManual)}` },
          ...(ajusteComercial !== 0 ? [{ label: "Ajuste comercial", value: moneda(ajusteComercial) }] : []),
        ])}
        ${emailCallout(`<div style="font-size:13px;color:#5b5368;">Total final</div><div style="margin-top:4px;font-size:28px;font-weight:bold;color:#4c1d95;">${escapeHtml(moneda(version.precioFinal))}</div>`)}
        ${emailButton("Revisar propuesta", url)}
        ${parrafo("Desde tu cuenta puedes aceptarla, rechazarla o solicitar un ajuste. Si prefieres hacerlo por otro medio, comunícate con nuestro equipo.")}`,
    }),
  };
};

export const buildRespuestaCotizacionTemplate = (payload: any): MailData => {
  const respuesta = payload?.respuesta ?? {};
  const version = payload?.version ?? {};
  const cliente = textoSeguro(payload?.cliente?.nombre, "cliente");
  const decision = textoSeguro(respuesta.decision, "REGISTRADA");
  const medio = textoSeguro(respuesta.medio, "SISTEMA");
  const aceptada = decision === "ACEPTAR";
  const decisionHumana =
    decision === "ACEPTAR"
      ? "Propuesta aceptada"
      : decision === "SOLICITAR_AJUSTE"
        ? "Ajuste solicitado"
        : decision === "RECHAZAR"
          ? "Propuesta no aceptada"
          : "Respuesta recibida";
  const medioHumano =
    medio === "SISTEMA"
      ? "Portal PIXEL"
      : medio.charAt(0) + medio.slice(1).toLowerCase();
  const asunto = aceptada
    ? "Tu pedido ya está en marcha - PIXEL"
    : decision === "SOLICITAR_AJUSTE"
      ? "Recibimos tu solicitud de ajuste - PIXEL"
      : "Actualización sobre tu propuesta - PIXEL";

  return {
    to: payload?.cliente?.correo,
    subject: asunto,
    text: `Hola ${cliente},

Registramos tu respuesta a la propuesta #${numeroSeguro(version.numeroVersion)}.
Respuesta: ${decisionHumana}
Medio: ${medioHumano}
${aceptada ? `Valor aceptado: ${moneda(respuesta.precioAceptado)}\nPedido creado: #${textoSeguro(payload?.pedido?.idPedido)}` : "No se creo ningun pedido."}
Observaciones: ${textoSeguro(respuesta.observaciones, "Sin observaciones")}

PIXEL`,
    html: buildEmailLayout({
      title: aceptada
        ? "Tu pedido ya está en marcha"
        : decision === "SOLICITAR_AJUSTE"
          ? "Recibimos tu solicitud de ajuste"
          : "Actualización sobre tu propuesta",
      tone: aceptada ? "success" : decision === "SOLICITAR_AJUSTE" ? "warning" : "danger",
      body: `${saludoHtml(cliente)}
        ${parrafo(aceptada ? "Recibimos tu aceptación y creamos tu pedido para continuar con el proceso." : "Registramos tu respuesta. Nuestro equipo la tendrá en cuenta para continuar contigo.")}
        ${emailInfoRows([
          { label: "Propuesta", value: `#${numeroSeguro(version.numeroVersion)}` },
          { label: "Respuesta", value: decisionHumana, strong: true },
          { label: "Medio", value: medioHumano },
          ...(aceptada
            ? [
                { label: "Valor aceptado", value: moneda(respuesta.precioAceptado) },
                { label: "Pedido", value: `PX-${textoSeguro(payload?.pedido?.idPedido)}`, strong: true },
              ]
            : []),
        ])}
        ${respuesta.observaciones ? emailCallout(`<strong>Tu mensaje:</strong><br>${escapeHtml(respuesta.observaciones)}`, "primary") : ""}
        ${aceptada ? emailButton("Ver mi pedido", frontendUrl("/dashboard")) : ""}`,
    }),
  };
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
      (item) =>
        emailProductCard({
          title: item.producto,
          subtitle: item.categoria || "Categoría no especificada",
          rows: [
            { label: "Técnica", value: item.tecnica },
            { label: "Cantidad", value: item.cantidad },
            { label: "Precio base unitario", value: moneda(item.precioBase) },
            { label: "Descuento aplicado", value: porcentaje(item.descuentoPorcentaje) },
            { label: "Precio unitario con descuento", value: moneda(item.precioUnitario) },
            { label: "Subtotal bruto", value: moneda(item.subtotalBruto) },
            { label: "Valor descontado", value: `-${moneda(item.descuentoTotal)}` },
            { label: "Subtotal con descuento", value: moneda(item.subtotalConDescuento) },
          ],
        }),
    )
    .join("");

const tablaItems = (items: any[]) => `<div style="margin:20px 0;">${resumenHtml(items)}</div>`;

const resumenFinalCotizacionTexto = (resumen: any) =>
  [
    ...(resumen.costoDiseno > 0
      ? [`Costo de diseno: ${moneda(resumen.costoDiseno)}`]
      : []),
    `Costos adicionales: ${moneda(resumen.costosAdicionales)}`,
    `Total final: ${moneda(resumen.total)}`,
  ].join("\n");

const resumenFinalCotizacionHtml = (resumen: any) => `
  ${emailInfoRows([
    ...(resumen.costoDiseno > 0
      ? [{ label: "Costo de diseño", value: moneda(resumen.costoDiseno) }]
      : []),
    { label: "Costos adicionales", value: moneda(resumen.costosAdicionales) },
  ])}
  ${emailCallout(`<div style="font-size:13px;color:#5b5368;">Total final</div><div style="margin-top:4px;font-size:25px;font-weight:bold;color:#4c1d95;">${escapeHtml(moneda(resumen.total))}</div>`)}
`;

export const buildCotizacionCreadaClienteTemplate = (payload: any): MailData => {
  const items = normalizarSolicitudItems(payload);
  const acceso = payload.accesoCliente;
  const mensajeAccesoTexto = acceso?.linkCrearPassword
    ? [
        "Creamos un acceso para que puedas consultar el estado de tu pedido.",
        `Crea tu contrasena aqui: ${acceso.linkCrearPassword}`,
        ...(acceso.fechaExpiracion
          ? [`Este enlace estara disponible hasta ${formatEmailDateTime(acceso.fechaExpiracion)}.`]
          : []),
      ]
    : acceso?.usuarioExistente
      ? [
          "Ya tienes una cuenta para consultar el estado de tu pedido.",
          "Puedes iniciar sesion con tu correo cuando quieras revisar el proceso.",
        ]
      : [];
  const mensajeAccesoHtml = acceso?.linkCrearPassword
    ? `
      ${parrafo("Creamos un acceso para que puedas consultar tus cotizaciones y pedidos.")}
      ${acceso.fechaExpiracion ? parrafo(`Este enlace estará disponible hasta el ${escapeHtml(formatEmailDateTime(acceso.fechaExpiracion))}.`) : ""}
      ${emailButton("Crear mi contraseña", acceso.linkCrearPassword)}
    `
    : acceso?.usuarioExistente
      ? `
        <p>Ya tienes una cuenta para consultar el estado de tu pedido.</p>
        <p>Puedes iniciar sesion con tu correo cuando quieras revisar el proceso.</p>
      `
      : "";

  return {
    to: payload.cliente.correo,
    subject: "Recibimos tu solicitud de cotización - PIXEL",
    text: [
      `Hola ${payload.cliente.nombre}.`,
      "",
      "Recibimos tu solicitud de cotizacion.",
      solicitudItemsTexto(items),
      `Observaciones: ${textoSeguro(payload.observaciones, "Sin observaciones")}`,
      "",
      "Ahora nuestro equipo revisara los productos, estampados, medidas y disenos para preparar el precio final.",
      "Te notificaremos por este mismo correo cuando la propuesta este lista.",
      ...mensajeAccesoTexto,
      "",
      "PIXEL",
    ].join("\n"),
    html: buildEmailLayout({
      title: "Tu solicitud fue recibida correctamente",
      tone: "warning",
      body: `${saludoHtml(payload.cliente.nombre)}
        ${parrafo("Ahora nuestro equipo revisará los productos, estampados, medidas y diseños para preparar el precio final.")}
        ${emailInfoRows([{ label: "Solicitud", value: payload.idCotizacion ? `#${payload.idCotizacion}` : "Recibida" }])}
        ${solicitudItemsHtml(items)}
        ${payload.observaciones ? emailCallout(`<strong>Observaciones:</strong><br>${escapeHtml(payload.observaciones)}`) : ""}
        ${emailCallout("Te notificaremos por este mismo correo cuando tu propuesta esté lista. Por ahora no existe un valor oficial para aceptar.", "warning")}
        ${mensajeAccesoHtml}`,
    }),
  };
};

export const buildCotizacionPresencialCreadaClienteTemplate = (
  payload: any,
): MailData => {
  const items = normalizarSolicitudItems(payload);
  const acceso = payload.accesoCliente;
  const mensajeAccesoTexto = acceso?.linkCrearPassword
    ? [
        "Creamos un acceso para que puedas consultar el seguimiento si tu pedido avanza.",
        `Crea tu contrasena aqui: ${acceso.linkCrearPassword}`,
        ...(acceso.fechaExpiracion
          ? [`Este enlace estara disponible hasta ${formatEmailDateTime(acceso.fechaExpiracion)}.`]
          : []),
      ]
    : acceso?.usuarioExistente
      ? [
          "Puedes iniciar sesion con tu correo para consultar el seguimiento si tu pedido avanza.",
        ]
      : [];
  const mensajeAccesoHtml = acceso?.linkCrearPassword
    ? `${parrafo("Creamos un acceso para que puedas consultar tus cotizaciones y pedidos.")}
       ${acceso.fechaExpiracion ? parrafo(`Este enlace estará disponible hasta el ${escapeHtml(formatEmailDateTime(acceso.fechaExpiracion))}.`) : ""}
       ${emailButton("Crear mi contraseña", acceso.linkCrearPassword)}`
    : acceso?.usuarioExistente
      ? "<p>Puedes iniciar sesion con tu correo para consultar el seguimiento si tu pedido avanza.</p>"
      : "";

  return {
    to: payload.cliente.correo,
    subject: "Recibimos tu solicitud de cotización – PIXEL",
    text: [
      `Hola ${payload.cliente.nombre}.`,
      "",
      "Registramos tu cotizacion presencial.",
      solicitudItemsTexto(items),
      `Observaciones: ${textoSeguro(payload.observaciones, "Sin observaciones")}`,
      "",
      "Nuestro equipo revisara los detalles y te compartira una propuesta final.",
      ...mensajeAccesoTexto,
      "",
      "PIXEL",
    ].join("\n"),
    html: buildEmailLayout({
      title: "Tu solicitud fue registrada",
      tone: "warning",
      body: `${saludoHtml(payload.cliente.nombre)}
        ${parrafo("Registramos la información que compartiste con nuestro equipo. Ahora revisaremos los detalles para preparar tu propuesta final.")}
        ${solicitudItemsHtml(items)}
        ${payload.observaciones ? emailCallout(`<strong>Observaciones:</strong><br>${escapeHtml(payload.observaciones)}`) : ""}
        ${emailCallout("Te avisaremos cuando el valor final esté listo.", "warning")}
        ${mensajeAccesoHtml}`,
    }),
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
    subject: "Actualizamos tu cotización - PIXEL",
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
    html: buildEmailLayout({
      title: "Actualizamos tu cotización",
      tone: "primary",
      body: `${saludoHtml(cotizacion.cliente.nombre)}
        ${parrafo("Realizamos un ajuste en tu cotización para que refleje mejor lo que necesitas.")}
        ${emailCallout(`<strong>Motivo del cambio:</strong><br>${escapeHtml(motivo)}`)}
        ${payload.totalAnterior !== undefined ? emailInfoRows([{ label: "Total anterior", value: moneda(payload.totalAnterior) }]) : ""}
        ${tablaItems(items)}
        ${resumenFinalCotizacionHtml(resumen)}
        ${cotizacion.observaciones ? emailCallout(`<strong>Observaciones:</strong><br>${escapeHtml(cotizacion.observaciones)}`) : ""}
        ${parrafo("Si tienes alguna pregunta sobre este ajuste, responde a este correo y con gusto te ayudaremos.")}`,
    }),
  };
};

export const buildCotizacionCreadaStaffTemplate = (to: string, payload: any): MailData => {
  const items = normalizarItems(payload);
  const resumen = calcularResumen(payload, items);

  return {
    to,
    subject: `Nueva solicitud de cotización #${payload.idCotizacion}`,
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
    html: buildEmailLayout({
      title: "Nueva solicitud de cotización",
      preheader: `Solicitud #${payload.idCotizacion}`,
      body: `${emailInfoRows([
        { label: "Solicitud", value: `#${payload.idCotizacion}` },
        { label: "Cliente", value: payload.cliente.nombre },
        { label: "Correo", value: payload.cliente.correo ?? "No registrado" },
        { label: "Teléfono", value: payload.cliente.telefono ?? "No registrado" },
      ])}
      ${tablaItems(items)}
      ${resumenFinalCotizacionHtml(resumen)}
      ${payload.observaciones ? emailCallout(`<strong>Observaciones:</strong><br>${escapeHtml(payload.observaciones)}`) : ""}`,
    }),
  };
};

export const buildPedidoCreadoTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);
  const trazabilidadTexto: string[] = [];
  return {
    to: pedido.cliente.correo,
    subject: "Tu pedido ya está en marcha - PIXEL",
    text: [
      `Hola ${pedido.cliente.nombre}.`,
      "",
      "Tu pedido fue creado correctamente.",
      `Numero de pedido: ${pedido.idPedido}.`,
      ...trazabilidadTexto,
      resumenTexto(items),
      "",
      resumenFinalCotizacionTexto(resumen),
      "Estado actual: pendiente de iniciar.",
      "Siguiente paso: realizar el primer abono.",
      "Para continuar necesitamos registrar el primer abono. Nuestro equipo te indicara los pasos por telefono o correo.",
      "Un asesor de PIXEL se comunicara contigo para confirmar detalles del diseno, forma de pago, abonos y tiempos de entrega.",
      "",
      "Gracias por confiar en PIXEL.",
    ].join("\n"),
    html: buildEmailLayout({
      title: "Tu pedido ya está en marcha",
      tone: "success",
      body: `${saludoHtml(pedido.cliente.nombre)}
        ${parrafo(`Tu cotización fue aceptada y ahora es el pedido <strong>PX-${escapeHtml(pedido.idPedido)}</strong>.`)}
        ${emailInfoRows([
          { label: "Pedido", value: `PX-${pedido.idPedido}`, strong: true },
          { label: "Total", value: moneda(resumen.total), strong: true },
          { label: "Estado", value: humanizeOrderStatus(pedido.estadoPedido ?? "PENDIENTE") },
        ])}
        ${tablaItems(items)}
        ${emailCallout("Para continuar necesitamos registrar el primer abono. El proceso comenzará cuando nuestro equipo confirme el pago.", "warning")}
        ${emailButton("Ver mi pedido", frontendUrl("/dashboard"))}
        ${parrafo("Nuestro equipo te acompañará con los detalles de diseño, pago y tiempos de entrega.")}`,
    }),
  };
};

export const buildPrimerAbonoConfirmadoTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);

  return {
    to: pedido.cliente.correo,
    subject: "Recibimos y confirmamos tu pago - PIXEL",
    text: [
      `Hola ${pedido.cliente.nombre}.`,
      "",
      `Confirmamos el primer abono del pedido #${pedido.idPedido}.`,
      `Monto confirmado: ${moneda(payload.abono?.monto)}`,
      `Fecha: ${formatEmailDateTime(payload.abono?.fechaConfirmacion ?? payload.abono?.fechaCreacion ?? new Date())}`,
      `Total pagado: ${moneda(pedido.totalPagado ?? payload.abono?.monto)}`,
      `Saldo pendiente: ${moneda(pedido.saldoPendiente)}`,
      resumenTexto(items),
      resumenFinalCotizacionTexto(resumen),
      numeroSeguro(pedido.saldoPendiente) <= 0
        ? "Tu pedido esta completamente pagado."
        : `Aun queda un saldo pendiente de ${moneda(pedido.saldoPendiente)}.`,
      "Siguiente paso: continuaremos con el diseno o la produccion segun corresponda. Si aplica, envianos detalles, disenos o referencias pendientes.",
      "",
      "Seguimos atentos a tu pedido. PIXEL",
    ].join("\n"),
    html: buildEmailLayout({
      title: "Recibimos y confirmamos tu pago",
      tone: "success",
      body: `${saludoHtml(pedido.cliente.nombre)}
        ${parrafo("Tu abono fue confirmado correctamente. Ya podemos continuar con las siguientes etapas de tu pedido.")}
        ${emailInfoRows([
          { label: "Pedido", value: `PX-${pedido.idPedido}` },
          { label: "Monto confirmado", value: moneda(payload.abono?.monto), strong: true },
          { label: "Fecha", value: formatEmailDateTime(payload.abono?.fechaConfirmacion ?? payload.abono?.fechaCreacion ?? new Date()) },
          { label: "Total pagado", value: moneda(pedido.totalPagado ?? payload.abono?.monto) },
          { label: "Saldo restante", value: moneda(pedido.saldoPendiente), strong: true },
        ])}
        ${numeroSeguro(pedido.saldoPendiente) <= 0
          ? emailCallout("Tu pedido está completamente pagado.", "success")
          : emailCallout(`Aún queda un saldo pendiente de <strong>${escapeHtml(moneda(pedido.saldoPendiente))}</strong>.`, "warning")}
        ${tablaItems(items)}
        ${emailButton("Ver mi pedido", frontendUrl("/dashboard"))}
        ${parrafo("Si todavía faltan diseños o referencias, puedes compartirlos con nuestro equipo para continuar.")}`,
    }),
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
    subject: "¡Tu pedido está listo! - PIXEL",
    text: [
      `Hola ${pedido.cliente.nombre}.`,
      "",
      `Tu pedido #${pedido.idPedido} fue finalizado y esta listo para reclamar/recoger.`,
      resumenTexto(items),
      "",
      resumenFinalCotizacionTexto(resumen),
      `Siguiente paso: ${entrega}`,
      "",
      "Gracias por elegir PIXEL.",
    ].join("\n"),
    html: buildEmailLayout({
      title: "¡Tu pedido está listo!",
      tone: "success",
      body: `${saludoHtml(pedido.cliente.nombre)}
        ${parrafo("Terminamos la producción de tu pedido y ya podemos coordinar la entrega o recogida.")}
        ${emailInfoRows([
          { label: "Pedido", value: `PX-${pedido.idPedido}` },
          { label: "Fecha", value: formatEmailDate(pedido.fechaFinalizado ?? new Date()) },
          { label: "Total", value: moneda(resumen.total) },
        ])}
        ${tablaItems(items)}
        ${emailCallout(`<strong>Siguiente paso</strong><br>${escapeHtml(entrega)}`, "success")}
        ${emailButton("Ver mi pedido", frontendUrl("/dashboard"))}`,
    }),
  };
};

export const buildPedidoEnProduccionTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);

  return {
    to: pedido.cliente.correo,
    subject: "Tu diseño fue aprobado y tu pedido entró en producción - PIXEL",
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
    html: buildEmailLayout({
      title: "Tu pedido entró en producción",
      tone: "success",
      body: `${saludoHtml(pedido.cliente.nombre)}
        ${parrafo("Los diseños requeridos ya fueron aprobados y comenzamos la producción de tu pedido.")}
        ${emailInfoRows([
          { label: "Pedido", value: `PX-${pedido.idPedido}` },
          ...(pedido.fechaEntregaEstimada ? [{ label: "Entrega estimada", value: formatEmailDate(pedido.fechaEntregaEstimada) }] : []),
        ])}
        ${tablaItems(items)}
        ${emailCallout("Cuando la producción termine, te notificaremos el saldo final si corresponde.", "primary")}
        ${parrafo("Un asesor de PIXEL se comunicará contigo si necesitamos confirmar algún detalle adicional.")}`,
    }),
  };
};

export const buildDisenoEnviadoParaRevisionTemplate = (payload: any): MailData => {
  const diseno = payload.diseno;
  const pedido = diseno?.pedido;
  const cliente = pedido?.cliente;
  const descripcion = textoSeguro(diseno?.descripcion, "Diseno de tu pedido");

  return {
    to: cliente.correo,
    subject: "Tu diseño está listo para revisión - PIXEL",
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
    html: buildEmailLayout({
      title: "Tu diseño está listo para revisión",
      tone: "primary",
      body: `${saludoHtml(cliente.nombre)}
        ${parrafo("Preparamos el diseño de tu pedido. Revísalo con calma y cuéntanos si está listo para continuar o si necesitas algún ajuste.")}
        ${emailInfoRows([
          { label: "Pedido", value: `PX-${pedido.idPedido}` },
          { label: "Diseño", value: descripcion },
        ])}
        ${emailButton("Revisar diseño", frontendUrl("/dashboard/cliente/disenos"))}
        ${parrafo("Si recibiste el diseño por WhatsApp, correo u otro medio, también puedes responder directamente a nuestro equipo.")}`,
    }),
  };
};

export const buildPedidoAnuladoTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);
  const motivo = textoSeguro(payload.motivo, "Nuestro equipo registró la anulacion del pedido.");

  return {
    to: pedido.cliente.correo,
    subject: "Actualización sobre tu pedido - PIXEL",
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
    html: buildEmailLayout({
      title: "Actualización sobre tu pedido",
      tone: "danger",
      body: `${saludoHtml(pedido.cliente.nombre)}
        ${parrafo(`El pedido <strong>PX-${escapeHtml(pedido.idPedido)}</strong> fue cancelado.`)}
        ${emailCallout(`<strong>Motivo</strong><br>${escapeHtml(motivo)}`, "danger")}
        ${tablaItems(items)}
        ${parrafo("Si necesitas más información o deseas revisar otras opciones, responde a este correo y te ayudaremos.")}`,
    }),
  };
};

export const buildPedidoEntregadoTemplate = (payload: any): MailData => {
  const pedido = payload.pedido;
  const items = normalizarItems(pedido);
  const resumen = calcularResumen(pedido, items);

  return {
    to: pedido.cliente.correo,
    subject: "Pedido entregado - PIXEL",
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
    html: buildEmailLayout({
      title: "Pedido entregado",
      tone: "success",
      body: `${saludoHtml(pedido.cliente.nombre)}
        ${parrafo(`Confirmamos la entrega del pedido <strong>PX-${escapeHtml(pedido.idPedido)}</strong>.`)}
        ${emailInfoRows([
          { label: "Pedido", value: `PX-${pedido.idPedido}` },
          { label: "Fecha de entrega", value: formatEmailDate(pedido.fechaEntregado ?? new Date()) },
        ])}
        ${tablaItems(items)}
        ${emailCallout("Gracias por confiar en PIXEL. Esperamos que el resultado haya quedado justo como lo imaginabas.", "success")}
        ${parrafo("Puedes contactarnos si necesitas soporte o quieres comenzar un nuevo pedido.")}`,
    }),
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
    subject: "Tu pedido está por terminar - PIXEL",
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
    html: buildEmailLayout({
      title: "Tu pedido está por terminar",
      tone: "warning",
      body: `${saludoHtml(pedido.cliente.nombre)}
        ${parrafo("Ya estamos finalizando tu pedido. Para coordinar la entrega queda pendiente el saldo final.")}
        ${emailInfoRows([
          { label: "Pedido", value: `PX-${pedido.idPedido}` },
          { label: "Total", value: moneda(pedido.total ?? resumen.total) },
          { label: "Pagado", value: moneda(pedido.totalPagado) },
          { label: "Saldo pendiente", value: moneda(saldoPendiente), strong: true },
        ])}
        ${tablaItems(items)}
        ${emailCallout("Nuestro equipo debe confirmar el pago del saldo antes de coordinar la entrega.", "warning")}
        ${emailButton("Ver mi pedido", frontendUrl("/dashboard"))}`,
    }),
  };
};
