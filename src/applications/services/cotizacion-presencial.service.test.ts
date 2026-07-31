import test from "node:test";
import assert from "node:assert/strict";
import { CotizacionService } from "./cotizacion.service";
import { EmailService } from "./email.service";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { ProductoRepository } from "../../infrastructure/repositories/producto.repository";
import { TarifaTecnicaRepository } from "../../infrastructure/repositories/tarifa-tecnica.repository";

const cliente = {
  idCliente: 8,
  idUsuario: null,
  nombre: "Cliente Presencial",
  correo: "presencial@pixel.test",
  telefono: "3001234567",
  documento: null,
  direccion: null,
  estado: true,
};

const detalle = {
  idProducto: 1,
  descripcion: "Camiseta",
  cantidad: 12,
  estampados: [
    {
      idTecnica: 2,
      ubicacion: "FRENTE",
      anchoCm: 10,
      altoCm: 10,
      origenDiseno: "PIXEL",
    },
  ],
};

const configurarCalculo = (t: any) => {
  t.mock.method(
    ProductoRepository.prototype,
    "buscarActivosPorIds",
    async (ids: number[]) =>
      ids.map((idProducto) => ({
        idProducto,
        nombre: idProducto === 1 ? "Camiseta" : "Gorra",
        descripcion: null,
        precioBase: null,
        requiereDiseno: true,
        categoriaProducto: null,
        rangos: [
          {
            idRango: idProducto,
            cantidadMin: 1,
            descuentoPorcentaje: 0,
            estado: true,
          },
          {
            idRango: idProducto + 10,
            cantidadMin: 12,
            descuentoPorcentaje: 10,
            estado: true,
          },
        ],
      })),
  );
  t.mock.method(
    TarifaTecnicaRepository.prototype,
    "cargarConfiguracionActiva",
    async () => [
      {
        idTecnica: 2,
        nombre: "DTF",
        tarifas: [
          {
            idTarifa: 1,
            idTecnica: 2,
            anchoHastaCm: 20,
            altoHastaCm: 20,
            precioUnitario: 10000,
            estado: true,
          },
        ],
        descuentos: [
          {
            idDescuento: 1,
            idTecnica: 2,
            cantidadMinima: 12,
            porcentaje: 10,
            estado: true,
          },
        ],
      },
    ],
  );
};

const configurarPersistencia = (t: any) =>
  t.mock.method(
    CotizacionRepository.prototype,
    "crearCotizacionConDetalles",
    async (data: any) => ({
      idCotizacion: 50,
      ...data,
      cliente,
      versiones: [],
    }),
  );

test("cotizacion presencial usa Cliente comercial sin exigir Usuario", async (t) => {
  configurarCalculo(t);
  const persistencia = configurarPersistencia(t);
  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorId",
    async () => cliente,
  );
  t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  const respuesta = await new CotizacionService().crearCotizacionNormal(
    {
      idCliente: cliente.idCliente,
      detalles: [detalle],
      observaciones: "Atencion en tienda",
    },
    { idUsuario: 1, rol: "Admin" },
  );
  const data = persistencia.mock.calls[0]?.arguments[0];

  assert.equal(data.idCliente, cliente.idCliente);
  assert.equal(data.estado, "EN_REVISION");
  assert.equal(data.subtotal, 0);
  assert.equal(data.total, 0);
  assert.equal(Number(data.precioSugeridoInterno), 108000);
  assert.equal(data.detalles[0].estampados[0].idTarifaAplicada, 1);
  assert.equal(respuesta.estado, "EN_REVISION");
  assert.equal(respuesta.detalles[0].porcentajeDescuentoProducto, 10);
  assert.equal(respuesta.detalles[0].montoDescuentoProducto, 12000);
  assert.equal(respuesta.detalles[0].subtotalServiciosBruto, 120000);
  assert.equal(
    respuesta.detalles[0].subtotalServiciosConDescuento,
    108000,
  );
  assert.equal(respuesta.subtotalServiciosBrutoSugerido, 120000);
  assert.equal(respuesta.montoDescuentoProductoSugerido, 12000);
  assert.equal("accesoCliente" in respuesta, false);
});

