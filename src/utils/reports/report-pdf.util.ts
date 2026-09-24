import PDFDocument from "pdfkit";
import type { ReporteData } from "../../applications/services/reporte.service";

type Columna = {
  titulo: string;
  ancho: number;
  valor: (registro: Record<string, unknown>) => unknown;
  formato?: "moneda" | "fecha" | "enum";
};

type ConfiguracionPdf = {
  titulo: string;
  resumen: Array<{ campo: string; etiqueta: string; moneda?: boolean; porcentaje?: boolean }>;
  columnas: Columna[];
};

const monedaCop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const fechaColombia = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Bogota",
});

const MARGENES = {
  top: 40,
  bottom: 52,
  left: 40,
  right: 40,
};

const ALTO_CABECERA_TABLA = 24;
const ALTO_TOTAL_REGISTROS = 24;

const ETIQUETAS_FILTRO: Record<string, string> = {
  estado: "Estado",
  estadoPago: "Estado de pago",
  idCliente: "Cliente",
  idPedido: "Pedido",
};

const ENUMS_PRESENTACION: Record<string, string> = {
  EN_REVISION: "En revisión",
  CONVERTIDA_EN_PEDIDO: "Convertida en pedido",
  PENDIENTE_SALDO_FINAL: "Pendiente de saldo final",
  EN_PROCESO: "En proceso",
  PENDIENTE: "Pendiente",
  FINALIZADO: "Finalizado",
  ENTREGADO: "Entregado",
  ANULADO: "Anulado",
  APROBADA: "Aprobada",
  VENCIDA: "Vencida",
  CONFIRMADO: "Confirmado",
  RECHAZADO: "Rechazado",
  PARCIAL: "Parcial",
  COMPLETO: "Completo",
};

export const humanizarEnumPdf = (valor: unknown) => {
  const texto = String(valor ?? "").trim();
  if (!texto) return "No disponible";
  if (ENUMS_PRESENTACION[texto]) return ENUMS_PRESENTACION[texto];
  if (!/^[A-ZÁÉÍÓÚÑ0-9]+(?:_[A-ZÁÉÍÓÚÑ0-9]+)*$/.test(texto)) return texto;
  const normalizado = texto.toLocaleLowerCase("es-CO").replaceAll("_", " ");
  return normalizado.charAt(0).toLocaleUpperCase("es-CO") + normalizado.slice(1);
};

const clienteNombre = (registro: Record<string, unknown>) => {
  const cliente = registro.cliente as { nombre?: string } | null | undefined;
  return cliente?.nombre ?? "No disponible";
};

