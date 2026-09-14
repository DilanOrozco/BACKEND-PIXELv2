import test from "node:test";
import assert from "node:assert/strict";
import { CotizacionWorkflowService } from "./cotizacion-workflow.service";
import { ClienteAccessService } from "./cliente-access.service";
import { EmailService } from "./email.service";

const cliente = {
  idCliente: 10,
  nombre: "Cliente Workflow",
  correo: null,
  telefono: "3001234567",
  documento: null,
  direccion: null,
};

const detalle = {
  idDetalleCotizacion: 20,
  idProducto: 1,
  tipoProducto: "CATALOGO",
  nombrePersonalizado: null,
  materialReferencia: null,
  suministradoPor: "PIXEL",
  descripcion: "Camiseta",
  cantidad: 2,
  idRangoDescuentoAplicado: 15,
  cantidadMinimaDescuentoSnapshot: 2,
  descuentoPorcentaje: 8,
  subtotalBruto: 20000,
  descuentoTotal: 1600,
  subtotalConDescuento: 18400,
  rangoDescuentoAplicado: {
    idRango: 15,
    cantidadMin: 2,
    descuentoPorcentaje: 8,
    estado: true,
  },
  costoDiseno: 0,
  subtotalSugeridoInterno: 18000,
  requiereDiseno: false,
  origenDiseno: "NO_REQUIERE",
  archivoDisenoInicialUrl: null,
  esDisenoGeneral: false,
  medioRecepcionDiseno: null,
  observaciones: null,
  producto: { idProducto: 1, nombre: "Camiseta" },
  estampados: [
    {
      idDetalleEstampadoCotizacion: 30,
      idTecnica: 2,
      tecnica: { idTecnica: 2, nombre: "DTF" },
      ubicacion: "FRENTE",
      anchoCm: 10,
      altoCm: 10,
      descripcion: null,
      observaciones: null,
      origenDiseno: "NO_REQUIERE",
      grupoDisenoCompartido: null,
    },
  ],
};

const cotizacionBase = {
  idCotizacion: 5,
  idCliente: cliente.idCliente,
  creadoPorId: 1,
  tipoCotizacion: "PUBLICA",
  estado: "EN_REVISION",
  subtotal: 0,
  descuentoTotal: 0,
  costosAdicionales: 0,
  total: 0,
  precioSugeridoInterno: 18000,
  requiereRevisionPrecio: false,
  advertenciasInternas: [],
  observacionesInternas: null,
  observaciones: null,
  fechaCreacion: new Date(),
  fechaActualizacion: new Date(),
  cliente,
  creadoPor: null,
  detalles: [detalle],
  versiones: [],
};

