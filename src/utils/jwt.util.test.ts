import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  generarToken,
  obtenerJwtExpiresIn,
  obtenerJwtSecret,
  verificarToken,
} from "./jwt.util";

const withEnv = async (
  env: Record<string, string | undefined>,
  callback: () => void | Promise<void>,
) => {
  const anterior: Record<string, string | undefined> = {};

  for (const key of Object.keys(env)) {
    anterior[key] = process.env[key];
    const value = env[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await callback();
  } finally {
    for (const [key, value] of Object.entries(anterior)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test("JWT usa expiracion configurada por JWT_EXPIRES_IN", async () => {
  await withEnv(
    {
      JWT_SECRET: "secret-test-configurado",
      JWT_EXPIRES_IN: "12h",
    },
    () => {
      const token = generarToken({ idUsuario: 1 });
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      assert.equal(obtenerJwtExpiresIn(), "12h");
      assert.equal(decoded.idUsuario, 1);
      assert.equal(typeof decoded.iat, "number");
      assert.equal(typeof decoded.exp, "number");
      assert.equal((decoded.exp ?? 0) - (decoded.iat ?? 0), 12 * 60 * 60);
    },
  );
});

test("JWT usa expiracion por defecto de 8h sin tokens infinitos", async () => {
  await withEnv(
    {
      JWT_SECRET: "secret-test-default",
      JWT_EXPIRES_IN: undefined,
    },
    () => {
      const token = generarToken({ idUsuario: 1 });
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      assert.equal(obtenerJwtExpiresIn(), "8h");
      assert.equal((decoded.exp ?? 0) - (decoded.iat ?? 0), 8 * 60 * 60);
    },
  );
});

test("JWT_SECRET viene de env y no se regenera solo", async () => {
  await withEnv(
    {
      JWT_SECRET: "secret-estable",
      JWT_EXPIRES_IN: "8h",
    },
    () => {
      assert.equal(obtenerJwtSecret(), "secret-estable");

      const token = generarToken({ idUsuario: 1 });
      const decoded = verificarToken(token) as jwt.JwtPayload;

      assert.equal(decoded.idUsuario, 1);
    },
  );

  await withEnv(
    {
      JWT_SECRET: undefined,
    },
    () => {
      assert.throws(() => obtenerJwtSecret(), /JWT_SECRET no configurado/);
    },
  );
});
