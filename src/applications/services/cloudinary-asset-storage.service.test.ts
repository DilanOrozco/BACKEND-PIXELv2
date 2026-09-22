import assert from "node:assert/strict";
import test from "node:test";
import { normalizarErrorCloudinary } from "./cloudinary-asset-storage.service";

test("Cloudinary siempre rechaza con Error y conserva el mensaje del SDK", () => {
  const errorOriginal = new Error("fallo original");

  assert.equal(
    normalizarErrorCloudinary(errorOriginal, "fallback"),
    errorOriginal,
  );
  assert.match(
    normalizarErrorCloudinary({ message: "fallo del SDK" }, "fallback")
      .message,
    /fallo del SDK/,
  );
  assert.match(
    normalizarErrorCloudinary("fallo sin estructura", "fallback").message,
    /fallback/,
  );
  assert.match(
    normalizarErrorCloudinary(undefined, "respuesta vacia").message,
    /respuesta vacia/,
  );
});
