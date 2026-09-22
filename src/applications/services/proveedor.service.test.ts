import assert from "node:assert/strict";
import test from "node:test";
import { ProveedorRepository } from "../../infrastructure/repositories/proveedor.repository";
import { ProveedorService } from "./proveedor.service";

const proveedor = {
  idProveedor: 7,
  nombre: "Textiles Andinos",
  telefono: "3001234567",
  correo: "ventas@textiles.test",
  direccion: "Calle 1",
  estado: true,
  fechaCreacion: new Date("2026-01-01"),
  fechaActualizacion: new Date("2026-01-01"),
};

test("ProveedorService crea datos normalizados y bloquea duplicados", async (t) => {
  let existente: any = null;
  t.mock.method(ProveedorRepository.prototype, "buscarPorNombreExacto", async () => existente);
  const crear = t.mock.method(
    ProveedorRepository.prototype,
    "crearProveedor",
    async (data: any) => ({ idProveedor: 7, ...data }) as any,
  );
  const service = new ProveedorService();

  await service.crearProveedor({
    nombre: "  Textiles Andinos  ",
    telefono: " 3001234567 ",
    correo: " ventas@textiles.test ",
    direccion: " ",
  });

  assert.deepEqual(crear.mock.calls[0]?.arguments[0], {
    nombre: "Textiles Andinos",
    telefono: "3001234567",
    correo: "ventas@textiles.test",
    direccion: null,
    estado: true,
  });

  existente = proveedor;
  await assert.rejects(
    () => service.crearProveedor({ nombre: "Textiles Andinos" }),
    /no puede repetirse/i,
  );
});

test("ProveedorService lista con filtros y paginación sin ocultar vacíos", async (t) => {
  let data: any[] = [proveedor];
  const listar = t.mock.method(
    ProveedorRepository.prototype,
    "listarProveedores",
    async () => data as any,
  );
  const listarPaginado = t.mock.method(
    ProveedorRepository.prototype,
    "listarProveedoresPaginado",
    async () => ({ data, total: data.length }) as any,
  );
  const service = new ProveedorService();

  assert.deepEqual(await service.listarProveedores({ estado: "false" }), {
    data: [proveedor],
  });
  assert.deepEqual(listar.mock.calls[0]?.arguments[0], { estado: false });

  const pagina = await service.listarProveedores({ page: "1", limit: "5", search: "text" });
  assert.equal(pagina.meta.total, 1);
  assert.equal(listarPaginado.mock.callCount(), 1);

  await assert.rejects(
    () => service.listarProveedores({ estado: "quizas" }),
    /filtro estado/i,
  );
  data = [];
  await assert.rejects(() => service.listarProveedores({}), /No se encontraron resultados/i);
  await assert.rejects(
    () => service.listarProveedores({ page: "1", limit: "5" }),
    /No se encontraron resultados/i,
  );
});

test("ProveedorService consulta por id y término con errores controlados", async (t) => {
  let resultadoId: any = proveedor;
  let resultados: any[] = [proveedor];
  t.mock.method(ProveedorRepository.prototype, "buscarPorId", async () => resultadoId);
  const buscarParcial = t.mock.method(
    ProveedorRepository.prototype,
    "buscarParcial",
    async () => resultados as any,
  );
  const service = new ProveedorService();

  assert.equal((await service.buscarPorId(7)).idProveedor, 7);
  assert.deepEqual(await service.buscarParcial("  Textiles "), [proveedor]);
  assert.equal(buscarParcial.mock.calls[0]?.arguments[0], "Textiles");
  await assert.rejects(() => service.buscarPorId(0), /ID del proveedor/i);
  await assert.rejects(() => service.buscarParcial(" "), /termino de busqueda/i);

  resultadoId = null;
  resultados = [];
  await assert.rejects(() => service.buscarPorId(7), /Proveedor no encontrado/i);
  await assert.rejects(() => service.buscarParcial("Nadie"), /No se encontraron resultados/i);
});

test("ProveedorService actualiza campos permitidos y valida nombre único", async (t) => {
  let existenteNombre: any = null;
  t.mock.method(ProveedorRepository.prototype, "buscarPorId", async () => proveedor as any);
  t.mock.method(
    ProveedorRepository.prototype,
    "buscarPorNombreExacto",
    async () => existenteNombre,
  );
  const actualizar = t.mock.method(
    ProveedorRepository.prototype,
    "actualizarProveedor",
    async (_id: number, data: any) => ({ ...proveedor, ...data }) as any,
  );
  const service = new ProveedorService();

  await service.actualizarProveedor(7, {
    nombre: " Nuevo nombre ",
    telefono: " ",
    correo: null,
    direccion: " Nueva dirección ",
    estado: false,
  });
  assert.deepEqual(actualizar.mock.calls[0]?.arguments[1], {
    nombre: "Nuevo nombre",
    telefono: null,
    correo: null,
    direccion: "Nueva dirección",
    estado: false,
  });

  existenteNombre = { ...proveedor, idProveedor: 99 };
  await assert.rejects(
    () => service.actualizarProveedor(7, { nombre: "Duplicado" }),
    /no puede repetirse/i,
  );
});

test("ProveedorService desactiva y elimina únicamente proveedores sin compras", async (t) => {
  t.mock.method(ProveedorRepository.prototype, "buscarPorId", async () => proveedor as any);
  let compras = 1;
  t.mock.method(ProveedorRepository.prototype, "contarCompras", async () => compras);
  const desactivar = t.mock.method(
    ProveedorRepository.prototype,
    "desactivarProveedor",
    async () => ({ ...proveedor, estado: false }) as any,
  );
  const eliminar = t.mock.method(
    ProveedorRepository.prototype,
    "eliminarProveedor",
    async () => proveedor as any,
  );
  const service = new ProveedorService();

  await service.desactivarProveedor(7);
  assert.equal(desactivar.mock.callCount(), 1);
  await assert.rejects(() => service.eliminarProveedor(7), /compras asociadas/i);
  compras = 0;
  await service.eliminarProveedor(7);
  assert.equal(eliminar.mock.callCount(), 1);
});