test("enviar propuesta crea version inmutable y calcula desglose oficial", async (t) => {
  let lecturas = 0;
  const cotizacionPropuesta = {
    ...cotizacionBase,
    detalles: [
      {
        ...detalle,
        estampados: [
          { ...detalle.estampados[0], subtotalSugerido: 6000 },
          {
            ...detalle.estampados[0],
            idDetalleEstampadoCotizacion: 31,
            ubicacion: "ESPALDA",
            subtotalSugerido: 12000,
          },
        ],
      },
    ],
  };
  const version = {
    idVersion: 7,
    numeroVersion: 1,
    precioFinal: 25000,
    descuentoManual: 1000,
    costosAdicionales: 2000,
    desgloseVisible: {
      items: [{ ...detalle, nombre: "Camiseta", precioUnitario: 12000, subtotal: 24000 }],
      subtotalItems: 24000,
      descuentoManual: 1000,
      costosAdicionales: 2000,
      total: 25000,
    },
    validaHasta: new Date(Date.now() + 86400000),
    estado: "ENVIADA",
    esVigente: true,
  };
  const createVersion = t.mock.fn(async (_data: any) => ({ idVersion: 7 }));
  const tx: any = {
    cotizacionVersion: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
      create: createVersion,
    },
    cotizacion: { update: async () => ({ idCotizacion: 5 }) },
  };
  const database: any = {
    cotizacion: {
      findUnique: async () => {
        lecturas += 1;
        return lecturas === 1
          ? cotizacionPropuesta
          : {
              ...cotizacionBase,
              estado: "PENDIENTE_APROBACION_CLIENTE",
              total: 25000,
              versiones: [version],
            };
      },
    },
  };
  t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: false, skipped: true }),
  );

  const resultado = await new CotizacionWorkflowService(
    database,
    async (handler: any) => handler(tx),
  ).enviarPropuesta(
    5,
    {
      precioFinal: 25000,
      descuentoManual: 1000,
      costosAdicionales: 2000,
      motivoAjusteManual: "Incluye suministro y ajuste comercial.",
    },
    { idUsuario: 1, rol: "Admin" },
  );
  const dataVersion = (createVersion.mock.calls[0]!.arguments[0] as any).data;

  assert.equal(dataVersion.numeroVersion, 1);
  assert.equal(dataVersion.estado, "ENVIADA");
  assert.equal(dataVersion.esVigente, true);
  assert.equal(dataVersion.desgloseVisible.total, 25000);
  assert.equal(dataVersion.desgloseVisible.items[0].subtotal, 18400);
  assert.equal(Number(dataVersion.subtotalDesglose), 19400);
  assert.equal(Number(dataVersion.ajusteManual), 5600);
  assert.equal(
    dataVersion.motivoAjusteManual,
    "Incluye suministro y ajuste comercial.",
  );
  assert.equal(
    dataVersion.snapshotCompleto.cotizacion.detalles[0]
      .cantidadMinimaDescuentoSnapshot,
    2,
  );
  assert.equal(
    dataVersion.snapshotCompleto.cotizacion.detalles[0]
      .descuentoPorcentaje,
    8,
  );
  assert.equal(
    dataVersion.snapshotCompleto.cotizacion.detalles[0].descuentoTotal,
    1600,
  );
  cotizacionPropuesta.detalles[0]!.descuentoPorcentaje = 25;
  assert.equal(
    dataVersion.snapshotCompleto.cotizacion.detalles[0]
      .descuentoPorcentaje,
    8,
  );
  assert.equal(
    dataVersion.desgloseVisible.items[0].estampados.reduce(
      (total: number, estampado: any) => total + estampado.subtotal,
      0,
    ),
    18000,
  );
  assert.equal(resultado.version?.idVersion, 7);
});

const ejecutarEnvioPropuesta = async (
  body: any,
  cotizacion: any = cotizacionBase,
  ultimaVersion: any = null,
) => {
  let lecturas = 0;
  let dataCreada: any = null;
  let llamadasCreate = 0;
  const tx: any = {
    cotizacionVersion: {
      findFirst: async () => ultimaVersion,
      updateMany: async () => ({ count: ultimaVersion ? 1 : 0 }),
      create: async ({ data }: any) => {
        llamadasCreate += 1;
        dataCreada = data;
        return { idVersion: 70 };
      },
    },
    cotizacion: { update: async () => ({ idCotizacion: 5 }) },
  };
  const database: any = {
    cotizacion: {
      findUnique: async () => {
        lecturas += 1;
        if (lecturas === 1) return cotizacion;
        const versionRespuesta = dataCreada
          ? { idVersion: 70, ...dataCreada }
          : ultimaVersion;
        return {
          ...cotizacion,
          estado: "PENDIENTE_APROBACION_CLIENTE",
          versiones: versionRespuesta ? [versionRespuesta] : [],
        };
      },
    },
  };
  const resultado = await new CotizacionWorkflowService(
    database,
    async (handler: any) => handler(tx),
  ).enviarPropuesta(5, body, { idUsuario: 1, nombre: "Admin" });

  return { resultado, dataCreada, llamadasCreate };
};

