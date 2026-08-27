import { runPrismaTransaction } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import {
  AbonoRepository,
  type AbonoFiltros,
  type ActualizarAbonoData,
  type CrearAbonoData,
} from "../../infrastructure/repositories/abono.repository";
import { NotificationService } from "./notification.service";
import { FileStorageService } from "./file-storage.service";
import {
  TesseractOcrService,
  type OcrService,
  type PaymentReceiptOcrResult,
} from "./ocr.service";
import {
  paginatedResponse,
  parsePaginationQuery,
} from "../../utils/pagination.util";
import {
  type EstadoAbonoPermitido,
  type MetodoPagoPermitido,
  validarActualizarAbono,
  validarConfirmarAbono,
  validarCrearAbono,
  validarFiltrosAbono,
  validarRechazarAbono,
  normalizarSugerenciasComprobante,
  type SugerenciasComprobante,
} from "../validators/abono.validator";
import { describirOrigenAnalisis } from "../../utils/receipt-analysis.util";

const abonoRepository = new AbonoRepository();
const notificationService = new NotificationService();

const ESTADO_ABONO_PENDIENTE = "PENDIENTE" as const;
const ESTADO_ABONO_CONFIRMADO = "CONFIRMADO" as const;
const ESTADO_ABONO_RECHAZADO = "RECHAZADO" as const;

const ESTADO_PEDIDO_PENDIENTE = "PENDIENTE" as const;
const ESTADO_PEDIDO_EN_PROCESO = "EN_PROCESO" as const;

const ESTADO_PAGO_PENDIENTE = "PENDIENTE" as const;
const ESTADO_PAGO_PARCIAL = "PARCIAL" as const;
const ESTADO_PAGO_COMPLETO = "COMPLETO" as const;

interface AuthUser {
  idUsuario: number;
  idCliente?: number | null;
  rol: string;
}

type DatosEntrada = Record<string, unknown>;

interface ResumenConfirmacionPago {
  idCliente: number;
  total: number;
  nuevoTotalPagado: number;
  saldoPendiente: number;
  estadoPago: "PENDIENTE" | "PARCIAL" | "COMPLETO";
  pagoInicialValido: boolean;
  primerAbonoConfirmado: boolean;
}

interface ResultadoAbonoConfirmadoTransaccion {
  idAbono: number;
  pagoInicialValido: boolean;
  primerAbonoConfirmado: boolean;
}

const esCliente = (usuarioAuth: AuthUser) => usuarioAuth.rol === "Cliente";
const idClienteAutenticado = (usuarioAuth: AuthUser) => {
  const idCliente = Number(usuarioAuth.idCliente);

  if (!Number.isInteger(idCliente) || idCliente <= 0) {
    throw new Error("El usuario cliente no tiene un cliente vinculado.");
  }

  return idCliente;
};
const puedeGestionarAbonos = (usuarioAuth: AuthUser) =>
  ["Admin", "Secretaria"].includes(usuarioAuth.rol);

const redondearMoneda = (valor: number) => Math.round(valor * 100) / 100;

const aNumero = (valor: unknown) => Number(valor ?? 0);

const limpiarTextoOpcional = (valor: unknown) => {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto === "" ? null : texto;
};

const validarId = (id: number, mensaje: string) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(mensaje);
  }
};

type ReceiptAnalysisMode =
  | "FRONTEND_ONLY"
  | "FRONTEND_WITH_BACKEND_FALLBACK"
  | "BACKEND_ONLY";
type ReceiptAnalysisSource =
  | "FRONTEND"
  | "MANUAL_REVIEW"
  | "BACKEND_FALLBACK";

const obtenerModoAnalisisComprobante = (): ReceiptAnalysisMode => {
  const modo = String(
    process.env.RECEIPT_ANALYSIS_MODE ??
      "FRONTEND_WITH_BACKEND_FALLBACK",
  ).toUpperCase();

  return [
    "FRONTEND_ONLY",
    "FRONTEND_WITH_BACKEND_FALLBACK",
    "BACKEND_ONLY",
  ].includes(modo)
    ? (modo as ReceiptAnalysisMode)
    : "FRONTEND_WITH_BACKEND_FALLBACK";
};

const resultadoManual = (): PaymentReceiptOcrResult => ({
  textoCompleto: "",
  montoDetectado: null,
  referenciaDetectada: null,
  fechaDetectada: null,
  bancoDetectado: null,
  confianza: null,
  candidatosMonto: [],
  requiereRevisionManual: true,
  advertencias: ["El comprobante requiere revision manual."],
});

const registrarDecisionAnalisis = (
  modo: ReceiptAnalysisMode,
  fuente: ReceiptAnalysisSource,
) => {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const backendFallback =
    fuente === "BACKEND_FALLBACK" ? "EXECUTED" : "SKIPPED";
  console.info(
    `[ReceiptAnalysis] mode=${modo} source=${fuente} backendFallback=${backendFallback}`,
  );
};

