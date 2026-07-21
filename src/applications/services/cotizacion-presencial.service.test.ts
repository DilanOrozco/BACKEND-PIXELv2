import test from "node:test";
import assert from "node:assert/strict";
import { CotizacionService } from "./cotizacion.service";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import { ProductoService } from "./producto.service";
import { ClienteAccessService } from "./cliente-access.service";
import { NotificationService } from "./notification.service";

const usuarioAuth = { idUsuario: 99, rol: "Admin" };
const detalle = {
  idTecnica: 1,
  descripcion: "Camiseta algodon",
  cantidad: 10,
  observaciones: "Color negro talla M",
};
const cliente = {
  idCliente: 7,
  nombre: "Juan Perez",
  documento: null,
  correo: "juan@email.com",
  telefono: "3001234567",
  direccion: null,
  estado: true,
};
const tecnica = {
  idTecnica: 1,
  nombre: "DTF",
  descripcion: null,
  estado: true,
};

const calculoProducto = {
  items: [
    {
      snapshot: {
        idProducto: 3,
        cantidad: 12,
        precioBase: 28000,
        descuentoPorcentaje: 7.14,
        descuentoValorUnitario: 1999,
        precioUnitario: 26001,
        subtotal: 336000,
        subtotalBruto: 336000,
        descuentoTotal: 23990,
        subtotalConDescuento: 312010,
      },
    },
  ],
  subtotal: 336000,
  descuentoTotal: 23990,
  total: 312010,
};

const mockCotizacionCreada = (t: any) =>
  t.mock.method(
    CotizacionRepository.prototype,
    "crearCotizacionConDetalles",
    async (data: any) => ({ idCotizacion: 1, ...data }),
  );

test("CotizacionService mantiene compatibilidad usando idCliente", async (t) => {
  t.mock.method(ClienteRepository.prototype, "buscarPorId", async () => cliente);
  const buscarClienteMock = t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreoOTelefono",
    async () => null,
  );
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => tecnica);
  const crearCotizacionMock = mockCotizacionCreada(t);

  const respuesta = await new CotizacionService().crearCotizacionNormal(
    {
      idCliente: 7,
      observaciones: "Entrega urgente",
      detalles: [detalle],
    },
    usuarioAuth,
  );
  const payload = crearCotizacionMock.mock.calls[0]?.arguments[0];

  assert.equal(respuesta.idCliente, 7);
  assert.equal(payload.creadoPorId, 99);
  assert.equal(payload.detalles[0].idTecnica, 1);
  assert.equal(buscarClienteMock.mock.calls.length, 0);
});

test("CotizacionService calcula y notifica cotizacion presencial con producto", async (t) => {
  t.mock.method(ClienteRepository.prototype, "buscarPorId", async () => cliente);
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => tecnica);
  t.mock.method(ProductoService.prototype, "calcularItems", async () => calculoProducto);
  t.mock.method(ClienteAccessService.prototype, "asegurarAccesoCliente", async () => ({
    usuarioCreado: true,
    usuarioExistente: false,
    linkCrearPassword: "https://pixel.test/crear-password-cliente/token",
  }));
  const notificarMock = t.mock.method(
    NotificationService.prototype,
    "cotizacionPresencialCreada",
    async () => ({ event: "COTIZACION_PRESENCIAL_CREADA", cliente: "enviado" as const }),
  );
  const crearCotizacionMock = mockCotizacionCreada(t);

  const respuesta = await new CotizacionService().crearCotizacionNormal(
    {
      idCliente: 7,
      costosAdicionales: 5000,
      detalles: [{ ...detalle, idProducto: 3, cantidad: 12, costoDiseno: 10000 }],
    },
    usuarioAuth,
  );
  const payload = crearCotizacionMock.mock.calls[0]?.arguments[0];

  assert.equal(respuesta.estado, "PENDIENTE");
  assert.equal(respuesta.total, 327010);
  assert.equal(payload.subtotal, 336000);
  assert.equal(payload.descuentoTotal, 23990);
  assert.equal(payload.total, 327010);
  assert.equal(payload.detalles[0].idProducto, 3);
  assert.equal(payload.detalles[0].precioBase, 28000);
  assert.equal(payload.detalles[0].descuentoPorcentaje, 7.14);
  assert.equal(payload.detalles[0].precioUnitario, 26001);
  assert.equal(payload.detalles[0].subtotalBruto, 336000);
  assert.equal(payload.detalles[0].descuentoTotal, 23990);
  assert.equal(payload.detalles[0].subtotalConDescuento, 312010);
  assert.equal(payload.detalles[0].costoDiseno, 10000);
  assert.equal(notificarMock.mock.calls.length, 1);
});