test("precio final manual puede ser igual, mayor o menor que el desglose", async () => {
  const item = {
    idDetalleCotizacion: 20,
    subtotalServiciosOficial: 18400,
    costoProducto: 0,
    otrosCostosItem: 0,
  };
  const igual = await ejecutarEnvioPropuesta({
    precioFinal: 18400,
    items: [item],
  });
  assert.equal(Number(igual.dataCreada.ajusteManual), 0);

  const mayor = await ejecutarEnvioPropuesta({
    precioFinal: 20000,
    motivoAjusteManual: "Ajuste por entrega urgente.",
    items: [item],
  });
  assert.equal(Number(mayor.dataCreada.ajusteManual), 1600);
  assert.equal(Number(mayor.dataCreada.precioFinal), 20000);

  const menor = await ejecutarEnvioPropuesta({
    precioFinal: 18000,
    motivoAjusteManual: "Descuento comercial negociado.",
    items: [item],
  });
  assert.equal(Number(menor.dataCreada.ajusteManual), -400);
  assert.equal(Number(menor.dataCreada.precioFinal), 18000);
});

test("diferencia manual exige motivo interno con codigo estable", async () => {
  await assert.rejects(
    () =>
      ejecutarEnvioPropuesta({
        precioFinal: 20000,
        items: [
          {
            idDetalleCotizacion: 20,
            subtotalServiciosOficial: 18400,
          },
        ],
      }),
    (error: any) => {
      assert.equal(error.code, "MANUAL_PRICE_REASON_REQUIRED");
      assert.match(error.message, /explica brevemente/i);
      return true;
    },
  );
});

test("items oficiales separan servicio, producto fisico y otros costos", async () => {
  const envio = await ejecutarEnvioPropuesta({
    precioFinal: 21400,
    items: [
      {
        idDetalleCotizacion: 20,
        subtotalServiciosOficial: 18400,
        costoProducto: 2000,
        otrosCostosItem: 1000,
      },
    ],
  });
  const item =
    envio.dataCreada.snapshotCompleto.administrativo.items[0];
  assert.equal(item.subtotalServiciosNeto, 18400);
  assert.equal(item.costoProducto, 2000);
  assert.equal(item.otrosCostosItem, 1000);
  assert.equal(item.subtotalOficialItem, 21400);

  await assert.rejects(
    () =>
      ejecutarEnvioPropuesta(
        {
          precioFinal: 19400,
          items: [
            {
              idDetalleCotizacion: 20,
              costoProducto: 1000,
            },
          ],
        },
        {
          ...cotizacionBase,
          detalles: [{ ...detalle, suministradoPor: "CLIENTE" }],
        },
      ),
    /debe ser 0.*suministra el cliente/i,
  );
});

test("diseno compartido se cobra una vez y conceptos internos no se exponen", async () => {
  const cotizacionConGrupo = {
    ...cotizacionBase,
    detalles: [
      {
        ...detalle,
        requiereDiseno: true,
        origenDiseno: "PIXEL",
        estampados: [
          {
            ...detalle.estampados[0],
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: "LOGO-1",
          },
          {
            ...detalle.estampados[0],
            idDetalleEstampadoCotizacion: 31,
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: "LOGO-1",
          },
        ],
      },
    ],
  };
  const envio = await ejecutarEnvioPropuesta(
    {
      precioFinal: 238400,
      descuentoManual: 50000,
      items: [
        {
          idDetalleCotizacion: 20,
          subtotalServiciosOficial: 18400,
        },
      ],
      disenos: [
        {
          grupoDisenoCompartido: "LOGO-1",
          descripcionVisible: "Creacion del logo principal",
          costoDiseno: 120000,
        },
      ],
      conceptosAdicionales: [
        { concepto: "Transporte", valor: 100000, visibleCliente: true },
        { concepto: "Reserva operativa", valor: 50000, visibleCliente: false },
      ],
    },
    cotizacionConGrupo,
  );
  const creada = envio.dataCreada;
  assert.equal(creada.disenosOficiales.length, 1);
  assert.equal(creada.disenosOficiales[0].cubre.length, 2);
  assert.equal(Number(creada.costosAdicionales), 150000);
  assert.equal(Number(creada.subtotalDesglose), 238400);
  assert.equal(Number(creada.ajusteManual), 0);
  assert.equal(creada.desgloseVisible.conceptosAdicionales.length, 1);
  assert.equal(creada.desgloseVisible.ajusteComercial, 50000);
  assert.equal(
    JSON.stringify(creada.desgloseVisible).includes("Reserva operativa"),
    false,
  );

  await assert.rejects(
    () =>
      ejecutarEnvioPropuesta(
        {
          precioFinal: 138400,
          items: [{ idDetalleCotizacion: 20 }],
          disenos: [
            {
              idDetalleEstampadoCotizacion: 30,
              costoDiseno: 60000,
            },
            { grupoDisenoCompartido: "LOGO-1", costoDiseno: 60000 },
          ],
        },
        cotizacionConGrupo,
      ),
    /dos veces.*grupo compartido/i,
  );
});