const resultadoDesdeFrontend = (
  sugerencias: SugerenciasComprobante,
): PaymentReceiptOcrResult => ({
  textoCompleto: "",
  montoDetectado: sugerencias.montoDetectado,
  referenciaDetectada: sugerencias.referenciaDetectada,
  fechaDetectada: sugerencias.fechaDetectada,
  bancoDetectado: sugerencias.bancoDetectado,
  confianza: sugerencias.calidadLectura,
  candidatosMonto: sugerencias.montoDetectado
    ? [sugerencias.montoDetectado]
    : [],
  requiereRevisionManual: sugerencias.requiereRevisionManual,
  advertencias: [],
});

const fechaDetectadaRespuesta = (fecha: Date | null) =>
  fecha ? fecha.toISOString().slice(0, 10) : null;

const prepararDatosDetectados = (
  analisis: PaymentReceiptOcrResult,
  origenAnalisis: "FRONTEND" | "BACKEND" | "MANUAL",
) => ({
  monto: analisis.montoDetectado,
  referencia: analisis.referenciaDetectada,
  fecha: fechaDetectadaRespuesta(analisis.fechaDetectada),
  banco: analisis.bancoDetectado,
  calidadLectura: analisis.confianza,
  requiereRevisionManual: analisis.requiereRevisionManual,
  origenAnalisis,
});

const origenAnalisisGuardado = (
  origenRegistro: unknown,
): "FRONTEND" | "BACKEND" | "MANUAL" => {
  const origen = String(origenRegistro ?? "").toUpperCase();

  if (origen.includes("FRONTEND")) {
    return "FRONTEND";
  }

  if (origen.includes("BACKEND") || origen.includes("OCR")) {
    return "BACKEND";
  }

  return "MANUAL";
};

const notificarPrimerAbonoConfirmado = async (abono: unknown) => {
  try {
    await notificationService.primerAbonoConfirmado(abono);
  } catch (error) {
    console.error("Error enviando correo de primer abono confirmado:", error);
  }
};

const cargarAbonoParaNotificacion = async (abono: any) => {
  if (!abono?.idPedido) {
    return abono;
  }

  const pedidoCompleto = await abonoRepository.buscarPedidoCompleto(
    Number(abono.idPedido),
  );

  return {
    ...abono,
    pedido: pedidoCompleto ?? abono.pedido,
  };
};

export class AbonoService {
  constructor(
    private readonly ejecutarTransaccion = runPrismaTransaction,
    private readonly fileStorage = new FileStorageService(),
    private readonly ocrService: OcrService = new TesseractOcrService(),
  ) {}

  private obtenerUsuario(usuarioAuth: AuthUser | undefined) {
    if (!usuarioAuth) {
      throw new Error("Usuario no autenticado.");
    }

    return usuarioAuth;
  }

  validarAccesoClienteAlPedido(
    pedido: { idCliente: number },
    user: AuthUser,
    mensaje = "No tienes permiso para registrar abonos en este pedido.",
  ) {
    if (esCliente(user) && Number(pedido.idCliente) !== idClienteAutenticado(user)) {
      throw new Error(mensaje);
    }
  }

  private validarAccesoConsultaAbono(
    abono: { pedido: { cliente: { idCliente: number } } },
    user: AuthUser,
  ) {
    if (
      esCliente(user) &&
      Number(abono.pedido.cliente.idCliente) !== idClienteAutenticado(user)
    ) {
      throw new Error("No tienes permiso para consultar este abono.");
    }
  }

  private prepararDatosBase(data: DatosEntrada): CrearAbonoData {
    return {
      idPedido: Number(data.idPedido),
      monto: redondearMoneda(Number(data.monto)),
      metodoPago: data.metodoPago as MetodoPagoPermitido,
      referencia: limpiarTextoOpcional(data.referencia),
      fechaPago: data.fechaPago ? new Date(String(data.fechaPago)) : null,
      comprobanteUrl: limpiarTextoOpcional(data.comprobanteUrl),
      origenRegistro: "ADMIN_MANUAL",
      observaciones: limpiarTextoOpcional(data.observaciones),
    };
  }

  calcularEstadoPago(total: number, totalPagado: number) {
    const totalRedondeado = redondearMoneda(total);
    const totalPagadoRedondeado = redondearMoneda(totalPagado);

    if (totalPagadoRedondeado <= 0) {
      return ESTADO_PAGO_PENDIENTE;
    }

    if (totalPagadoRedondeado >= totalRedondeado) {
      return ESTADO_PAGO_COMPLETO;
    }

    return ESTADO_PAGO_PARCIAL;
  }

  private calcularResumenPago(total: number, totalPagado: number) {
    const totalRedondeado = redondearMoneda(total);
    const totalPagadoRedondeado = redondearMoneda(totalPagado);
    const saldoPendiente = redondearMoneda(
      Math.max(totalRedondeado - totalPagadoRedondeado, 0),
    );
    const minimoPagoInicial = redondearMoneda(totalRedondeado * 0.5);

    return {
      totalPagado: totalPagadoRedondeado,
      saldoPendiente,
      estadoPago: this.calcularEstadoPago(
        totalRedondeado,
        totalPagadoRedondeado,
      ),
      pagoInicialValido:
        totalPagadoRedondeado >= minimoPagoInicial ||
        totalPagadoRedondeado >= totalRedondeado,
    };
  }

