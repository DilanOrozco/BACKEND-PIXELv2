import assert from "node:assert/strict";
import test from "node:test";
import { RolRepository } from "../../infrastructure/repositories/rol.repository";
import { RolService } from "./rol.service";

const rol = { idRol: 8, nombre: "Operaciones", descripcion: null, estado: true };

test("RolService crea y actualiza roles normalizados sin duplicados", async (t) => {
  let existente: any = null;
  t.mock.method(RolRepository.prototype, "buscarPorNombreExacto", async () => existente);
  const crear = t.mock.method(
    RolRepository.prototype,
    "crearRol",
    async (nombre: string, descripcion?: string) => ({ ...rol, nombre, descripcion }) as any,
  );
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => rol as any);
  const actualizar = t.mock.method(
    RolRepository.prototype,
    "actualizarRol",
    async (_id: number, data: any) => ({ ...rol, ...data }) as any,
  );
  const service = new RolService();

  await service.crearRol(" Operaciones ", " Gestion diaria ");
  assert.deepEqual(crear.mock.calls[0]?.arguments, ["Operaciones", "Gestion diaria"]);
  await service.actualizarRol(8, { nombre: " Produccion ", descripcion: " Area productiva " });
  assert.deepEqual(actualizar.mock.calls[0]?.arguments[1], {
    nombre: "Produccion",
    descripcion: "Area productiva",
  });

  existente = { ...rol, idRol: 99 };
  await assert.rejects(() => service.crearRol("Operaciones"), /no puede repetirse/i);
  await assert.rejects(
    () => service.actualizarRol(8, { nombre: "Operaciones" }),
    /no puede repetirse/i,
  );
});

test("RolService lista y busca con respuestas y errores estables", async (t) => {
  let data: any[] = [rol];
  t.mock.method(RolRepository.prototype, "listarRoles", async () => data as any);
  t.mock.method(
    RolRepository.prototype,
    "listarRolesPaginado",
    async () => ({ data, total: data.length }) as any,
  );
  t.mock.method(RolRepository.prototype, "buscarPorNombreParcial", async () => data as any);
  const service = new RolService();

  assert.deepEqual(await service.listarRoles(), { data: [rol] });
  assert.equal((await service.listarRoles({ page: "1", limit: "5" })).meta.total, 1);
  assert.deepEqual(await service.buscarPorNombre("Opera"), [rol]);

  data = [];
  await assert.rejects(() => service.listarRoles(), /No se encontraron resultados/i);
  await assert.rejects(() => service.listarRoles({ page: "1" }), /No se encontraron resultados/i);
  await assert.rejects(() => service.buscarPorNombre("x"), /No se encontraron resultados/i);
});

test("RolService desactiva y valida IDs inválidos", async (t) => {
  let encontrado: any = rol;
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => encontrado);
  const desactivar = t.mock.method(
    RolRepository.prototype,
    "desactivarRol",
    async () => ({ ...rol, estado: false }) as any,
  );
  const service = new RolService();

  await service.desactivarRol(8);
  assert.equal(desactivar.mock.callCount(), 1);
  await assert.rejects(() => service.actualizarRol(Number.NaN, {}), /ID del rol/i);
  await assert.rejects(() => service.eliminarRol(0), /ID del rol/i);
  encontrado = null;
  await assert.rejects(() => service.desactivarRol(8), /No se encontraron resultados/i);
});
