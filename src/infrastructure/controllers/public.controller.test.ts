import test from "node:test";
import assert from "node:assert/strict";
import {
  PublicCotizacionConflictError,
  PublicCotizacionService,
} from "../../applications/services/public-cotizacion.service";
import { PublicController } from "./public.controller";

const crearRespuesta = () => {
  const respuesta: any = {
    statusCode: 200,
    payload: undefined,
    status(codigo: number) {
      this.statusCode = codigo;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };

  return respuesta;
};

test("PublicController responde 409 y EMAIL_REQUIRES_LOGIN para correo registrado", async (t) => {
  t.mock.method(
    PublicCotizacionService.prototype,
    "crearCotizacion",
    async () => {
      throw new PublicCotizacionConflictError();
    },
  );
  const req: any = {
    body: {
      cliente: { nombre: "Ana", correo: "ana@pixel.test" },
      items: [{ idProducto: 1, idTecnica: 1, cantidad: 1 }],
    },
  };
  const res = crearRespuesta();

  await new PublicController().crearCotizacion(req, res);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.payload, {
    message:
      "Este correo ya est\u00e1 registrado. Inicia sesi\u00f3n para realizar una cotizaci\u00f3n con esta cuenta.",
    code: "EMAIL_REQUIRES_LOGIN",
  });
});
