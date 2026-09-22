import test from "node:test";
import assert from "node:assert/strict";
import { TecnicaService } from "./tecnica.service";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import {
  tecnicaPublicSelect,
  tecnicaSelect,
} from "../../utils/selects/tecnica.select";

test("crear tecnica permite configurar si requiere medidas", async (t) => {
  t.mock.method(
    TecnicaRepository.prototype,
    "buscarPorNombreExacto",
    async () => null,
  );
  const crear = t.mock.method(
    TecnicaRepository.prototype,
    "crearTecnica",
    async (data: any) => ({ idTecnica: 1, ...data }),
  );

  const resultado = await new TecnicaService().crearTecnica({
    nombre: "Servicio fijo",
    descripcion: null,
    requiereMedidas: false,
  });
  const data = crear.mock.calls[0]!.arguments[0] as any;

  assert.equal(data.requiereMedidas, false);
  assert.equal(data.descripcion, null);
  assert.equal(resultado.requiereMedidas, false);
});

test("crear tecnica mantiene requiereMedidas true por compatibilidad", async (t) => {
  t.mock.method(
    TecnicaRepository.prototype,
    "buscarPorNombreExacto",
    async () => null,
  );
  const crear = t.mock.method(
    TecnicaRepository.prototype,
    "crearTecnica",
    async (data: any) => ({ idTecnica: 1, ...data }),
  );

  await new TecnicaService().crearTecnica({
    nombre: "DTF",
    descripcion: "Impresion DTF",
  });

  assert.equal(
    (crear.mock.calls[0]!.arguments[0] as any).requiereMedidas,
    true,
  );
});

test("actualizar tecnica valida requiereMedidas como booleano", async () => {
  await assert.rejects(
    () =>
      new TecnicaService().actualizarTecnica(1, {
        requiereMedidas: "false",
      }),
    /requiereMedidas debe ser verdadero o falso/i,
  );
});

test("select publico de tecnica no expone tarifas ni descuentos", () => {
  assert.equal(tecnicaPublicSelect.requiereMedidas, true);
  assert.equal(tecnicaPublicSelect.estado, true);
  assert.equal("tarifas" in tecnicaPublicSelect, false);
  assert.equal("descuentos" in tecnicaPublicSelect, false);
  assert.equal(tecnicaSelect.requiereMedidas, true);
});

test("buscar tecnica conserva la validacion coercitiva de IDs", async (t) => {
  const buscarPorId = t.mock.method(
    TecnicaRepository.prototype,
    "buscarPorId",
    async (idTecnica: number) => ({ idTecnica }),
  );
  const service = new TecnicaService();

  assert.deepEqual(await service.buscarPorId(7), { idTecnica: 7 });
  assert.deepEqual(
    await service.buscarPorId("8" as unknown as number),
    { idTecnica: "8" },
  );

  for (const idInvalido of ["abc", null, undefined, Number.NaN]) {
    await assert.rejects(
      () => service.buscarPorId(idInvalido as unknown as number),
      /ID de la técnica no es válido/,
    );
  }

  assert.equal(buscarPorId.mock.callCount(), 2);
});
