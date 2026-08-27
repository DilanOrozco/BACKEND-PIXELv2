import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";

export type PaymentReceiptOcrResult = {
  textoCompleto: string;
  montoDetectado: number | null;
  referenciaDetectada: string | null;
  fechaDetectada: Date | null;
  bancoDetectado: string | null;
  confianza: number | null;
  candidatosMonto: number[];
  requiereRevisionManual: boolean;
  advertencias: string[];
};

export interface OcrService {
  analyzePaymentReceipt(filePath: string): Promise<PaymentReceiptOcrResult>;
  extractAmount(text: string): {
    montoDetectado: number | null;
    candidatosMonto: number[];
  };
  extractReference(text: string): string | null;
  extractDate(text: string): Date | null;
  detectBankOrPlatform(text: string): string | null;
}

const parseColombianAmount = (raw: string) => {
  const compact = raw.replace(/\s/g, "");
  const normalized =
    compact.includes(".") && compact.includes(",")
      ? compact.lastIndexOf(",") > compact.lastIndexOf(".")
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "")
      : /^[0-9]{1,3}([.,][0-9]{3})+$/.test(compact)
        ? compact.replace(/[.,]/g, "")
        : compact.replace(",", ".");
  const value = Number(normalized.replace(/[^\d.]/g, ""));

  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
};

const unique = <T>(items: T[]) => [...new Set(items)];

export class TesseractOcrService implements OcrService {
  private static workerPromise: Promise<Worker> | null = null;
  private static queue: Promise<unknown> = Promise.resolve();

  private async getWorker() {
    if (!TesseractOcrService.workerPromise) {
      TesseractOcrService.workerPromise = createWorker(
        process.env.TESSERACT_LANG ?? "spa",
      );
    }

    return await TesseractOcrService.workerPromise;
  }

  extractAmount(text: string) {
    const candidates: number[] = [];
    const prioritized =
      /(?:valor(?:\s+enviado)?|monto|total|pagado|pago)\s*:?\s*(?:cop\s*)?\$?\s*([0-9][0-9.,\s]{2,})/gi;
    const currency =
      /(?:cop\s*\$?\s*|\$\s*)([0-9][0-9.,\s]{2,})|([0-9][0-9.,\s]{2,})\s*cop/gi;

    for (const pattern of [prioritized, currency]) {
      for (const match of text.matchAll(pattern)) {
        const raw = match[1] ?? match[2];
        const parsed = raw ? parseColombianAmount(raw.trim()) : null;

        if (parsed && parsed <= 1_000_000_000) {
          candidates.push(parsed);
        }
      }
    }

    const candidatosMonto = unique(candidates);

    return {
      montoDetectado: candidatosMonto[0] ?? null,
      candidatosMonto,
    };
  }

  extractReference(text: string) {
    const match = text.match(
      /(?:referencia|ref(?:erencia)?|comprobante|transacci[oó]n)\s*[:#-]?\s*([a-z0-9-]{5,30})/i,
    );
    return match?.[1] ?? null;
  }

  extractDate(text: string) {
    const match = text.match(
      /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/,
    );

    if (!match) {
      return null;
    }

    const year = Number(match[3]) < 100
      ? 2000 + Number(match[3])
      : Number(match[3]);
    const date = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[1])));

    return Number.isNaN(date.getTime()) ? null : date;
  }

  detectBankOrPlatform(text: string) {
    const normalized = text.toLowerCase();
    const banks = [
      ["Nequi", "nequi"],
      ["Bancolombia", "bancolombia"],
      ["Daviplata", "daviplata"],
      ["Davivienda", "davivienda"],
      ["Banco de Bogota", "banco de bogot"],
      ["BBVA", "bbva"],
      ["Transfiya", "transfiya"],
    ] as const;

    return banks.find(([, token]) => normalized.includes(token))?.[0] ?? null;
  }

  async analyzePaymentReceipt(filePath: string) {
    if (path.extname(filePath).toLowerCase() === ".pdf") {
      return {
        textoCompleto: "",
        montoDetectado: null,
        referenciaDetectada: null,
        fechaDetectada: null,
        bancoDetectado: null,
        confianza: null,
        candidatosMonto: [],
        requiereRevisionManual: true,
        advertencias: ["El OCR de PDF requiere revision manual."],
      };
    }

    const task = async () => {
      const worker = await this.getWorker();
      const result = await worker.recognize(filePath);
      const text = result.data.text ?? "";
      const amount = this.extractAmount(text);
      const confianza = Number.isFinite(result.data.confidence)
        ? Math.round(result.data.confidence * 100) / 100
        : null;
      const advertencias: string[] = [];

      if (amount.candidatosMonto.length > 1) {
        advertencias.push("Se detectaron varios montos posibles.");
      }

      if (!amount.montoDetectado) {
        advertencias.push("No se detecto un monto confiable.");
      }

      if (confianza !== null && confianza < 60) {
        advertencias.push("La confianza del OCR es baja.");
      }

      return {
        textoCompleto: text,
        montoDetectado: amount.montoDetectado,
        referenciaDetectada: this.extractReference(text),
        fechaDetectada: this.extractDate(text),
        bancoDetectado: this.detectBankOrPlatform(text),
        confianza,
        candidatosMonto: amount.candidatosMonto,
        requiereRevisionManual:
          !amount.montoDetectado ||
          amount.candidatosMonto.length > 1 ||
          confianza === null ||
          confianza < 60,
        advertencias,
      };
    };

    const result = TesseractOcrService.queue.then(task, task);
    TesseractOcrService.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return await result;
  }
}