test("cotizacion presencial admite varios productos y conserva el calculo interno", async (t) => {
  configurarCalculo(t);
  const persistencia = configurarPersistencia(t);
  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorId",
    async () => cliente,
  );
  t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: false, skipped: true }),
  );

  await new CotizacionService().crearCotizacionNormal(
    {
      idCliente: cliente.idCliente,
      detalles: [
        detalle,
        { ...detalle, idProducto: 2, descripcion: "Gorra", cantidad: 2 },
      ],
    },
    { idUsuario: 1, rol: "Admin" },
  );
  const data = persistencia.mock.calls[0]?.arguments[0];

  assert.equal(data.detalles.length, 2);
  assert.equal(Number(data.precioSugeridoInterno), 128000);
  assert.equal(data.total, 0);
});

test("cotizacion presencial crea Cliente externo y permite producto OTRO", async (t) => {
  t.mock.method(
    ProductoRepository.prototype,
    "buscarActivosPorIds",
    async () => [],
  );
  t.mock.method(
    TarifaTecnicaRepository.prototype,
    "cargarConfiguracionActiva",
    async () => [
      {
        idTecnica: 2,
        nombre: "DTF",
        tarifas: [],
        descuentos: [],
      },
    ],
  );
  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreoOTelefono",
    async () => null,
  );
  const crearCliente = t.mock.method(
    ClienteRepository.prototype,
    "crearCliente",
    async () => cliente,
  );
  const persistencia = configurarPersistencia(t);
  t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: false, skipped: true }),
  );

  await new CotizacionService().crearCotizacionNormal(
    {
      cliente: {
        nombre: cliente.nombre,
        correo: cliente.correo,
        telefono: cliente.telefono,
      },
      detalles: [
        {
          tipoProducto: "OTRO",
          nombrePersonalizado: "Bolso especial",
          descripcion: "Bolso especial",
          cantidad: 2,
          estampados: [
            {
              idTecnica: 2,
              ubicacion: "FRENTE",
              anchoCm: 80,
              altoCm: 80,
            },
          ],
        },
      ],
    },
    { idUsuario: 1, rol: "Admin" },
  );
  const data = persistencia.mock.calls[0]?.arguments[0];

  assert.equal(crearCliente.mock.calls.length, 1);
  assert.equal(data.detalles[0].tipoProducto, "OTRO");
  assert.equal(data.requiereRevisionPrecio, true);
});

test("cotizacion presencial reutiliza Cliente existente", async (t) => {
  configurarCalculo(t);
  configurarPersistencia(t);
  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreoOTelefono",
    async () => cliente,
  );
  const actualizar = t.mock.method(
    ClienteRepository.prototype,
    "actualizarCliente",
    async () => cliente,
  );
  t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: false, skipped: true }),
  );

  await new CotizacionService().crearCotizacionNormal(
    {
      cliente: {
        nombre: "Nombre actualizado",
        correo: cliente.correo,
        telefono: cliente.telefono,
      },
      detalles: [detalle],
    },
    { idUsuario: 1, rol: "Admin" },
  );

  assert.equal(actualizar.mock.calls.length, 1);
});

test("cotizacion presencial exige cliente y telefono", async () => {
  const service = new CotizacionService();

  await assert.rejects(
    () =>
      service.crearCotizacionNormal(
        { detalles: [detalle] },
        { idUsuario: 1, rol: "Admin" },
      ),
    /Debes seleccionar o registrar los datos del cliente/,
  );
  await assert.rejects(
    () =>
      service.crearCotizacionNormal(
        {
          cliente: {
            nombre: "Sin telefono",
            correo: "sintelefono@pixel.test",
          },
          detalles: [detalle],
        },
        { idUsuario: 1, rol: "Admin" },
      ),
    /telefono del cliente es obligatorio para cotizaciones presenciales/,
  );
});

