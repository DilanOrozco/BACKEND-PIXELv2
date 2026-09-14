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

test("TesseractOcrService deja PDF en revision manual sin ejecutar OCR", async () => {
  const resultado = await new TesseractOcrService().analyzePaymentReceipt(
    "comprobantes/recibo.pdf",
  );

  assert.equal(resultado.montoDetectado, null);
  assert.equal(resultado.requiereRevisionManual, true);
  assert.match(resultado.advertencias.join(" "), /PDF/);
});