  private async actualizarPagoPedidoConTotal(
    idPedido: number,
    total: number,
    totalPagado: number,
    tx?: Prisma.TransactionClient,
  ) {
    const resumen = this.calcularResumenPago(total, totalPagado);

    return await abonoRepository.actualizarResumenPagoPedido(
      idPedido,
      {
        totalPagado: resumen.totalPagado,
        saldoPendiente: resumen.saldoPendiente,
        estadoPago: resumen.estadoPago,
      },
      tx,
    );
  }

  private async validarConfirmacionDeMonto(
    idPedido: number,
    monto: number,
    tx: Prisma.TransactionClient,
  ): Promise<ResumenConfirmacionPago> {
    const pedido = await abonoRepository.buscarPedidoPorId(idPedido, tx);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    const total = redondearMoneda(aNumero(pedido.total));
    const totalPagadoActual = redondearMoneda(
      await abonoRepository.sumarAbonosConfirmados(idPedido, tx),
    );
    const nuevoTotalPagado = redondearMoneda(totalPagadoActual + monto);
    const resumen = this.calcularResumenPago(total, nuevoTotalPagado);

    if (nuevoTotalPagado > total) {
      throw new Error("El abono supera el saldo pendiente del pedido.");
    }

    const minimoPrimerAbono = redondearMoneda(total * 0.5);

    if (totalPagadoActual === 0 && monto < minimoPrimerAbono) {
      throw new Error("El primer abono confirmado debe ser mínimo del 50% del total del pedido o el pago completo.");
    }

    return {
      idCliente: Number(pedido.idCliente),
      total,
      nuevoTotalPagado,
      saldoPendiente: resumen.saldoPendiente,
      estadoPago: resumen.estadoPago,
      pagoInicialValido: resumen.pagoInicialValido,
      primerAbonoConfirmado: totalPagadoActual === 0,
    };
  }

  private async sincronizarVentaConfirmada(
    idPedido: number,
    resumen: ResumenConfirmacionPago,
    tx: Prisma.TransactionClient,
  ) {
    await abonoRepository.upsertVentaDesdePago(
      {
        idPedido,
        idCliente: resumen.idCliente,
        totalPedido: resumen.total,
        totalPagado: resumen.nuevoTotalPagado,
        saldoPendiente: resumen.saldoPendiente,
        estado:
          resumen.estadoPago === ESTADO_PAGO_COMPLETO
            ? "COMPLETA"
            : "PARCIAL",
        fechaPrimerPago: new Date(),
      },
      tx,
    );
  }

  private prepararRespuestaAbono(abono: any) {
    const origen = describirOrigenAnalisis(abono?.origenRegistro);
    const datosDetectados = {
      monto:
        abono?.montoDetectadoOcr === null ||
        abono?.montoDetectadoOcr === undefined
          ? null
          : aNumero(abono.montoDetectadoOcr),
      referencia: abono?.referenciaDetectadaOcr ?? null,
      fecha: fechaDetectadaRespuesta(abono?.fechaDetectadaOcr ?? null),
      banco: abono?.bancoDetectadoOcr ?? null,
      calidadLectura:
        abono?.confianzaOcr === null || abono?.confianzaOcr === undefined
          ? null
          : aNumero(abono.confianzaOcr),
      requiereRevisionManual: abono?.requiereRevisionManual ?? false,
    };
    const datosDefinitivos = {
      monto:
        abono?.monto === null || abono?.monto === undefined
          ? null
          : aNumero(abono.monto),
      referencia: abono?.referencia ?? null,
      fecha: abono?.fechaPago ?? null,
    };

    if (!abono?.pedido) {
      const {
        comprobantePath: _comprobantePath,
        nombreSeguroComprobante: _nombreSeguroComprobante,
        textoOcr: _textoOcr,
        ...respuesta
      } = abono ?? {};

      return {
        ...respuesta,
        origenRegistroCodigo: origen.codigo,
        origenRegistroLabel: origen.etiqueta,
        datosDetectados,
        datosDefinitivos,
        comprobanteDisponible: Boolean(
          abono?.comprobantePath ??
            abono?.nombreOriginalComprobante ??
            abono?.comprobanteUrl,
        ),
      };
    }

    const {
      comprobantePath: _comprobantePath,
      nombreSeguroComprobante: _nombreSeguroComprobante,
      textoOcr: _textoOcr,
      ...respuesta
    } = abono;
    const totalPedido = redondearMoneda(aNumero(abono.pedido.total));
    const totalConfirmado = redondearMoneda(aNumero(abono.pedido.totalPagado));
    const saldoPendiente = redondearMoneda(aNumero(abono.pedido.saldoPendiente));

    return {
      ...respuesta,
      pedido: {
        ...respuesta.pedido,
        totalPagadoConfirmado: totalConfirmado,
      },
      origenRegistroCodigo: origen.codigo,
      origenRegistroLabel: origen.etiqueta,
      datosDetectados,
      datosDefinitivos,
      comprobanteDisponible: Boolean(
        abono.comprobantePath ??
          abono.nombreOriginalComprobante ??
          abono.comprobanteUrl,
      ),
      totalPedido,
      totalConfirmado,
      saldoPendiente,
      montoMinimoPrimerAbono: redondearMoneda(totalPedido * 0.5),
      estadoPago: abono.pedido.estadoPago,
    };
  }

