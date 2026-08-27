import { EmailService, type MailData } from "./email.service";
import {
  buildCotizacionCreadaClienteTemplate,
  buildCotizacionCreadaStaffTemplate,
  buildCotizacionPresencialCreadaClienteTemplate,
  buildCotizacionModificadaTemplate,
  buildPedidoCreadoTemplate,
  buildPedidoFinalizadoTemplate,
  buildPedidoEnProduccionTemplate,
  buildPedidoEntregadoTemplate,
  buildDisenoEnviadoParaRevisionTemplate,
  buildPedidoAnuladoTemplate,
  buildPedidoPendienteSaldoFinalTemplate,
  buildPrimerAbonoConfirmadoTemplate,
  buildSolicitudCotizacionRecibidaTemplate,
  buildPropuestaCotizacionEnviadaTemplate,
  buildRespuestaCotizacionTemplate,
  EMAIL_EVENTS,
  type EmailEvent,
} from "./email-templates";

const emailService = new EmailService();

type ResultadoEvento = {
  event: EmailEvent;
  cliente: "enviado" | "omitido" | "error";
  staff?: "enviado" | "omitido" | "error";
};

const tieneCorreo = (entidad: any) =>
  typeof entidad?.correo === "string" && entidad.correo.trim() !== "";

export class NotificationService {
  private async enviarCliente(
    event: EmailEvent,
    cliente: any,
    templateBuilder: () => MailData,
  ) {
    if (!tieneCorreo(cliente)) {
      console.warn(`Correo omitido para evento ${event}: cliente sin correo.`);
      return "omitido" as const;
    }

    try {
      const resultado = await emailService.sendMail(templateBuilder());
      return resultado.sent ? "enviado" as const : "omitido" as const;
    } catch (error) {
      console.error(`Error enviando correo del evento ${event}:`, error);
      return "error" as const;
    }
  }

  async cotizacionCreada(payload: any): Promise<ResultadoEvento> {
    const estado: ResultadoEvento = {
      event: EMAIL_EVENTS.COTIZACION_CREADA,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.COTIZACION_CREADA,
        payload.cliente,
        () => buildCotizacionCreadaClienteTemplate(payload),
      ),
      staff: "omitido",
    };

    if (process.env.STAFF_EMAIL) {
      try {
        const resultado = await emailService.sendMail(
          buildCotizacionCreadaStaffTemplate(process.env.STAFF_EMAIL, payload),
        );
        estado.staff = resultado.sent ? "enviado" : "omitido";
      } catch (error) {
        console.error("Error enviando correo interno de cotizacion:", error);
        estado.staff = "error";
      }
    }

