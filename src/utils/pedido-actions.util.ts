const aNumero = (valor: unknown) => {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
};

const redondearMoneda = (valor: number) => Math.round(valor * 100) / 100;

export const pedidoTienePagoCompleto = (pedido: any) =>
  redondearMoneda(aNumero(pedido?.saldoPendiente)) <= 0 &&
  redondearMoneda(aNumero(pedido?.totalPagado)) >=
    redondearMoneda(aNumero(pedido?.total)) &&
  pedido?.estadoPago === "COMPLETO";

export const obtenerAccionesFinancierasPedido = (
  pedido: any,
  totalDisenosPendientes: number,
) => {
  const estadoPedido = String(pedido?.estadoPedido ?? "");
  const pagoCompleto = pedidoTienePagoCompleto(pedido);
  const disenosCubiertos = totalDisenosPendientes === 0;
  const puedeSolicitarSaldoFinal =
    estadoPedido === "EN_PROCESO" &&
    !pagoCompleto &&
    redondearMoneda(aNumero(pedido?.saldoPendiente)) > 0 &&
    disenosCubiertos;
  const estadoPermiteFinalizar = [
    "EN_PROCESO",
    "PENDIENTE_SALDO_FINAL",
  ].includes(estadoPedido);
  const puedeFinalizar =
    estadoPermiteFinalizar && pagoCompleto && disenosCubiertos;

  let motivoBloqueoFinalizacion: string | null = null;

  if (estadoPedido === "FINALIZADO") {
    motivoBloqueoFinalizacion = "El pedido ya fue finalizado.";
  } else if (estadoPedido === "ENTREGADO") {
    motivoBloqueoFinalizacion = "El pedido ya fue entregado.";
  } else if (estadoPedido === "ANULADO") {
    motivoBloqueoFinalizacion = "El pedido esta anulado.";
  } else if (!estadoPermiteFinalizar) {
    motivoBloqueoFinalizacion =
      "El pedido debe estar EN_PROCESO o PENDIENTE_SALDO_FINAL.";
  } else if (!disenosCubiertos) {
    motivoBloqueoFinalizacion =
      "El pedido tiene disenos requeridos pendientes de aprobacion.";
  } else if (!pagoCompleto) {
    motivoBloqueoFinalizacion = "El pedido tiene saldo pendiente.";
  }

  const estadoPasoSaldoFinal = pagoCompleto
    ? estadoPedido === "EN_PROCESO"
      ? "NO_APLICA"
      : "COMPLETADO"
    : estadoPedido === "PENDIENTE_SALDO_FINAL"
      ? "SOLICITADO"
      : "PENDIENTE";

  return {
    puedeSolicitarSaldoFinal,
    puedeFinalizar,
    motivoBloqueoFinalizacion,
    estadoPasoSaldoFinal,
  };
};
