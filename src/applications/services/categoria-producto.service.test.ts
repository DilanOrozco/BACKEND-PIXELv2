import test from "node:test";
import assert from "node:assert/strict";
import { CategoriaProductoService } from "./categoria-producto.service";
import { CategoriaProductoRepository } from "../../infrastructure/repositories/categoria-producto.repository";

const categoria = {
  idCategoriaProducto: 1,
  nombre: "Camisetas",
  descripcion: null,
  estado: true,
  fechaCreacion: new Date("2026-01-01"),
  fechaActualizacion: new Date("2026-01-01"),
};

test("CategoriaProductoService crea categoria y evita duplicados", async (t) => {
  t.mock.method(
    CategoriaProductoRepository.prototype,
    "buscarPorNombreExacto",
    async () => null,
  );
  const crearMock = t.mock.method(
    CategoriaProductoRepository.prototype,
    "crearCategoria",
    async (data: any) => ({ ...categoria, ...data }),
  );

  const service = new CategoriaProductoService();
  const creada = await service.crearCategoria({ nombre: " Camisetas " });

  assert.equal(creada.nombre, "Camisetas");
  assert.equal(crearMock.mock.calls[0]?.arguments[0].estado, true);

  t.mock.restoreAll();
  t.mock.method(
    CategoriaProductoRepository.prototype,
    "buscarPorNombreExacto",
    async () => categoria,
  );

  await assert.rejects(
    () => service.crearCategoria({ nombre: "Camisetas" }),
    /no puede repetirse/,
  );
});

test("CategoriaProductoService lista con paginacion y search", async (t) => {
  const listarMock = t.mock.method(
    CategoriaProductoRepository.prototype,
    "listarCategoriasPaginado",
    async () => ({ data: [categoria], total: 1 }),
  );

  const service = new CategoriaProductoService();
  const respuesta = await service.listarCategorias({
    page: "2",
    limit: "50",
    search: "cam",
    sortBy: "nombre",
    order: "asc",
  });

  const pagination = listarMock.mock.calls[0]?.arguments[0];
  assert.ok(pagination);
  assert.equal(pagination.page, 2);
  assert.equal(pagination.limit, 10);
  assert.equal(pagination.search, "cam");
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

test("CategoriaProductoService edita, desactiva y bloquea eliminar con productos", async (t) => {
  t.mock.method(
    CategoriaProductoRepository.prototype,
    "buscarPorId",
    async () => categoria,
  );
  t.mock.method(
    CategoriaProductoRepository.prototype,
    "buscarPorNombreExacto",
    async () => null,
  );
  const actualizarMock = t.mock.method(
    CategoriaProductoRepository.prototype,
    "actualizarCategoria",
    async (_id: number, data: any) => ({ ...categoria, ...data }),
  );
  const desactivarMock = t.mock.method(
    CategoriaProductoRepository.prototype,
    "desactivarCategoria",
    async () => ({ ...categoria, estado: false }),
  );
  t.mock.method(
    CategoriaProductoRepository.prototype,
    "contarProductos",
    async () => 2,
  );

  const service = new CategoriaProductoService();
  const editada = await service.actualizarCategoria(1, { nombre: "Polos" });
  const desactivada = await service.desactivarCategoria(1);

  assert.equal(editada.nombre, "Polos");
  assert.equal(actualizarMock.mock.calls[0]?.arguments[0], 1);
  assert.equal(desactivada.estado, false);
  assert.equal(desactivarMock.mock.calls[0]?.arguments[0], 1);
  await assert.rejects(() => service.eliminarCategoria(1), /productos asociados/);
});
