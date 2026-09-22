import assert from "node:assert/strict";
import test from "node:test";
import app from "./server";

test("Express no expone X-Powered-By", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/ruta-inexistente`);

  assert.equal(response.headers.has("x-powered-by"), false);
});