test("diseno individual admite costo oficial positivo o cero", async () => {
  const conCosto = await ejecutarEnvioPropuesta({
    precioFinal: 98400,
    items: [
      {
        idDetalleCotizacion: 20,
        subtotalServiciosOficial: 18400,
      },
    ],
    disenos: [
      {
        idDetalleEstampadoCotizacion: 30,
        descripcionVisible: "Creacion de diseno frontal",
        costoDiseno: 80000,
      },
    ],
  });
  assert.equal(
    conCosto.dataCreada.disenosOficiales[0].costoDiseno,
    80000,
  );

  const sinCobro = await ejecutarEnvioPropuesta({
    precioFinal: 18400,
    items: [
      {
        idDetalleCotizacion: 20,
        subtotalServiciosOficial: 18400,
      },
    ],
    disenos: [
      {
        idDetalleEstampadoCotizacion: 30,
        descripcionVisible: "Diseno incluido sin costo",
        costoDiseno: 0,
      },
    ],
  });
  assert.equal(
    sinCobro.dataCreada.disenosOficiales[0].costoDiseno,
    0,
  );
});

test("contrato legacy conserva subtotal y costos adicionales sin duplicarlos", async () => {
  const envio = await ejecutarEnvioPropuesta({
    precioFinal: 20000,
    descuentoManual: 0,
    costosAdicionales: 2000,
    items: [{ idDetalleCotizacion: 20, subtotal: 18000 }],
  });
  assert.equal(envio.dataCreada.conceptosAdicionales.length, 1);
  assert.equal(
    envio.dataCreada.conceptosAdicionales[0].concepto,
    "Costos adicionales",
  );
  assert.equal(Number(envio.dataCreada.ajusteManual), 0);
  assert.equal(
    envio.dataCreada.desgloseVisible.items[0].subtotal,
    18000,
  );
});

test("subtotal oficial editable no se redistribuye entre estampados", async () => {
  const envio = await ejecutarEnvioPropuesta({
    precioFinal: 20000,
    items: [
      {
        idDetalleCotizacion: 20,
        subtotalServiciosOficial: 18400,
        subtotalOficial: 20000,
      },
    ],
  });
  const administrativo =
    envio.dataCreada.snapshotCompleto.administrativo.items[0];
  assert.equal(administrativo.ajusteItem, 1600);
  assert.equal(administrativo.subtotalOficialItem, 20000);
  assert.equal(
    envio.dataCreada.desgloseVisible.items[0].estampados[0].subtotal,
    0,
  );
});

test("propuesta valida IDs reales de items y estampados", async () => {
  await assert.rejects(
    () =>
      ejecutarEnvioPropuesta({
        precioFinal: 18400,
        items: [{ idDetalleCotizacion: 999, subtotal: 18400 }],
      }),
    /no pertenece a esta cotizacion/i,
  );
  await assert.rejects(
    () =>
      ejecutarEnvioPropuesta({
        precioFinal: 18400,
        disenos: [
          {
            idDetalleEstampadoCotizacion: 999,
            costoDiseno: 0,
          },
        ],
      }),
    /estampado 999 no pertenece/i,
  );
});