  async recalcularPagoPedido(idPedido: number, tx?: Prisma.TransactionClient) {
    const pedido = await abonoRepository.buscarPedidoPorId(idPedido, tx);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    const total = redondearMoneda(aNumero(pedido.total));
    const totalPagado = redondearMoneda(
      await abonoRepository.sumarAbonosConfirmados(idPedido, tx),
    );
    return await this.actualizarPagoPedidoConTotal(idPedido, total, totalPagado, tx);
  }

  async pedidoTienePagoInicialValido(
    idPedido: number,
    tx?: Prisma.TransactionClient,
  ) {
    const pedido = await abonoRepository.buscarPedidoPorId(idPedido, tx);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    const total = redondearMoneda(aNumero(pedido.total));
    const totalPagado = redondearMoneda(
      await abonoRepository.sumarAbonosConfirmados(idPedido, tx),
    );
    return this.calcularResumenPago(total, totalPagado).pagoInicialValido;
  }

  async pedidoTieneDisenoAprobado(
    idPedido: number,
    tx?: Prisma.TransactionClient,
  ) {
    return await abonoRepository.existeDisenoAprobado(idPedido, tx);
  }

  async intentarPasarPedidoAEnProceso(
    idPedido: number,
    tx?: Prisma.TransactionClient,
    pagoInicialYaValidado?: boolean,
  ) {
    const pedido = await abonoRepository.buscarPedidoPorId(idPedido, tx);

    if (!pedido || pedido.estadoPedido !== ESTADO_PEDIDO_PENDIENTE) {
      return false;
    }

    const tienePagoInicial =
      pagoInicialYaValidado ??
      (await this.pedidoTienePagoInicialValido(idPedido, tx));

    if (!tienePagoInicial) {
      return false;
    }

    const tieneDisenoAprobado = await this.pedidoTieneDisenoAprobado(
      idPedido,
      tx,
    );

    if (!tieneDisenoAprobado) {
      return false;
    }

    await abonoRepository.actualizarEstadoPedido(
      idPedido,
      ESTADO_PEDIDO_EN_PROCESO,
      tx,
    );

    return true;
  }

  async crearAbonoConfirmadoConResumenEnTransaccion(
    data: CrearAbonoData,
    user: AuthUser,
    tx: Prisma.TransactionClient,
  ): Promise<ResultadoAbonoConfirmadoTransaccion> {
    if (!Number.isFinite(data.monto) || Number(data.monto) <= 0) {
      throw new Error("El abono requiere un monto valido antes de confirmarse.");
    }

    const resumenConfirmacion = await this.validarConfirmacionDeMonto(
      data.idPedido,
      Number(data.monto),
      tx,
    );

    const abonoCreado = await abonoRepository.crearAbonoOperacion(
      {
        ...data,
        estado: ESTADO_ABONO_CONFIRMADO,
        confirmadoPorId: Number(user.idUsuario),
        fechaConfirmacion: new Date(),
      },
      tx,
    );

    await this.actualizarPagoPedidoConTotal(
      data.idPedido,
      resumenConfirmacion.total,
      resumenConfirmacion.nuevoTotalPagado,
      tx,
    );
    await this.sincronizarVentaConfirmada(
      data.idPedido,
      resumenConfirmacion,
      tx,
    );
    await this.intentarPasarPedidoAEnProceso(
      data.idPedido,
      tx,
      resumenConfirmacion.pagoInicialValido,
    );

    return {
      idAbono: abonoCreado.idAbono,
      pagoInicialValido: resumenConfirmacion.pagoInicialValido,
      primerAbonoConfirmado: resumenConfirmacion.primerAbonoConfirmado,
    };
  }

  async crearAbonoConfirmadoEnTransaccion(
    data: CrearAbonoData,
    user: AuthUser,
    tx: Prisma.TransactionClient,
  ) {
    const resultado = await this.crearAbonoConfirmadoConResumenEnTransaccion(
      data,
      user,
      tx,
    );

    return await abonoRepository.buscarPorIdOperacion(resultado.idAbono, tx);
  }