const CONFIGURACIONES: Record<ReporteData["reporte"], ConfiguracionPdf> = {
  VENTAS: {
    titulo: "Reporte de Ventas",
    resumen: [
      { campo: "cantidadVentas", etiqueta: "Cantidad de ventas" },
      { campo: "totalVendido", etiqueta: "Total vendido", moneda: true },
      { campo: "ticketPromedio", etiqueta: "Ticket promedio", moneda: true },
      { campo: "cantidadClientes", etiqueta: "Clientes unicos" },
    ],
    columnas: [
      { titulo: "Venta", ancho: 60, valor: (r) => r.idVenta },
      { titulo: "Pedido", ancho: 60, valor: (r) => r.idPedido },
      { titulo: "Fecha", ancho: 85, valor: (r) => r.fecha, formato: "fecha" },
      { titulo: "Cliente", ancho: 235, valor: clienteNombre },
      { titulo: "Pago", ancho: 125, valor: (r) => r.estadoPago, formato: "enum" },
      { titulo: "Total", ancho: 196, valor: (r) => r.total, formato: "moneda" },
    ],
  },
  PEDIDOS: {
    titulo: "Reporte de Pedidos",
    resumen: [
      { campo: "totalPedidos", etiqueta: "Total de pedidos" },
      { campo: "pendientes", etiqueta: "Pendientes" },
      { campo: "enProceso", etiqueta: "En proceso" },
      { campo: "pendientesSaldoFinal", etiqueta: "Pendientes de saldo" },
      { campo: "finalizados", etiqueta: "Finalizados" },
      { campo: "entregados", etiqueta: "Entregados" },
      { campo: "anulados", etiqueta: "Anulados" },
    ],
    columnas: [
      { titulo: "Pedido", ancho: 65, valor: (r) => r.idPedido },
      { titulo: "Creación", ancho: 90, valor: (r) => r.fechaCreacion, formato: "fecha" },
      { titulo: "Cliente", ancho: 220, valor: clienteNombre },
      { titulo: "Estado", ancho: 165, valor: (r) => r.estadoPedido, formato: "enum" },
      { titulo: "Entrega", ancho: 95, valor: (r) => r.fechaEntregaEstimada, formato: "fecha" },
      { titulo: "Total", ancho: 126, valor: (r) => r.totalPedido, formato: "moneda" },
    ],
  },
  COTIZACIONES: {
    titulo: "Reporte de Cotizaciones",
    resumen: [
      { campo: "totalCotizaciones", etiqueta: "Total de cotizaciones" },
      { campo: "cantidadConvertidasPedido", etiqueta: "Convertidas en pedido" },
      { campo: "tasaConversion", etiqueta: "Tasa de conversión", porcentaje: true },
    ],
    columnas: [
      { titulo: "Cotización", ancho: 78, valor: (r) => r.idCotizacion },
      { titulo: "Creación", ancho: 90, valor: (r) => r.fechaCreacion, formato: "fecha" },
      { titulo: "Cliente", ancho: 215, valor: clienteNombre },
      { titulo: "Estado", ancho: 180, valor: (r) => r.estado, formato: "enum" },
      { titulo: "Propuesta", ancho: 135, valor: (r) => r.valorPropuestaVigente, formato: "moneda" },
      { titulo: "Pedido", ancho: 63, valor: (r) => r.idPedido },
    ],
  },
  ABONOS: {
    titulo: "Reporte de Abonos",
    resumen: [
      { campo: "cantidadAbonos", etiqueta: "Cantidad de abonos" },
      { campo: "cantidadConfirmados", etiqueta: "Confirmados" },
      { campo: "cantidadPendientes", etiqueta: "Pendientes" },
      { campo: "cantidadRechazados", etiqueta: "Rechazados" },
      { campo: "totalConfirmado", etiqueta: "Total confirmado", moneda: true },
      { campo: "totalPendiente", etiqueta: "Total pendiente", moneda: true },
    ],
    columnas: [
      { titulo: "Abono", ancho: 60, valor: (r) => r.idAbono },
      { titulo: "Pedido", ancho: 60, valor: (r) => r.idPedido },
      { titulo: "Cliente", ancho: 190, valor: clienteNombre },
      { titulo: "Fecha", ancho: 88, valor: (r) => r.fecha, formato: "fecha" },
      { titulo: "Monto", ancho: 120, valor: (r) => r.monto, formato: "moneda" },
      { titulo: "Estado", ancho: 105, valor: (r) => r.estado, formato: "enum" },
      { titulo: "Referencia", ancho: 138, valor: (r) => r.referencia },
    ],
  },
};

const textoSeguro = (valor: unknown) => {
  if (valor === undefined || valor === null || valor === "") return "No disponible";
  return String(valor);
};

const formatearFecha = (valor: unknown) => {
  if (!valor) return "No disponible";
  const fecha = valor instanceof Date ? valor : new Date(String(valor));
  return Number.isNaN(fecha.getTime()) ? "No disponible" : fechaColombia.format(fecha);
};

const formatearValor = (valor: unknown, formato?: Columna["formato"]) => {
  if (formato === "fecha") return formatearFecha(valor);
  if (formato === "enum") return humanizarEnumPdf(valor);
  if (formato === "moneda") {
    if (valor === null || valor === undefined) return "No disponible";
    return monedaCop.format(Number(valor));
  }
  return textoSeguro(valor);
};