test("reintento identico no crea otra version ni duplica correo", async () => {
  const body = {
    precioFinal: 18400,
    items: [
      {
        idDetalleCotizacion: 20,
        subtotalServiciosOficial: 18400,
      },
    ],
  };
  const primera = await ejecutarEnvioPropuesta(body);
  const ultimaVersion = {
    idVersion: 70,
    numeroVersion: 1,
    estado: "ENVIADA",
    esVigente: true,
    snapshotCompleto: primera.dataCreada.snapshotCompleto,
    ...primera.dataCreada,
  };
  const reintento = await ejecutarEnvioPropuesta(
    body,
    cotizacionBase,
    ultimaVersion,
  );

  assert.equal(reintento.llamadasCreate, 0);
  assert.equal(reintento.resultado.idempotent, true);
  assert.equal(reintento.resultado.version.idVersion, 70);
  assert.equal(reintento.resultado.email.cliente, "omitido");
});

test("cliente acepta version vigente y el servicio crea un solo pedido", async (t) => {
  t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async () => cliente as any,
  );
  const versionPrevia = {
    idVersion: 7,
    idCotizacion: 5,
    precioFinal: 25000,
    validaHasta: new Date(Date.now() + 86400000),
    estado: "ENVIADA",
    esVigente: true,
    snapshotCompleto: {
      propuesta: {
        items: [
          {
            ...detalle,
            nombre: "Camiseta",
            precioUnitario: 12500,
            subtotal: 25000,
          },
        ],
      },
    },
    cotizacion: { idCliente: cliente.idCliente },
  };
  const crearPedido = t.mock.fn(async (_data: any) => ({ idPedido: 80 }));
  const crearRespuesta = t.mock.fn(async (_data: any) => ({ idRespuesta: 90 }));
  const tx: any = {
    cotizacionVersion: {
      findUnique: async () => versionPrevia,
      update: async () => ({ idVersion: 7 }),
    },
    cotizacionRespuesta: {
      findUnique: async () => null,
      create: crearRespuesta,
    },
    pedido: {
      findUnique: async () => null,
      create: crearPedido,
    },
    detallePedido: {
      create: async () => ({
        idDetallePedido: 81,
        estampados: [{ idDetalleEstampadoPedido: 82 }],
      }),
    },
    diseno: { create: async () => ({ idDiseno: 1 }) },
    cotizacion: { update: async () => ({ idCotizacion: 5 }) },
  };
  const database: any = {
    cotizacionVersion: {
      findFirst: async () => versionPrevia,
    },
    cotizacion: {
      findUnique: async () =>
        ({
        ...cotizacionBase,
        estado: "CONVERTIDA_EN_PEDIDO",
        versiones: [{ ...versionPrevia, numeroVersion: 1 }],
      }),
    },
    pedido: {
      findUnique: async () =>
        ({
        idPedido: 80,
        idCliente: cliente.idCliente,
        cliente,
        detalles: [],
      }),
    },
    cotizacionRespuesta: {
      findUnique: async () =>
        ({
        idRespuesta: 90,
        decision: "ACEPTAR",
        medio: "SISTEMA",
        precioAceptado: 25000,
      }),
    },
  };

  const resultado = await new CotizacionWorkflowService(
    database,
    async (handler: any) => handler(tx),
  ).responderComoCliente(
    5,
    { idVersion: 7, decision: "ACEPTAR" },
    { idUsuario: 77, rol: "Cliente" },
  );

  assert.equal(crearRespuesta.mock.calls.length, 1);
  assert.equal(crearPedido.mock.calls.length, 1);
  assert.equal(
    (crearPedido.mock.calls[0]!.arguments[0] as any).data.idCliente,
    cliente.idCliente,
  );
  assert.equal(resultado.pedido?.idPedido, 80);
});