  async crearAbono(
    data: DatosEntrada,
    usuarioAuth: AuthUser | undefined,
    file?: Express.Multer.File,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    const error = validarCrearAbono(data, user.rol);

    if (error) {
      throw new Error(error);
    }

    const datosBase = this.prepararDatosBase(data);
    const pedido = await abonoRepository.buscarPedidoPorId(datosBase.idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    if (esCliente(user)) {
      this.validarAccesoClienteAlPedido(pedido, user);

      return this.prepararRespuestaAbono(await abonoRepository.crearAbono({
        ...datosBase,
        estado: ESTADO_ABONO_PENDIENTE,
      }));
    }

    if (!puedeGestionarAbonos(user)) {
      throw new Error("No tienes permiso para registrar abonos en este pedido.");
    }

    let storedPath: string | null = null;

    if (file) {
      const stored = await this.fileStorage.savePaymentReceipt(file, {
        idCliente: Number(pedido.idCliente),
        idPedido: datosBase.idPedido,
      });
      storedPath = stored.relativePath;
      const duplicado = await abonoRepository.buscarPorHash(
        datosBase.idPedido,
        stored.sha256,
      );

      if (duplicado) {
        await this.fileStorage.deleteFile(stored.relativePath);
        throw new Error("Este comprobante ya fue registrado.");
      }

      let ocr: PaymentReceiptOcrResult | null = null;

      try {
        ocr = await this.ocrService.analyzePaymentReceipt(
          this.fileStorage.resolveSafePath(stored.relativePath),
        );
      } catch (error) {
        console.error(
          "OCR administrativo no disponible:",
          error instanceof Error ? error.message : "error desconocido",
        );
      }

      Object.assign(datosBase, {
        comprobantePath: stored.relativePath,
        nombreOriginalComprobante: stored.originalName,
        nombreSeguroComprobante: stored.safeName,
        comprobanteMimeType: stored.mimeType,
        comprobanteSizeBytes: stored.sizeBytes,
        comprobanteHash: stored.sha256,
        comprobanteSubidoEn: new Date(),
        textoOcr: ocr?.textoCompleto || null,
        montoDetectadoOcr: ocr?.montoDetectado ?? null,
        referenciaDetectadaOcr: ocr?.referenciaDetectada ?? null,
        fechaDetectadaOcr: ocr?.fechaDetectada ?? null,
        bancoDetectadoOcr: ocr?.bancoDetectado ?? null,
        confianzaOcr: ocr?.confianza ?? null,
        requiereRevisionManual: ocr?.requiereRevisionManual ?? true,
        origenRegistro: "ADMIN_OCR",
      });
    }

    try {
      if (data.confirmar === true || data.confirmar === "true") {
        const resultado = await this.ejecutarTransaccion(async (tx) => {
          return await this.crearAbonoConfirmadoConResumenEnTransaccion(
            datosBase,
            user,
            tx,
          );
        });

        const abonoCompleto = await abonoRepository.buscarPorId(
          resultado.idAbono,
        );

        if (resultado.primerAbonoConfirmado) {
          await notificarPrimerAbonoConfirmado(
            await cargarAbonoParaNotificacion(abonoCompleto),
          );
        }

        return this.prepararRespuestaAbono(abonoCompleto);
      }

      return this.prepararRespuestaAbono(
        await abonoRepository.crearAbono({
          ...datosBase,
          estado: ESTADO_ABONO_PENDIENTE,
        }),
      );
    } catch (error) {
      if (storedPath) {
        await this.fileStorage.deleteFile(storedPath);
      }
      throw error;
    }
  }

  async crearDesdeComprobanteCliente(
    idPedido: number,
    file: Express.Multer.File | undefined,
    datosEntrada: unknown,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idPedido, "El ID del pedido no es valido.");

    if (!esCliente(user)) {
      throw new Error("Este endpoint solo esta disponible para clientes.");
    }

    if (!file) {
      throw new Error("El comprobante es obligatorio.");
    }

    if (process.env.LOCAL_STORAGE_ENABLED === "false") {
      throw new Error("El almacenamiento local de comprobantes esta deshabilitado.");
    }

    const pedido = await abonoRepository.buscarPedidoPorId(idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    this.validarAccesoClienteAlPedido(
      pedido,
      user,
      "No tienes permiso para registrar abonos en este pedido.",
    );

    if (["ANULADO", "ENTREGADO"].includes(pedido.estadoPedido)) {
      throw new Error("Este pedido ya no admite comprobantes de pago.");
    }

    if (redondearMoneda(aNumero(pedido.saldoPendiente)) <= 0) {
      throw new Error("El pedido no tiene saldo pendiente.");
    }

    const data =
      datosEntrada &&
      typeof datosEntrada === "object" &&
      !Array.isArray(datosEntrada)
        ? (datosEntrada as DatosEntrada)
        : { observaciones: datosEntrada };
    const sugerencias = normalizarSugerenciasComprobante(data);
    const modoAnalisis = obtenerModoAnalisisComprobante();

    const stored = await this.fileStorage.savePaymentReceipt(file, {
      idCliente: idClienteAutenticado(user),
      idPedido,
    });
    const duplicado = await abonoRepository.buscarPorHash(idPedido, stored.sha256);

    if (duplicado) {
      await this.fileStorage.deleteFile(stored.relativePath);
      const analisisDuplicado: PaymentReceiptOcrResult = {
        textoCompleto: "",
        montoDetectado: aNumero(duplicado.montoDetectadoOcr) || null,
        referenciaDetectada: duplicado.referenciaDetectadaOcr,
        fechaDetectada: duplicado.fechaDetectadaOcr,
        bancoDetectado: duplicado.bancoDetectadoOcr,
        confianza: aNumero(duplicado.confianzaOcr) || null,
        candidatosMonto: [],
        requiereRevisionManual: duplicado.requiereRevisionManual,
        advertencias: ["El comprobante ya habia sido registrado."],
      };
      const origenAnalisis = origenAnalisisGuardado(
        duplicado.origenRegistro,
      );

      return {
        abono: this.prepararRespuestaAbono(duplicado),
        datosDetectados: prepararDatosDetectados(
          analisisDuplicado,
          origenAnalisis,
        ),
        ocr: {
          montoDetectado: analisisDuplicado.montoDetectado,
          referenciaDetectada: analisisDuplicado.referenciaDetectada,
          fechaDetectada: analisisDuplicado.fechaDetectada,
          bancoDetectado: analisisDuplicado.bancoDetectado,
          confianza: analisisDuplicado.confianza,
          requiereRevisionManual: analisisDuplicado.requiereRevisionManual,
          advertencias: analisisDuplicado.advertencias,
        },
        duplicado: true,
      };
    }

    let ocr: PaymentReceiptOcrResult;
    let origenAnalisis: "FRONTEND" | "BACKEND" | "MANUAL";

    if (
      modoAnalisis !== "BACKEND_ONLY" &&
      sugerencias.tieneAnalisisFrontend
    ) {
      ocr = resultadoDesdeFrontend(sugerencias);
      if (stored.mimeType === "application/pdf") {
        ocr = {
          ...ocr,
          requiereRevisionManual: true,
          advertencias: ["Los comprobantes PDF requieren revision manual."],
        };
      }
      origenAnalisis = "FRONTEND";
    } else if (modoAnalisis === "FRONTEND_ONLY") {
      ocr = resultadoManual();
      origenAnalisis = "MANUAL";
    } else {
      try {
        ocr = await this.ocrService.analyzePaymentReceipt(
          this.fileStorage.resolveSafePath(stored.relativePath),
        );
        origenAnalisis = ocr.requiereRevisionManual &&
          ocr.montoDetectado === null
          ? "MANUAL"
          : "BACKEND";
      } catch (error) {
        console.error(
          "OCR de comprobante no disponible; se requiere revision manual:",
          error instanceof Error ? error.message : "error desconocido",
        );
        ocr = resultadoManual();
        origenAnalisis = "MANUAL";
      }
    }
    registrarDecisionAnalisis(
      modoAnalisis,
      origenAnalisis === "BACKEND"
        ? "BACKEND_FALLBACK"
        : ocr.requiereRevisionManual
          ? "MANUAL_REVIEW"
          : "FRONTEND",
    );

    try {
      const abono = await abonoRepository.crearAbono({
        idPedido,
        monto: null,
        metodoPago: "TRANSFERENCIA",
        referencia: null,
        fechaPago: null,
        comprobanteUrl: null,
        comprobantePath: stored.relativePath,
        nombreOriginalComprobante: stored.originalName,
        nombreSeguroComprobante: stored.safeName,
        comprobanteMimeType: stored.mimeType,
        comprobanteSizeBytes: stored.sizeBytes,
        comprobanteHash: stored.sha256,
        comprobanteSubidoEn: new Date(),
        textoOcr: origenAnalisis === "BACKEND" ? ocr.textoCompleto || null : null,
        montoDetectadoOcr: ocr.montoDetectado,
        referenciaDetectadaOcr: ocr.referenciaDetectada,
        fechaDetectadaOcr: ocr.fechaDetectada,
        bancoDetectadoOcr: ocr.bancoDetectado,
        confianzaOcr: ocr.confianza,
        requiereRevisionManual: ocr.requiereRevisionManual,
        origenRegistro: origenAnalisis,
        observaciones: limpiarTextoOpcional(data.observaciones),
        estado: ESTADO_ABONO_PENDIENTE,
      });

      return {
        abono: this.prepararRespuestaAbono(abono),
        datosDetectados: prepararDatosDetectados(ocr, origenAnalisis),
        ocr: {
          montoDetectado: ocr.montoDetectado,
          referenciaDetectada: ocr.referenciaDetectada,
          fechaDetectada: ocr.fechaDetectada,
          bancoDetectado: ocr.bancoDetectado,
          confianza: ocr.confianza,
          candidatosMonto: ocr.candidatosMonto,
          requiereRevisionManual: ocr.requiereRevisionManual,
          advertencias: ocr.advertencias,
        },
        duplicado: false,
      };
    } catch (error) {
      await this.fileStorage.deleteFile(stored.relativePath);
      throw error;
    }
  }

  async obtenerComprobante(
    idAbono: number,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idAbono, "El ID del abono no es valido.");
    const comprobante =
      await abonoRepository.buscarComprobanteMetadata(idAbono);

    if (!comprobante) {
      throw new Error("Abono no encontrado.");
    }

    if (
      esCliente(user) &&
      Number(comprobante.pedido.idCliente) !== idClienteAutenticado(user)
    ) {
      throw new Error("No tienes permiso para consultar este comprobante.");
    }

    if (!comprobante.comprobantePath) {
      throw new Error("El abono no tiene comprobante almacenado.");
    }

    await this.fileStorage.getFileMetadata(comprobante.comprobantePath);

    return {
      stream: this.fileStorage.getFileStream(comprobante.comprobantePath),
      mimeType: comprobante.comprobanteMimeType ?? "application/octet-stream",
      fileName:
        comprobante.nombreOriginalComprobante ??
        `comprobante-${comprobante.idAbono}`,
    };
  }