test("editar solicitud reemplaza productos y estampados conservando asociaciones", async (t) => {
  configurarCalculo(t);
  t.mock.method(
    CotizacionRepository.prototype,
    "buscarPorId",
    async () => ({
      idCotizacion: 50,
      idCliente: cliente.idCliente,
      estado: "EN_REVISION",
      detalles: [
        { idDetalleCotizacion: 1, estampados: [{ id: 1 }] },
        { idDetalleCotizacion: 2, estampados: [{ id: 2 }] },
        { idDetalleCotizacion: 3, estampados: [{ id: 3 }] },
      ],
      versiones: [],
    }),
  );
  const reemplazar = t.mock.method(
    CotizacionRepository.prototype,
    "reemplazarSolicitud",
    async (_id: number, data: any, detalles: any[]) => ({
      idCotizacion: 50,
      ...data,
      detalles,
      versiones: [],
    }),
  );
  const estampados = Array.from({ length: 5 }, (_, indice) => ({
    idTecnica: 2,
    ubicacion: `POSICION-${indice + 1}`,
    anchoCm: 10 + indice,
    altoCm: 10 + indice,
    origenDiseno: "PIXEL",
    grupoDisenoCompartido:
      indice < 2 ? "GRUPO-EDITADO" : `INDIVIDUAL-${indice}`,
  }));

  await new CotizacionService().actualizarCotizacion(50, {
    observaciones: "Solicitud editada",
    items: [
      {
        idProducto: 1,
        cantidad: 20,
        suministradoPor: "CLIENTE",
        estampados,
      },
      {
        tipoProducto: "OTRO",
        nombrePersonalizado: "Producto especial nuevo",
        descripcion: "Reemplaza dos productos anteriores",
        cantidad: 1,
        suministradoPor: "PIXEL",
        estampados: [
          {
            idTecnica: 2,
            ubicacion: "FRENTE",
            anchoCm: 15,
            altoCm: 15,
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: "GRUPO-EDITADO",
          },
        ],
      },
    ],
  });
  const [, datosCotizacion, detalles] =
    reemplazar.mock.calls[0]!.arguments;

  assert.equal(datosCotizacion.estado, "EN_REVISION");
  assert.equal(datosCotizacion.total, 0);
  assert.equal(detalles.length, 2);
  assert.equal(detalles[0].cantidad, 20);
  assert.equal(detalles[0].suministradoPor, "CLIENTE");
  assert.equal(detalles[0].estampados.length, 5);
  assert.equal(detalles[1].tipoProducto, "OTRO");
  assert.equal(detalles[1].idProducto, null);
  assert.equal(
    detalles[1].estampados[0].grupoDisenoCompartido,
    "GRUPO-EDITADO",
  );
});

test("edicion estructural se bloquea cuando la propuesta ya fue enviada", async (t) => {
  t.mock.method(
    CotizacionRepository.prototype,
    "buscarPorId",
    async () => ({
      idCotizacion: 50,
      estado: "PENDIENTE_APROBACION_CLIENTE",
      detalles: [],
      versiones: [{ idVersion: 1, estado: "ENVIADA" }],
    }),
  );
  const reemplazar = t.mock.method(
    CotizacionRepository.prototype,
    "reemplazarSolicitud",
    async () => {
      throw new Error("No debe reemplazar la solicitud.");
    },
  );

  await assert.rejects(
    () =>
      new CotizacionService().actualizarCotizacion(50, {
        items: [detalle],
      }),
    /no se puede editar en su estado actual/i,
  );
  assert.equal(reemplazar.mock.calls.length, 0);
});

test("admin completa medidas en EN_REVISION y recalcula sin crear propuesta", async (t) => {
  configurarCalculo(t);
  t.mock.method(
    CotizacionRepository.prototype,
    "buscarPorId",
    async () => ({
      idCotizacion: 50,
      idCliente: cliente.idCliente,
      estado: "EN_REVISION",
      detalles: [],
      versiones: [],
    }),
  );
  const reemplazar = t.mock.method(
    CotizacionRepository.prototype,
    "reemplazarSolicitud",
    async (_id: number, data: any, detalles: any[]) => ({
      idCotizacion: 50,
      ...data,
      detalles,
      versiones: [],
    }),
  );

  await new CotizacionService().actualizarCotizacion(50, {
    items: [
      {
        ...detalle,
        estampados: detalle.estampados.map((estampado) => ({
          ...estampado,
          origenDiseno: "NO_REQUIERE",
        })),
      },
    ],
  });
  const [, cotizacionData, detalles] =
    reemplazar.mock.calls[0]!.arguments;

  assert.equal(cotizacionData.estado, "EN_REVISION");
  assert.equal(cotizacionData.requiereRevisionPrecio, false);
  assert.equal(Number(cotizacionData.precioSugeridoInterno), 108000);
  assert.equal(detalles[0].estampados[0].estadoMedidas, "DEFINIDAS");
  assert.equal(detalles[0].estampados[0].idTarifaAplicada, 1);
});