test("version vencida no puede aceptarse ni crear pedido", async (t) => {
  t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async () => cliente as any,
  );
  const database: any = {
    cotizacionVersion: {
      findFirst: async () =>
        ({
        idVersion: 7,
        idCotizacion: 5,
        precioFinal: 25000,
        validaHasta: new Date(Date.now() - 1000),
        estado: "ENVIADA",
        esVigente: true,
        snapshotCompleto: {},
        cotizacion: { idCliente: cliente.idCliente },
      }),
      update: async () => ({ idVersion: 7 }),
    },
    cotizacion: {
      update: async () => ({ idCotizacion: 5 }),
    },
    $transaction: async (operaciones: any[]) => Promise.all(operaciones),
  };

  await assert.rejects(
    () =>
      new CotizacionWorkflowService(database).responderComoCliente(
        5,
        { idVersion: 7, decision: "ACEPTAR" },
        { idUsuario: 77, rol: "Cliente" },
      ),
    /propuesta esta vencida/i,
  );
});

test("una version anterior invalidada no puede aceptarse", async (t) => {
  t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async () => cliente as any,
  );
  let transacciones = 0;
  const database: any = {
    cotizacionVersion: {
      findFirst: async () => ({
        idVersion: 6,
        idCotizacion: 5,
        precioFinal: 22000,
        validaHasta: new Date(Date.now() + 86400000),
        estado: "INVALIDADA",
        esVigente: false,
        snapshotCompleto: {},
        respuesta: null,
        pedido: null,
        cotizacion: { idCliente: cliente.idCliente },
      }),
    },
  };

  await assert.rejects(
    () =>
      new CotizacionWorkflowService(
        database,
        async () => {
          transacciones += 1;
          throw new Error("No debe iniciar transaccion.");
        },
      ).responderComoCliente(
        5,
        { idVersion: 6, decision: "ACEPTAR" },
        { idUsuario: 77, rol: "Cliente" },
      ),
    /ya no esta disponible/i,
  );
  assert.equal(transacciones, 0);
});

test("reintento de la misma aceptacion devuelve el pedido sin duplicarlo", async (t) => {
  t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async () => cliente as any,
  );
  const database: any = {
    cotizacionVersion: {
      findFirst: async () => ({
        idVersion: 7,
        idCotizacion: 5,
        precioFinal: 25000,
        validaHasta: new Date(Date.now() + 86400000),
        estado: "ACEPTADA",
        esVigente: true,
        snapshotCompleto: {},
        respuesta: { idRespuesta: 90, decision: "ACEPTAR" },
        pedido: { idPedido: 80 },
        cotizacion: { idCliente: cliente.idCliente },
      }),
    },
    cotizacion: {
      findUnique: async () => ({
        ...cotizacionBase,
        estado: "CONVERTIDA_EN_PEDIDO",
        versiones: [{ idVersion: 7, estado: "ACEPTADA", esVigente: true }],
      }),
    },
    pedido: {
      findUnique: async () => ({ idPedido: 80, cliente }),
    },
    cotizacionRespuesta: {
      findUnique: async () => ({
        idRespuesta: 90,
        decision: "ACEPTAR",
        medio: "SISTEMA",
      }),
    },
  };
  let transacciones = 0;

  const resultado = await new CotizacionWorkflowService(
    database,
    async () => {
      transacciones += 1;
      throw new Error("No debe abrir otra transaccion.");
    },
  ).responderComoCliente(
    5,
    { idVersion: 7, decision: "ACEPTAR" },
    { idUsuario: 77, rol: "Cliente" },
  );

  assert.equal("idempotent" in resultado && resultado.idempotent, true);
  assert.equal(resultado.pedido.idPedido, 80);
  assert.equal(transacciones, 0);
});

