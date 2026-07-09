import { EmailService, type MailData } from "./email.service";
import {
  buildCotizacionCreadaClienteTemplate,
  buildCotizacionCreadaStaffTemplate,
  buildPedidoCreadoTemplate,
  buildPedidoFinalizadoTemplate,
  buildPrimerAbonoConfirmadoTemplate,
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
}