test("CotizacionService conserva solicitud por cotizar cuando no llega idProducto", async (t) => {
  t.mock.method(ClienteRepository.prototype, "buscarPorId", async () => cliente);
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => tecnica);
  const calcularMock = t.mock.method(ProductoService.prototype, "calcularItems", async () => calculoProducto);
  const crearCotizacionMock = mockCotizacionCreada(t);

  const respuesta = await new CotizacionService().crearCotizacionNormal(
    { idCliente: 7, detalles: [detalle] },
    usuarioAuth,
  );
  const payload = crearCotizacionMock.mock.calls[0]?.arguments[0];

  assert.equal(respuesta.total, 0);
  assert.equal(payload.detalles[0].precioUnitario, null);
  assert.equal(calcularMock.mock.calls.length, 0);
});

test("CotizacionService crea Cliente externo si no viene idCliente", async (t) => {
  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreoOTelefono",
    async () => null,
  );
  const crearClienteMock = t.mock.method(
    ClienteRepository.prototype,
    "crearCliente",
    async (data: any) => ({ ...cliente, ...data }),
  );
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => tecnica);
  const crearCotizacionMock = mockCotizacionCreada(t);

  const respuesta = await new CotizacionService().crearCotizacionNormal(
    {
      cliente: {
        nombre: "Juan Perez",
        correo: "JUAN@EMAIL.COM",
        telefono: "3001234567",
      },
      detalles: [detalle],
    },
    usuarioAuth,
  );
  const clienteData = crearClienteMock.mock.calls[0]?.arguments[0];
  const cotizacionData = crearCotizacionMock.mock.calls[0]?.arguments[0];

  assert.equal(clienteData.correo, "juan@email.com");
  assert.equal(clienteData.telefono, "3001234567");
  assert.equal(respuesta.idCliente, 7);
  assert.equal(cotizacionData.creadoPorId, 99);
});

test("CotizacionService reutiliza y actualiza Cliente externo existente", async (t) => {
  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreoOTelefono",
    async () => cliente,
  );
  const actualizarClienteMock = t.mock.method(
    ClienteRepository.prototype,
    "actualizarCliente",
    async (_id: number, data: any) => ({ ...cliente, ...data }),
  );
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => tecnica);
  mockCotizacionCreada(t);

  await new CotizacionService().crearCotizacionNormal(
    {
      cliente: {
        nombre: "Juan Actualizado",
        telefono: "3010000000",
      },
      detalles: [detalle],
    },
    usuarioAuth,
  );
  const [idCliente, dataActualizar] =
    actualizarClienteMock.mock.calls[0]?.arguments ?? [];

  assert.equal(idCliente, 7);
  assert.equal(dataActualizar.nombre, "Juan Actualizado");
  assert.equal(dataActualizar.correo, "juan@email.com");
  assert.equal(dataActualizar.telefono, "3010000000");
});

test("CotizacionService exige idCliente o cliente valido", async () => {
  await assert.rejects(
    () =>
      new CotizacionService().crearCotizacionNormal(
        { detalles: [detalle] },
        usuarioAuth,
      ),
    /Debes seleccionar o registrar los datos del cliente/,
  );

  await assert.rejects(
    () =>
      new CotizacionService().crearCotizacionNormal(
        { cliente: { nombre: "Juan" }, detalles: [detalle] },
        usuarioAuth,
      ),
    /Debes enviar correo o telefono del cliente/,
  );
});