test("usuario interno registra rechazo presencial con trazabilidad y sin pedido", async (t) => {
  const crearRespuesta = t.mock.fn(async (_data: any) => ({
    idRespuesta: 91,
  }));
  const tx: any = {
    cotizacionVersion: {
      findUnique: async () => ({
        idVersion: 7,
        estado: "ENVIADA",
        esVigente: true,
        validaHasta: new Date(Date.now() + 86400000),
        precioFinal: 25000,
        snapshotCompleto: {},
      }),
      update: async () => ({ idVersion: 7 }),
    },
    cotizacionRespuesta: {
      findUnique: async () => null,
      create: crearRespuesta,
    },
    pedido: {
      findUnique: async () => null,
      create: t.mock.fn(),
    },
    cotizacion: { update: async () => ({ idCotizacion: 5 }) },
  };
  let lecturasCotizacion = 0;
  const database: any = {
    cotizacionVersion: {
      findFirst: async () => ({
        idVersion: 7,
        idCotizacion: 5,
        precioFinal: 25000,
        validaHasta: new Date(Date.now() + 86400000),
        estado: "ENVIADA",
        esVigente: true,
        snapshotCompleto: {},
        respuesta: null,
        pedido: null,
        cotizacion: { idCliente: cliente.idCliente },
      }),
    },
    cotizacion: {
      findUnique: async () => {
        lecturasCotizacion += 1;
        return lecturasCotizacion === 1
          ? { idCliente: cliente.idCliente }
          : {
              ...cotizacionBase,
              estado: "RECHAZADA_CLIENTE",
              versiones: [
                {
                  idVersion: 7,
                  estado: "RECHAZADA",
                  esVigente: false,
                },
              ],
            };
      },
    },
    cotizacionRespuesta: {
      findUnique: async () => ({
        idRespuesta: 91,
        decision: "RECHAZAR",
        actor: "USUARIO_INTERNO",
        medio: "PRESENCIAL",
      }),
    },
  };

  const resultado = await new CotizacionWorkflowService(
    database,
    async (handler: any) => handler(tx),
  ).responderComoInterno(
    5,
    {
      idVersion: 7,
      decision: "RECHAZAR",
      medio: "PRESENCIAL",
      observaciones: "El cliente no acepta la propuesta.",
    },
    { idUsuario: 3, rol: "Admin" },
  );
  const datos = (crearRespuesta.mock.calls[0]!.arguments[0] as any).data;

  assert.equal(datos.actor, "USUARIO_INTERNO");
  assert.equal(datos.idUsuarioInterno, 3);
  assert.equal(datos.idCliente, cliente.idCliente);
  assert.equal(datos.medio, "PRESENCIAL");
  assert.equal(datos.precioAceptado, null);
  assert.equal(tx.pedido.create.mock.calls.length, 0);
  assert.equal(resultado.pedido, null);
});

test("usuario interno acepta por WhatsApp y crea el pedido con el cliente comercial", async (t) => {
  const crearPedido = t.mock.fn(async (_data: any) => ({ idPedido: 80 }));
  const crearRespuesta = t.mock.fn(async (_data: any) => ({
    idRespuesta: 90,
  }));
  const tx: any = {
    cotizacionVersion: {
      findUnique: async () => ({
        idVersion: 7,
        estado: "ENVIADA",
        esVigente: true,
        validaHasta: new Date(Date.now() + 86400000),
        precioFinal: 25000,
        snapshotCompleto: {
          propuesta: {
            items: [
              {
                ...detalle,
                nombre: "Camiseta",
                precioUnitario: 12500,
                subtotal: 25000,
              },
            ],
          },
        },
      }),
      update: async () => ({ idVersion: 7 }),
    },
    cotizacionRespuesta: {
      findUnique: async () => null,
      create: crearRespuesta,
    },
    pedido: {
      findUnique: async () => null,
      create: crearPedido,
    },
    detallePedido: {
      create: async () => ({
        idDetallePedido: 81,
        estampados: [{ idDetalleEstampadoPedido: 82 }],
      }),
    },
    diseno: { create: async () => ({ idDiseno: 1 }) },
    cotizacion: { update: async () => ({ idCotizacion: 5 }) },
  };
  let lecturasCotizacion = 0;
  const database: any = {
    cotizacionVersion: {
      findFirst: async () => ({
        idVersion: 7,
        idCotizacion: 5,
        precioFinal: 25000,
        validaHasta: new Date(Date.now() + 86400000),
        estado: "ENVIADA",
        esVigente: true,
        snapshotCompleto: {},
        respuesta: null,
        pedido: null,
        cotizacion: { idCliente: cliente.idCliente },
      }),
    },
    cotizacion: {
      findUnique: async () => {
        lecturasCotizacion += 1;
        return lecturasCotizacion === 1
          ? { idCliente: cliente.idCliente }
          : {
              ...cotizacionBase,
              estado: "CONVERTIDA_EN_PEDIDO",
              versiones: [
                { idVersion: 7, estado: "ACEPTADA", esVigente: true },
              ],
            };
      },
    },
    pedido: {
      findUnique: async () => ({
        idPedido: 80,
        idCliente: cliente.idCliente,
        cliente,
        detalles: [],
      }),
    },
    cotizacionRespuesta: {
      findUnique: async () => ({
        idRespuesta: 90,
        decision: "ACEPTAR",
        actor: "USUARIO_INTERNO",
        medio: "WHATSAPP",
      }),
    },
  };

  const resultado = await new CotizacionWorkflowService(
    database,
    async (handler: any) => handler(tx),
  ).responderComoInterno(
    5,
    {
      idVersion: 7,
      decision: "ACEPTAR",
      medio: "WHATSAPP",
      observaciones: "Aprobada por mensaje del cliente.",
    },
    { idUsuario: 3, rol: "Admin" },
  );
  const respuestaData =
    (crearRespuesta.mock.calls[0]!.arguments[0] as any).data;
  const pedidoData = (crearPedido.mock.calls[0]!.arguments[0] as any).data;

  assert.equal(respuestaData.actor, "USUARIO_INTERNO");
  assert.equal(respuestaData.medio, "WHATSAPP");
  assert.equal(respuestaData.idUsuarioInterno, 3);
  assert.equal(pedidoData.idCliente, cliente.idCliente);
  assert.equal(crearPedido.mock.calls.length, 1);
  assert.equal(resultado.pedido.idPedido, 80);
});

