import "dotenv/config";
import jwt from "jsonwebtoken";
import type { SignOptions, Secret } from "jsonwebtoken";

type JwtExpiresIn = NonNullable<SignOptions["expiresIn"]>;

const DEFAULT_JWT_EXPIRES_IN: JwtExpiresIn = "8h";

export const obtenerJwtSecret = (): Secret => {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error("JWT_SECRET no configurado.");
  }

  return secret;
};

export const obtenerJwtExpiresIn = (): JwtExpiresIn =>
  (process.env.JWT_EXPIRES_IN?.trim() as JwtExpiresIn | undefined) ||
  DEFAULT_JWT_EXPIRES_IN;

export const generarToken = (payload: object): string => {
  const options: SignOptions = {
    expiresIn: obtenerJwtExpiresIn(),
  };

  return jwt.sign(payload, obtenerJwtSecret(), options);
};

export const verificarToken = (token: string) => {
  return jwt.verify(token, obtenerJwtSecret());
};
