import test from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "./auth.service";
import { EmailService } from "./email.service";
import { compararContrasena } from "../../utils/password.util";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";
import { PasswordResetTokenRepository } from "../../infrastructure/repositories/password-reset-token.repository";

const usuario = {
  idUsuario: 1,
  idRol: 1,
  nombre: "Admin PIXEL",
  correo: "admin@pixel.test",
  contrasenaHash: "hash-anterior",
  estado: true,
};

test("AuthService forgot-password responde generico y no revela correos inexistentes", async (t) => {
  t.mock.method(UsuarioRepository.prototype, "buscarPorCorreo", async () => null);
  const crearTokenMock = t.mock.method(
    PasswordResetTokenRepository.prototype,
    "crearToken",
    async () => ({}),
  );
  const emailMock = t.mock.method(
    EmailService.prototype,
    "sendPasswordReset",
    async () => ({ sent: true, skipped: false }),
  );

  const service = new AuthService();
  const respuesta = await service.forgotPassword({ correo: "nadie@pixel.test" });

  assert.match(respuesta.message, /Si el correo existe/);
  assert.equal(crearTokenMock.mock.calls.length, 0);
  assert.equal(emailMock.mock.calls.length, 0);
});

test("AuthService forgot-password genera hash, expiracion y envia link si usuario existe", async (t) => {
  t.mock.method(UsuarioRepository.prototype, "buscarPorCorreo", async () => usuario);
  const invalidarMock = t.mock.method(
    PasswordResetTokenRepository.prototype,
    "invalidarTokensActivos",
    async () => ({ count: 0 }),
  );
  const crearTokenMock = t.mock.method(
    PasswordResetTokenRepository.prototype,
    "crearToken",
    async (data: any) => data,
  );
  const emailMock = t.mock.method(
    EmailService.prototype,
    "sendPasswordReset",
    async () => ({ sent: true, skipped: false }),
  );

  const frontendAnterior = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "https://pixel.test";

  const service = new AuthService();
  const respuesta = await service.forgotPassword({ correo: "ADMIN@PIXEL.TEST" });
  const tokenData = crearTokenMock.mock.calls[0]?.arguments[0];
  const resetUrl = emailMock.mock.calls[0]?.arguments[2];

  assert.match(respuesta.message, /Si el correo existe/);
  assert.equal(invalidarMock.mock.calls[0]?.arguments[0], 1);
  assert.equal(tokenData.idUsuario, 1);
  assert.equal(tokenData.tokenHash.length, 64);
  assert.ok(tokenData.fechaExpiracion instanceof Date);
  assert.equal(typeof resetUrl, "string");
  assert.match(resetUrl as string, /^https:\/\/pixel\.test\/reset-password\/[a-f0-9]{64}$/);

  if (frontendAnterior === undefined) {
    delete process.env.FRONTEND_URL;
  } else {
    process.env.FRONTEND_URL = frontendAnterior;
  }
});

test("AuthService reset-password cambia contrasena y marca token usado", async (t) => {
  t.mock.method(
    PasswordResetTokenRepository.prototype,
    "buscarTokenValido",
    async () => ({
      idPasswordResetToken: 50,
      idUsuario: 1,
      usuario,
    }),
  );
  const actualizarMock = t.mock.method(
    UsuarioRepository.prototype,
    "actualizarUsuario",
    async (_id: number, data: any) => ({ ...usuario, ...data }),
  );
  const marcarUsadoMock = t.mock.method(
    PasswordResetTokenRepository.prototype,
    "marcarUsado",
    async () => ({}),
  );

  const service = new AuthService();
  const respuesta = await service.resetPassword({
    token: "token-valido",
    password: "NuevaPassword123",
  });
  const dataActualizar = actualizarMock.mock.calls[0]?.arguments[1];

  assert.equal(respuesta.message, "Contrasena actualizada correctamente.");
  assert.equal(actualizarMock.mock.calls[0]?.arguments[0], 1);
  assert.equal(
    await compararContrasena("NuevaPassword123", dataActualizar.contrasenaHash),
    true,
  );
  assert.equal(marcarUsadoMock.mock.calls[0]?.arguments[0], 50);
});

test("AuthService reset-password falla con token invalido o contrasena invalida", async (t) => {
  t.mock.method(
    PasswordResetTokenRepository.prototype,
    "buscarTokenValido",
    async () => null,
  );
  const service = new AuthService();

  await assert.rejects(
    () => service.resetPassword({ token: "x", password: "123" }),
    /minimo 6 caracteres/,
  );
  await assert.rejects(
    () => service.resetPassword({ token: "x", password: "NuevaPassword123" }),
    /no es valido o expiro/,
  );
});