  async confirmarAbono(
    idAbono: number,
    usuarioAuth: AuthUser | undefined,
    data: DatosEntrada = {},
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idAbono, "El ID del abono no es valido.");

    const error = validarConfirmarAbono(data);

    if (error) {
      throw new Error(error);
    }

    const resultado = await this.ejecutarTransaccion(async (tx) => {
      const abono = await abonoRepository.buscarPorIdOperacion(idAbono, tx);

      if (!abono) {
        throw new Error("Abono no encontrado.");
      }

      if (abono.estado === ESTADO_ABONO_CONFIRMADO) {
        throw new Error("El abono ya fue confirmado.");
      }

      if (abono.estado === ESTADO_ABONO_RECHAZADO) {
        throw new Error("El abono ya fue rechazado.");
      }

      if (abono.estado !== ESTADO_ABONO_PENDIENTE) {
        throw new Error("Solo se pueden confirmar abonos pendientes.");
      }

      const resumenConfirmacion = await this.validarConfirmacionDeMonto(
        abono.idPedido,
        redondearMoneda(aNumero(abono.monto)),
        tx,
      );

      const dataActualizar: ActualizarAbonoData = {
        estado: ESTADO_ABONO_CONFIRMADO,
        confirmadoPorId: Number(user.idUsuario),
        fechaConfirmacion: new Date(),
      };

      if (data.referencia !== undefined) {
        dataActualizar.referencia = limpiarTextoOpcional(data.referencia);
      }

      const abonoConfirmado = await abonoRepository.actualizarAbonoOperacion(
        idAbono,
        dataActualizar,
        tx,
      );

      await this.actualizarPagoPedidoConTotal(
        abonoConfirmado.idPedido,
        resumenConfirmacion.total,
        resumenConfirmacion.nuevoTotalPagado,
        tx,
      );
      await this.sincronizarVentaConfirmada(
        abonoConfirmado.idPedido,
        resumenConfirmacion,
        tx,
      );
      await this.intentarPasarPedidoAEnProceso(
        abonoConfirmado.idPedido,
        tx,
        resumenConfirmacion.pagoInicialValido,
      );

      return {
        idAbono,
        primerAbonoConfirmado: resumenConfirmacion.primerAbonoConfirmado,
      };
    });