const dibujarCabeceraTabla = (
  doc: PDFKit.PDFDocument,
  columnas: Columna[],
  y: number,
) => {
  let x = doc.page.margins.left;
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF");
  for (const columna of columnas) {
    doc.rect(x, y, columna.ancho, ALTO_CABECERA_TABLA).fill("#263238");
    doc.fillColor("#FFFFFF").text(columna.titulo, x + 5, y + 8, {
      width: columna.ancho - 8,
      height: 12,
      ellipsis: true,
      lineBreak: false,
    });
    x += columna.ancho;
  }
  return y + ALTO_CABECERA_TABLA;
};

const calcularAltoFila = (
  doc: PDFKit.PDFDocument,
  columnas: Columna[],
  registro: Record<string, unknown>,
) => {
  doc.font("Helvetica").fontSize(7);
  const altoTexto = Math.max(...columnas.map((columna) => doc.heightOfString(
    formatearValor(columna.valor(registro), columna.formato),
    { width: columna.ancho - 10, lineGap: 1 },
  )));
  return Math.max(24, Math.min(34, Math.ceil(altoTexto) + 10));
};

const dibujarFila = (
  doc: PDFKit.PDFDocument,
  columnas: Columna[],
  registro: Record<string, unknown>,
  y: number,
  alterna: boolean,
) => {
  let x = doc.page.margins.left;
  const alto = calcularAltoFila(doc, columnas, registro);
  doc.font("Helvetica").fontSize(7).fillColor("#263238");
  for (const columna of columnas) {
    doc.rect(x, y, columna.ancho, alto)
      .fillAndStroke(alterna ? "#F4F6F7" : "#FFFFFF", "#D5DBDB");
    doc.fillColor("#263238").text(
      formatearValor(columna.valor(registro), columna.formato),
      x + 5,
      y + 6,
      { width: columna.ancho - 10, height: alto - 10, lineGap: 1, ellipsis: true },
    );
    x += columna.ancho;
  }
  return y + alto;
};

const dibujarEncabezado = (
  doc: PDFKit.PDFDocument,
  reporte: ReporteData,
  configuracion: ConfiguracionPdf,
) => {
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#1B2631").text("PIXEL");
  doc.font("Helvetica").fontSize(9).fillColor("#566573").text("Sistema de Gestión PIXEL");
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#1B2631").text(configuracion.titulo);
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(8).fillColor("#34495E");
  doc.text(`Generado: ${formatearFecha(reporte.generadoEn)} | Usuario: ${reporte.generadoPor.nombre}`);
  const periodo = reporte.periodo.fechaInicio && reporte.periodo.fechaFin
    ? `${reporte.periodo.fechaInicio} a ${reporte.periodo.fechaFin}`
    : "Todos los registros disponibles";
  doc.text(`Período: ${periodo} | Zona horaria: ${reporte.zonaHoraria}`);
  const filtros = Object.entries(reporte.filtros)
    .map(([campo, valor]) => {
      const etiqueta = ETIQUETAS_FILTRO[campo] ?? campo;
      const valorVisible = typeof valor === "string" ? humanizarEnumPdf(valor) : valor;
      return `${etiqueta}: ${valorVisible}`;
    })
    .join(" | ");
  doc.text(`Filtros: ${filtros || "Ninguno"}`);
  doc.moveDown(0.7);
};

