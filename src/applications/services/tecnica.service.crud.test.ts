import assert from "node:assert/strict";
import test from "node:test";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import { TecnicaService } from "./tecnica.service";

const tecnica = { idTecnica: 1, nombre: "DTF", descripcion: null, requiereMedidas: true, estado: true };

test("TecnicaService lista y busca técnicas con errores controlados", async (t) => {
  let data: any[] = [tecnica];
  t.mock.method(TecnicaRepository.prototype, "listarTecnicas", async () => data as any);
  t.mock.method(
    TecnicaRepository.prototype,
    "listarTecnicasPaginado",
    async () => ({ data, total: data.length }) as any,
  );
  t.mock.method(TecnicaRepository.prototype, "buscarParcial", async () => data as any);
  const service = new TecnicaService();

  assert.deepEqual(await service.listarTecnicas(), { data: [tecnica] });
  assert.equal((await service.listarTecnicas({ page: "1", limit: "5" })).meta.total, 1);
  assert.deepEqual(await service.buscarParcial(" DTF "), [tecnica]);
  await assert.rejects(() => service.buscarParcial(" "), /t.rmino de b.squeda/i);

  data = [];
  await assert.rejects(() => service.listarTecnicas(), /No se encontraron resultados/i);
  await assert.rejects(() => service.listarTecnicas({ page: "1" }), /No se encontraron resultados/i);
  await assert.rejects(() => service.buscarParcial("x"), /No se encontraron resultados/i);
});

test("TecnicaService actualiza, desactiva y elimina técnicas existentes", async (t) => {
  let encontrada: any = tecnica;
  let duplicada: any = null;
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => encontrada);
  t.mock.method(TecnicaRepository.prototype, "buscarPorNombreExacto", async () => duplicada);
  const actualizar = t.mock.method(
    TecnicaRepository.prototype,
    "actualizarTecnica",
    async (_id: number, data: any) => ({ ...tecnica, ...data }) as any,
  );
  const desactivar = t.mock.method(
    TecnicaRepository.prototype,
    "desactivarTecnica",
    async () => ({ ...tecnica, estado: false }) as any,
  );
  const eliminar = t.mock.method(
    TecnicaRepository.prototype,
    "eliminarTecnica",
    async () => tecnica as any,
  );
  const service = new TecnicaService();

  await service.actualizarTecnica(1, {
    nombre: " Bordado ",
    descripcion: null,
    estado: false,
    requiereMedidas: false,
  });
  assert.deepEqual(actualizar.mock.calls[0]?.arguments[1], {
    nombre: "Bordado",
    descripcion: null,
    estado: false,
    requiereMedidas: false,
  });
  await service.desactivarTecnica(1);
  await service.eliminarTecnica(1);
  assert.equal(desactivar.mock.callCount(), 1);
  assert.equal(eliminar.mock.callCount(), 1);

  duplicada = { idTecnica: 2, nombre: "Bordado" };
  await assert.rejects(
    () => service.actualizarTecnica(1, { nombre: "Bordado" }),
    /no puede repetirse/i,
  );
  encontrada = null;
  await assert.rejects(() => service.actualizarTecnica(1, { estado: false }), /No se encontraron resultados/i);
});
