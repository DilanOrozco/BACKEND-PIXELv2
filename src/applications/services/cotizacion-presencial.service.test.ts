import test from "node:test";
import assert from "node:assert/strict";
import { CotizacionService } from "./cotizacion.service";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";

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