const dibujarResumen = (
  doc: PDFKit.PDFDocument,
  reporte: ReporteData,
  configuracion: ConfiguracionPdf,
) => {
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#1B2631").text("Resumen");
  doc.moveDown(0.35);
  const inicioX = doc.page.margins.left;
  const columnas = reporte.reporte === "COTIZACIONES" || reporte.reporte === "ABONOS" ? 3 : 4;
  const separacion = 8;
  const alto = 44;
  const anchoDisponible = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const ancho = (anchoDisponible - separacion * (columnas - 1)) / columnas;
  const inicioY = doc.y;
  configuracion.resumen.forEach((item, index) => {
    const columna = index % columnas;
    const fila = Math.floor(index / columnas);
    const x = inicioX + columna * (ancho + separacion);
    const y = inicioY + fila * (alto + separacion);
    const raw = reporte.resumen[item.campo];
    const valor = item.moneda
      ? monedaCop.format(Number(raw ?? 0))
      : item.porcentaje
        ? `${Number(raw ?? 0).toLocaleString("es-CO")}%`
        : textoSeguro(raw ?? 0);
    doc.roundedRect(x, y, ancho, alto, 3).fillAndStroke("#F7F9FA", "#CCD6DD");
    doc.font("Helvetica").fontSize(7.5).fillColor("#566573").text(item.etiqueta, x + 8, y + 8, {
      width: ancho - 16,
      height: 10,
      ellipsis: true,
      lineBreak: false,
    });
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1B2631").text(valor, x + 8, y + 23, {
      width: ancho - 16,
      height: 14,
      ellipsis: true,
      lineBreak: false,
    });
  });
  const filas = Math.ceil(configuracion.resumen.length / columnas);
  doc.x = inicioX;
  doc.y = inicioY + filas * alto + Math.max(0, filas - 1) * separacion + 12;
};

export const crearPdfReporte = (reporte: ReporteData): Promise<Buffer> => {
  const configuracion = CONFIGURACIONES[reporte.reporte];
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: MARGENES,
      bufferPages: true,
      info: { Title: configuracion.titulo, Author: "Sistema de Gestión PIXEL" },
    });
    const partes: Buffer[] = [];
    doc.on("data", (parte: Buffer) => partes.push(parte));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(partes)));

    dibujarEncabezado(doc, reporte, configuracion);
    dibujarResumen(doc, reporte, configuracion);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1B2631").text("Detalle", doc.page.margins.left, doc.y);
    doc.y += 15;

    if (reporte.registros.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor("#566573")
        .text("No se encontraron registros para los filtros seleccionados.");
      doc.moveDown(0.5);
    } else {
      let y = dibujarCabeceraTabla(doc, configuracion.columnas, doc.y);
      reporte.registros.forEach((registro, index) => {
        const altoFila = calcularAltoFila(doc, configuracion.columnas, registro);
        const espacioTotal = index === reporte.registros.length - 1 ? ALTO_TOTAL_REGISTROS : 0;
        const limiteContenido = doc.page.height - doc.page.margins.bottom;
        if (y + altoFila + espacioTotal > limiteContenido) {
          doc.addPage();
          y = dibujarCabeceraTabla(doc, configuracion.columnas, doc.page.margins.top);
        }
        y = dibujarFila(doc, configuracion.columnas, registro, y, index % 2 === 1);
      });
      doc.y = y + 8;
    }

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1B2631")
      .text(`Total de registros: ${reporte.totalRegistros}`, doc.page.margins.left, doc.y, {
        lineBreak: false,
      });

    const rangoPaginas = doc.bufferedPageRange();
    for (let indice = 0; indice < rangoPaginas.count; indice += 1) {
      doc.switchToPage(rangoPaginas.start + indice);
      const anchoFooter = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const yFooter = doc.page.height - 28;
      doc.moveTo(doc.page.margins.left, yFooter - 7)
        .lineTo(doc.page.width - doc.page.margins.right, yFooter - 7)
        .lineWidth(0.5)
        .strokeColor("#D5DBDB")
        .stroke();
      const margenInferior = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(7).fillColor("#7F8C8D").text(
        `Sistema de Gestión PIXEL | Página ${indice + 1} de ${rangoPaginas.count}`,
        doc.page.margins.left,
        yFooter,
        { width: anchoFooter, align: "center", lineBreak: false },
      );
      doc.page.margins.bottom = margenInferior;
    }
    doc.end();
  });
};

export const nombreArchivoReporte = (reporte: ReporteData) => {
  const tipo = reporte.reporte.toLowerCase();
  const periodo = reporte.periodo.fechaInicio && reporte.periodo.fechaFin
    ? `${reporte.periodo.fechaInicio}-${reporte.periodo.fechaFin}`
    : "todos";
  return `reporte-${tipo}-${periodo}.pdf`.replace(/[^a-z0-9.-]/g, "-");
};