    const abono = await abonoRepository.buscarPorId(resultado.idAbono);

    if (resultado.primerAbonoConfirmado) {
      await notificarPrimerAbonoConfirmado(
        await cargarAbonoParaNotificacion(abono),
      );
    }

    return this.prepararRespuestaAbono(abono);
  }

  async rechazarAbono(
    idAbono: number,
    usuarioAuth: AuthUser | undefined,
    data: DatosEntrada,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idAbono, "El ID del abono no es valido.");

    const error = validarRechazarAbono(data);

    if (error) {
      throw new Error(error);
    }

    return await this.ejecutarTransaccion(async (tx) => {
      const abono = await abonoRepository.buscarPorId(idAbono, tx);

      if (!abono) {
        throw new Error("Abono no encontrado.");
      }

      if (abono.estado === ESTADO_ABONO_CONFIRMADO) {
        throw new Error("El abono ya fue confirmado.");
      }

      if (abono.estado === ESTADO_ABONO_RECHAZADO) {
        throw new Error("El abono ya fue rechazado.");
      }

      if (abono.estado !== ESTADO_ABONO_PENDIENTE) {
        throw new Error("Solo se pueden rechazar abonos pendientes.");
      }

      return await abonoRepository.actualizarAbono(
        idAbono,
        {
          estado: ESTADO_ABONO_RECHAZADO,
          rechazadoPorId: Number(user.idUsuario),
          fechaRechazo: new Date(),
          motivoRechazo: limpiarTextoOpcional(data.motivoRechazo),
        },
        tx,
      );
    });
  }

  async listarAbonos(filtrosEntrada: DatosEntrada) {
    const error = validarFiltrosAbono(filtrosEntrada);

    if (error) {
      throw new Error(error);
    }

    const filtros: AbonoFiltros = {};

    if (filtrosEntrada.idCliente !== undefined) {
      filtros.idCliente = Number(filtrosEntrada.idCliente);
    }

    if (filtrosEntrada.idPedido !== undefined) {
      filtros.idPedido = Number(filtrosEntrada.idPedido);
    }

    if (filtrosEntrada.estado !== undefined) {
      filtros.estado = filtrosEntrada.estado as EstadoAbonoPermitido;
    }

    if (filtrosEntrada.metodoPago !== undefined) {
      filtros.metodoPago = filtrosEntrada.metodoPago as MetodoPagoPermitido;
    }

    if (typeof filtrosEntrada.desde === "string") {
      filtros.desde = filtrosEntrada.desde;
    }

    if (typeof filtrosEntrada.hasta === "string") {
      filtros.hasta = filtrosEntrada.hasta;
    }

    const pagination = parsePaginationQuery(filtrosEntrada, {
      defaultSortBy: "fechaCreacion",
      allowedSortBy: ["idAbono", "fechaCreacion", "monto", "estado"],
      maxLimit: 10,
    });

    if (pagination.isPaginated) {
      const resultado = await abonoRepository.listarAbonosPaginado(
        filtros,
        pagination,
      );

      return paginatedResponse(
        resultado.data.map((abono) => this.prepararRespuestaAbono(abono)),
        pagination,
        resultado.total,
      );
    }

    const abonos = await abonoRepository.listarAbonos(filtros);

    if (abonos.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return abonos.map((abono) => this.prepararRespuestaAbono(abono));
  }

  async listarPorPedido(idPedido: number, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idPedido, "El ID del pedido no es valido.");

    const pedido = await abonoRepository.buscarPedidoPorId(idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    this.validarAccesoClienteAlPedido(
      pedido,
      user,
      "No tienes permiso para consultar este abono.",
    );

    const abonos = await abonoRepository.listarPorPedido(idPedido);
    return abonos.map((abono) => this.prepararRespuestaAbono(abono));
  }

  async buscarPorId(idAbono: number, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idAbono, "El ID del abono no es valido.");

    const abono = await abonoRepository.buscarPorId(idAbono);

    if (!abono) {
      throw new Error("Abono no encontrado.");
    }

    this.validarAccesoConsultaAbono(abono, user);

    return this.prepararRespuestaAbono(abono);
  }

  async actualizarAbonoPendiente(
    idAbono: number,
    data: DatosEntrada,
    usuarioAuth?: AuthUser,
  ) {
    validarId(idAbono, "El ID del abono no es valido.");

    const error = validarActualizarAbono(data);

    if (error) {
      throw new Error(error);
    }

    const abono = await abonoRepository.buscarPorId(idAbono);

    if (!abono) {
      throw new Error("Abono no encontrado.");
    }

    if (abono.estado === ESTADO_ABONO_RECHAZADO) {
      throw new Error("No se puede editar un abono rechazado.");
    }

    const dataActualizar: ActualizarAbonoData = {};

    if (data.monto !== undefined) {
      dataActualizar.monto = redondearMoneda(Number(data.monto));
    }

    if (data.metodoPago !== undefined) {
      dataActualizar.metodoPago = data.metodoPago as MetodoPagoPermitido;
    }

    if (data.referencia !== undefined) {
      dataActualizar.referencia = limpiarTextoOpcional(data.referencia);
    }

    if (data.fechaPago !== undefined) {
      dataActualizar.fechaPago = data.fechaPago
        ? new Date(String(data.fechaPago))
        : null;
    }

    if (data.observaciones !== undefined) {
      dataActualizar.observaciones = limpiarTextoOpcional(data.observaciones);
    }

    if (data.requiereRevisionManual !== undefined) {
      dataActualizar.requiereRevisionManual =
        data.requiereRevisionManual === true;
    }

    if (data.comprobanteUrl !== undefined) {
      dataActualizar.comprobanteUrl = limpiarTextoOpcional(data.comprobanteUrl);
    }

    dataActualizar.corregidoPorId = usuarioAuth?.idUsuario
      ? Number(usuarioAuth.idUsuario)
      : null;
    dataActualizar.fechaCorreccion = new Date();

    if (
      abono.estado !== ESTADO_ABONO_CONFIRMADO ||
      data.monto === undefined
    ) {
      return await abonoRepository.actualizarAbono(idAbono, dataActualizar);
    }

    const actualizado = await this.ejecutarTransaccion(async (tx) => {
      await abonoRepository.actualizarAbonoOperacion(
        idAbono,
        dataActualizar,
        tx,
      );
      const pedido = await abonoRepository.buscarPedidoPorId(
        abono.idPedido,
        tx,
      );

      if (!pedido) {
        throw new Error("Pedido no encontrado.");
      }

      const totalPagado = redondearMoneda(
        await abonoRepository.sumarAbonosConfirmados(abono.idPedido, tx),
      );
      const total = redondearMoneda(aNumero(pedido.total));

      if (totalPagado > total) {
        throw new Error("El total confirmado no puede superar el pedido.");
      }

      const resumen = this.calcularResumenPago(total, totalPagado);
      await this.actualizarPagoPedidoConTotal(
        abono.idPedido,
        total,
        totalPagado,
        tx,
      );
      await abonoRepository.upsertVentaDesdePago(
        {
          idPedido: abono.idPedido,
          idCliente: Number(pedido.idCliente),
          totalPedido: total,
          totalPagado,
          saldoPendiente: resumen.saldoPendiente,
          estado:
            resumen.estadoPago === ESTADO_PAGO_COMPLETO
              ? "COMPLETA"
              : "PARCIAL",
          fechaPrimerPago: abono.fechaConfirmacion ?? new Date(),
        },
        tx,
      );

      return { idAbono };
    });

    return await abonoRepository.buscarPorId(actualizado.idAbono);
  }

  async eliminarAbonoPendiente(idAbono: number) {
    validarId(idAbono, "El ID del abono no es valido.");

    const abono = await abonoRepository.buscarPorId(idAbono);

    if (!abono) {
      throw new Error("Abono no encontrado.");
    }

    if (abono.estado !== ESTADO_ABONO_PENDIENTE) {
      throw new Error("Solo se pueden eliminar abonos pendientes.");
    }

    await abonoRepository.eliminarAbono(idAbono);

    return abono;
  }

}