test("usuario interno solicita ajuste por llamada y exige motivo", async (t) => {
  const database: any = {
    cotizacion: {
      findUnique: async () => ({ idCliente: cliente.idCliente }),
    },
  };

  await assert.rejects(
    () =>
      new CotizacionWorkflowService(database).responderComoInterno(
        5,
        {
          idVersion: 7,
          decision: "SOLICITAR_AJUSTE",
          medio: "LLAMADA",
        },
        { idUsuario: 3, rol: "Admin" },
      ),
    /motivo del ajuste/i,
  );
});

test("conflicto concurrente de aceptacion devuelve el pedido ya creado", async (t) => {
  t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async () => cliente as any,
  );
  let lecturasRespuesta = 0;
  const database: any = {
    cotizacionVersion: {
      findFirst: async () => ({
        idVersion: 7,
        idCotizacion: 5,
        precioFinal: 25000,
        validaHasta: new Date(Date.now() + 86400000),
        estado: "ENVIADA",
        esVigente: true,
        snapshotCompleto: {},
        respuesta: null,
        pedido: null,
        cotizacion: { idCliente: cliente.idCliente },
      }),
    },
    cotizacion: {
      findUnique: async () => ({
        ...cotizacionBase,
        estado: "CONVERTIDA_EN_PEDIDO",
        versiones: [{ idVersion: 7, estado: "ACEPTADA", esVigente: true }],
      }),
    },
    pedido: {
      findUnique: async () => ({ idPedido: 80, cliente }),
    },
    cotizacionRespuesta: {
      findUnique: async () => {
        lecturasRespuesta += 1;
        return lecturasRespuesta === 1
          ? { decision: "ACEPTAR" }
          : {
              idRespuesta: 90,
              decision: "ACEPTAR",
              medio: "SISTEMA",
            };
      },
    },
  };
  const conflicto = Object.assign(new Error("Unique constraint"), {
    code: "P2002",
  });

  const resultado = await new CotizacionWorkflowService(
    database,
    async () => {
      throw conflicto;
    },
  ).responderComoCliente(
    5,
    { idVersion: 7, decision: "ACEPTAR" },
    { idUsuario: 77, rol: "Cliente" },
  );

  assert.equal("idempotent" in resultado && resultado.idempotent, true);
  assert.equal(resultado.pedido.idPedido, 80);
});