    return estado;
  }

  async solicitudCotizacionRecibida(
    payload: any,
  ): Promise<ResultadoEvento> {
    const resultado: ResultadoEvento = {
      event: EMAIL_EVENTS.SOLICITUD_COTIZACION_RECIBIDA,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.SOLICITUD_COTIZACION_RECIBIDA,
        payload.cliente,
        () => buildSolicitudCotizacionRecibidaTemplate(payload),
      ),
      staff: "omitido",
    };

    if (process.env.STAFF_EMAIL) {
      try {
        const template = buildSolicitudCotizacionRecibidaTemplate(payload);
        const envio = await emailService.sendMail({
          ...template,
          to: process.env.STAFF_EMAIL,
          subject: `[Interno] Nueva solicitud de cotizacion - PIXEL`,
        });
        resultado.staff = envio.sent ? "enviado" : "omitido";
      } catch (error) {
        console.error("Error notificando solicitud al staff:", error);
        resultado.staff = "error";
      }
    }

    return resultado;
  }

  async propuestaCotizacionEnviada(
    payload: any,
  ): Promise<ResultadoEvento> {
    return {
      event: EMAIL_EVENTS.PROPUESTA_COTIZACION_ENVIADA,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.PROPUESTA_COTIZACION_ENVIADA,
        payload.cliente,
        () => buildPropuestaCotizacionEnviadaTemplate(payload),
      ),
    };
  }

  async respuestaCotizacionRegistrada(
    payload: any,
  ): Promise<ResultadoEvento> {
    const resultado: ResultadoEvento = {
      event: EMAIL_EVENTS.RESPUESTA_COTIZACION_REGISTRADA,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.RESPUESTA_COTIZACION_REGISTRADA,
        payload.cliente,
        () => buildRespuestaCotizacionTemplate(payload),
      ),
      staff: "omitido",
    };

    if (
      payload?.respuesta?.decision === "SOLICITAR_AJUSTE" &&
      process.env.STAFF_EMAIL
    ) {
      try {
        const template = buildRespuestaCotizacionTemplate(payload);
        const envio = await emailService.sendMail({
          ...template,
          to: process.env.STAFF_EMAIL,
          subject: "[Interno] Cliente solicito ajuste de cotizacion - PIXEL",
        });
        resultado.staff = envio.sent ? "enviado" : "omitido";
      } catch (error) {
        console.error("Error notificando ajuste al staff:", error);
        resultado.staff = "error";
      }
    }

    return resultado;
  }

  async cotizacionPresencialCreada(payload: any): Promise<ResultadoEvento> {
    return {
      event: EMAIL_EVENTS.COTIZACION_PRESENCIAL_CREADA,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.COTIZACION_PRESENCIAL_CREADA,
        payload.cliente,
        () => buildCotizacionPresencialCreadaClienteTemplate(payload),
      ),
    };
  }

  async cotizacionModificada(
    cotizacion: any,
    opciones: { motivoCambio?: string | null; totalAnterior?: unknown } = {},
  ): Promise<ResultadoEvento> {
    return {
      event: EMAIL_EVENTS.COTIZACION_MODIFICADA,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.COTIZACION_MODIFICADA,
        cotizacion?.cliente,
        () =>
          buildCotizacionModificadaTemplate({
            cotizacion,
            motivoCambio: opciones.motivoCambio,
            totalAnterior: opciones.totalAnterior,
          }),
      ),
    };
  }

  async pedidoCreadoDesdeCotizacion(pedido: any): Promise<ResultadoEvento> {
    return {
      event: EMAIL_EVENTS.PEDIDO_CREADO_DESDE_COTIZACION,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.PEDIDO_CREADO_DESDE_COTIZACION,
        pedido?.cliente,
        () => buildPedidoCreadoTemplate({ pedido }),
      ),
    };
  }

  async primerAbonoConfirmado(abono: any): Promise<ResultadoEvento> {
    return {
      event: EMAIL_EVENTS.PRIMER_ABONO_CONFIRMADO,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.PRIMER_ABONO_CONFIRMADO,
        abono?.pedido?.cliente,
        () => buildPrimerAbonoConfirmadoTemplate({
          pedido: abono.pedido,
          abono,
        }),
      ),
    };
  }

  async pedidoPendienteSaldoFinal(pedido: any): Promise<ResultadoEvento> {
    return {
      event: EMAIL_EVENTS.PEDIDO_PENDIENTE_SALDO_FINAL,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.PEDIDO_PENDIENTE_SALDO_FINAL,
        pedido?.cliente,
        () => buildPedidoPendienteSaldoFinalTemplate({ pedido }),
      ),
    };
  }

  async pedidoFinalizado(pedido: any): Promise<ResultadoEvento> {
    return {
      event: EMAIL_EVENTS.PEDIDO_FINALIZADO,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.PEDIDO_FINALIZADO,
        pedido?.cliente,
        () => buildPedidoFinalizadoTemplate({ pedido }),
      ),
    };
  }

  async pedidoEnProduccion(pedido: any): Promise<ResultadoEvento> {
    return {
      event: EMAIL_EVENTS.PEDIDO_EN_PRODUCCION,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.PEDIDO_EN_PRODUCCION,
        pedido?.cliente,
        () => buildPedidoEnProduccionTemplate({ pedido }),
      ),
    };
  }

  async pedidoEntregado(pedido: any): Promise<ResultadoEvento> {
    return {
      event: EMAIL_EVENTS.PEDIDO_ENTREGADO,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.PEDIDO_ENTREGADO,
        pedido?.cliente,
        () => buildPedidoEntregadoTemplate({ pedido }),
      ),
    };
  }

  async disenoEnviadoParaRevision(diseno: any): Promise<ResultadoEvento> {
    return {
      event: EMAIL_EVENTS.DISENO_ENVIADO_PARA_REVISION,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.DISENO_ENVIADO_PARA_REVISION,
        diseno?.pedido?.cliente,
        () => buildDisenoEnviadoParaRevisionTemplate({ diseno }),
      ),
    };
  }

  async pedidoAnulado(pedido: any, motivo?: string | null): Promise<ResultadoEvento> {
    return {
      event: EMAIL_EVENTS.PEDIDO_ANULADO,
      cliente: await this.enviarCliente(
        EMAIL_EVENTS.PEDIDO_ANULADO,
        pedido?.cliente,
        () => buildPedidoAnuladoTemplate({ pedido, motivo }),
      ),
    };
  }
}
