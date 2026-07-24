import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { verificarAuth, verificarAuthOpcional } from "./auth.middleware";
import { UsuarioRepository } from "../repositories/usuario.repository";
import { generarToken } from "../../utils/jwt.util";

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

const usuarioActivo = {
  idUsuario: 1,
  correo: "admin@pixel.test",
  idRol: 1,
  estado: true,
  rol: {
    nombre: "Admin",
    estado: true,
  },
  cliente: null,
};

const withJwtEnv = async (callback: () => Promise<void> | void) => {
  const secretAnterior = process.env.JWT_SECRET;
  const expiresAnterior = process.env.JWT_EXPIRES_IN;

  process.env.JWT_SECRET = "secret-middleware-test";
  process.env.JWT_EXPIRES_IN = "8h";

  try {
    await callback();
  } finally {
    if (secretAnterior === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = secretAnterior;
    }

    if (expiresAnterior === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = expiresAnterior;
    }
  }
};

test("verificarAuth permite token valido y carga usuario autenticado", async (t) => {
  await withJwtEnv(async () => {
    t.mock.method(
      UsuarioRepository.prototype,
      "buscarUsuarioAuthPorId",
      async () => usuarioActivo,
    );
    const token = generarToken({ idUsuario: 1, correo: "viejo@pixel.test" });
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = crearRespuesta();
    let llamado = false;

    await verificarAuth(req, res, () => {
      llamado = true;
    });

    assert.equal(llamado, true);
    assert.equal(req.user.idUsuario, 1);
    assert.equal(req.user.correo, "admin@pixel.test");
    assert.equal(req.user.rol, "Admin");
    assert.equal(req.user.idCliente, null);
  });
});

test("verificarAuth responde 401 claro para token vencido", async () => {
  await withJwtEnv(async () => {
    const token = jwt.sign(
      { idUsuario: 1 },
      process.env.JWT_SECRET as string,
      { expiresIn: "-1s" },
    );
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = crearRespuesta();
    let llamado = false;

    await verificarAuth(req, res, () => {
      llamado = true;
    });

    assert.equal(llamado, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.payload, {
      message: "Sesi\u00f3n expirada. Inicia sesi\u00f3n nuevamente.",
    });
  });
});

test("verificarAuth responde 401 para token invalido", async () => {
  await withJwtEnv(async () => {
    const req: any = { headers: { authorization: "Bearer token-invalido" } };
    const res = crearRespuesta();
    let llamado = false;

    await verificarAuth(req, res, () => {
      llamado = true;
    });

    assert.equal(llamado, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.payload, {
      message: "Token invalido.",
    });
  });
});

test("verificarAuthOpcional permite continuar sin token", async () => {
  const req: any = { headers: {} };
  const res = crearRespuesta();
  let llamado = false;

  await verificarAuthOpcional(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, true);
  assert.equal(req.user, undefined);
  assert.equal(res.statusCode, 200);
});

test("verificarAuthOpcional carga Cliente cuando recibe token valido", async (t) => {
  await withJwtEnv(async () => {
    t.mock.method(
      UsuarioRepository.prototype,
      "buscarUsuarioAuthPorId",
      async () => ({
        ...usuarioActivo,
        rol: { nombre: "Cliente", estado: true },
        cliente: { idCliente: 10, estado: true },
      }),
    );
    const token = generarToken({ idUsuario: 1 });
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = crearRespuesta();
    let llamado = false;

    await verificarAuthOpcional(req, res, () => {
      llamado = true;
    });

    assert.equal(llamado, true);
    assert.equal(req.user.rol, "Cliente");
    assert.equal(req.user.idCliente, 10);
  });
});
