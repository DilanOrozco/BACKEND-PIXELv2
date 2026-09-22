import test from "node:test";
import assert from "node:assert/strict";
import { TesseractOcrService } from "./ocr.service";

test("TesseractOcrService extrae monto, referencia, fecha y plataforma", () => {
  const service = new TesseractOcrService();
  const texto = [
    "Nequi",
    "Valor enviado: $100.000",
    "Referencia: ABC123456",
    "Fecha: 26/07/2026",
  ].join("\n");
  const monto = service.extractAmount(texto);

  assert.equal(monto.montoDetectado, 100000);
  assert.deepEqual(monto.candidatosMonto, [100000]);
  assert.equal(service.extractReference(texto), "ABC123456");
  assert.equal(service.extractDate(texto)?.toISOString(), "2026-07-26T00:00:00.000Z");
  assert.equal(service.detectBankOrPlatform(texto), "Nequi");
});

test("TesseractOcrService conserva varios candidatos y no confunde texto sin monto", () => {
  const service = new TesseractOcrService();
  const varios = service.extractAmount("Monto: $50.000\nTotal: 250.000 COP");
  const ninguno = service.extractAmount(
    "Telefono 3001234567\nReferencia ABC123456",
  );

  assert.deepEqual(varios.candidatosMonto, [50000, 250000]);
  assert.equal(varios.montoDetectado, 50000);
  assert.equal(ninguno.montoDetectado, null);
});

test("TesseractOcrService admite espacios y prefijos opcionales del monto", () => {
  const service = new TesseractOcrService();
  const resultado = service.extractAmount(
    "Valor \t enviado \t: \t COP \t $ \t 120.000",
  );

  assert.deepEqual(resultado, {
    montoDetectado: 120000,
    candidatosMonto: [120000],
  });
});

test("TesseractOcrService conserva separadores y orden de formatos de moneda", () => {
  const service = new TesseractOcrService();
  const resultado = service.extractAmount(
    "$ 20,000\n300.000 COP\nCOP $ 1.234,50",
  );

  assert.deepEqual(resultado, {
    montoDetectado: 20000,
    candidatosMonto: [20000, 300000, 1235],
  });
});

test("TesseractOcrService conserva montos sin separador, decimales y referencias numericas", () => {
  const service = new TesseractOcrService();

  assert.equal(service.extractAmount("Monto: 57000").montoDetectado, 57000);
  assert.equal(service.extractAmount("$57.000").montoDetectado, 57000);
  assert.equal(service.extractAmount("Pago: 57,000").montoDetectado, 57000);
  assert.equal(service.extractAmount("COP 1.234,50").montoDetectado, 1235);
  assert.equal(service.extractReference("Referencia: 123456"), "123456");
});

test("TesseractOcrService conserva etiquetas y separadores de referencia", () => {
  const service = new TesseractOcrService();

  for (const [texto, referencia] of [
    ["Referencia: ABC123456", "ABC123456"],
    ["ref # ZX-98765", "ZX-98765"],
    ["Comprobante-12345", "12345"],
    ["Transacción : a1b2c3", "a1b2c3"],
    ["TRANSACCION 998877", "998877"],
  ]) {
    assert.equal(service.extractReference(texto), referencia, texto);
  }

  assert.equal(service.extractReference("Referencia: 1234"), null);
  assert.equal(service.extractReference("Texto sin referencia util"), null);
  assert.equal(
    service.extractReference(`Referencia:${"A".repeat(100_000)}`),
    "A".repeat(30),
  );
});

test("TesseractOcrService devuelve resultado vacio para texto vacio o invalido", () => {
  const service = new TesseractOcrService();
  const esperado = {
    montoDetectado: null,
    candidatosMonto: [],
  };

  assert.deepEqual(service.extractAmount(""), esperado);
  assert.deepEqual(
    service.extractAmount("Monto: desconocido\nCOP sin valor\n$ --"),
    esperado,
  );
  assert.deepEqual(
    service.extractAmount("Referencia ABC123456 sin información de pago"),
    esperado,
  );
});

test("TesseractOcrService limita la busqueda de montos en entradas largas", () => {
  const service = new TesseractOcrService();
  const inicio = performance.now();
  const resultado = service.extractAmount(
    `Monto:${" ".repeat(200_000)}X${"1.".repeat(100_000)}`,
  );

  assert.deepEqual(resultado, {
    montoDetectado: null,
    candidatosMonto: [],
  });
  assert.ok(performance.now() - inicio < 1_000);
});

test("TesseractOcrService deja PDF en revision manual sin ejecutar OCR", async () => {
  const resultado = await new TesseractOcrService().analyzePaymentReceipt(
    "comprobantes/recibo.pdf",
  );

  assert.equal(resultado.montoDetectado, null);
  assert.equal(resultado.requiereRevisionManual, true);
  assert.match(resultado.advertencias.join(" "), /PDF/);
});
