import test from "node:test";
import assert from "node:assert/strict";
import { ClienteService } from "./cliente.service";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";

const cliente = {
  idCliente: 1,
  nombre: "Ana Cliente",
  documento: "123",
  correo: "ana@pixel.test",
  telefono: "3001234567",
  direccion: null,
  estado: true,
  fechaCreacion: new Date("2026-01-01"),
  fechaActualizacion: new Date("2026-01-01"),
};

test("ClienteService lista clientes con paginacion search y sort", async (t) => {
  const listarMock = t.mock.method(
    ClienteRepository.prototype,
    "listarClientesPaginado",
    async () => ({ data: [cliente], total: 1 }),
  );

  const respuesta = await new ClienteService().listarClientes({
    page: "2",
    limit: "100",
    search: "ana",
    sortBy: "nombre",
    order: "asc",
  });
  const pagination = listarMock.mock.calls[0]?.arguments[0];

  assert.ok(pagination);
  assert.equal(pagination.page, 2);
  assert.equal(pagination.limit, 10);
  assert.equal(pagination.search, "ana");
  assert.equal(pagination.sortBy, "nombre");
  assert.deepEqual(respuesta.meta, {
    page: 2,
    limit: 10,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: true,
  });
});

test("ClienteService obtiene detalle con relaciones", async (t) => {
  t.mock.method(
    ClienteRepository.prototype,
    "buscarDetallePorId",
    async () => ({
      ...cliente,
      cotizaciones: [{ idCotizacion: 1 }],
      pedidos: [{ idPedido: 1 }],
      _count: { cotizaciones: 1, pedidos: 1 },
    }),
  );

  const detalle = await new ClienteService().buscarPorId(1);

  assert.equal(detalle.idCliente, 1);
  assert.equal(detalle._count.cotizaciones, 1);
  assert.equal(detalle.pedidos[0]?.idPedido, 1);
});

test("ClienteService desactiva cliente y bloquea eliminar con relaciones", async (t) => {
  t.mock.method(ClienteRepository.prototype, "buscarPorId", async () => cliente);
  t.mock.method(
    ClienteRepository.prototype,
    "desactivarCliente",
    async () => ({ ...cliente, estado: false }),
  );
  t.mock.method(
    ClienteRepository.prototype,
    "contarRelaciones",
    async () => ({ cotizaciones: 1, pedidos: 0, total: 1 }),
  );

  const desactivado = await new ClienteService().desactivarCliente(1);

  assert.equal(desactivado.estado, false);
  await assert.rejects(
    () => new ClienteService().eliminarCliente(1),
    /cotizaciones o pedidos relacionados/,
  );
});

test("ClienteService elimina cliente sin relaciones", async (t) => {
  t.mock.method(ClienteRepository.prototype, "buscarPorId", async () => cliente);
  t.mock.method(
    ClienteRepository.prototype,
    "contarRelaciones",
    async () => ({ cotizaciones: 0, pedidos: 0, total: 0 }),
  );
  const eliminarMock = t.mock.method(
    ClienteRepository.prototype,
    "eliminarCliente",
    async () => cliente,
  );

  const eliminado = await new ClienteService().eliminarCliente(1);

  assert.equal(eliminado.idCliente, 1);
  assert.equal(eliminarMock.mock.calls[0]?.arguments[0], 1);
});
