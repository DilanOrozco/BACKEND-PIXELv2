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
        ? compact.replaceAll(".", "").replace(",", ".")
        : compact.replaceAll(",", "")
      : /^[0-9]{1,3}([.,][0-9]{3})+$/.test(compact)
        ? compact.replace(/[.,]/g, "")
        : compact.replace(",", ".");
  const value = Number(normalized.replace(/[^\d.]/g, ""));

  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
};

const unique = <T>(items: T[]) => [...new Set(items)];

const amountAtStartPattern = /^(\d[\d., \t]{2,30})/;
const paymentLabelPattern = /valor|monto|total|pagado|pago/gi;
const currencyWordPattern = /cop/gi;
const currencySymbolPattern = /\$/g;
const trailingCurrencyPattern = /(\d[\d., \t]{2,30})[ \t]+cop\b/gi;
const referenceLabelPattern = /referencia|ref|comprobante|transacci[oó]n/gi;

type IndexedAmountMatch = {
  index: number;
  end: number;
  priority: number;
  amount: string;
};

const skipHorizontalWhitespace = (text: string, start: number) => {
  let cursor = start;

  while (text[cursor] === " " || text[cursor] === "\t") {
    cursor += 1;
  }

  return cursor;
};

const extractAmountAt = (text: string, start: number) => {
  const match = amountAtStartPattern.exec(text.slice(start));

  return match
    ? {
        amount: match[1]!,
        end: start + match[0].length,
      }
    : null;
};

const skipOptionalSentWord = (text: string, start: number) => {
  const wordStart = skipHorizontalWhitespace(text, start);

  return wordStart > start &&
    text.slice(wordStart, wordStart + 7).toLowerCase() === "enviado"
    ? wordStart + 7
    : start;
};

const extractLabeledAmounts = (text: string) => {
  const amounts: string[] = [];

  for (const labelMatch of text.matchAll(paymentLabelPattern)) {
    let cursor = labelMatch.index + labelMatch[0].length;

    if (labelMatch[0].toLowerCase() === "valor") {
      cursor = skipOptionalSentWord(text, cursor);
    }

    cursor = skipHorizontalWhitespace(text, cursor);
    if (text[cursor] === ":") {
      cursor = skipHorizontalWhitespace(text, cursor + 1);
    }

    if (text.slice(cursor, cursor + 3).toLowerCase() === "cop") {
      cursor = skipHorizontalWhitespace(text, cursor + 3);
    }

    if (text[cursor] === "$") {
      cursor = skipHorizontalWhitespace(text, cursor + 1);
    }

    const amountMatch = extractAmountAt(text, cursor);
    if (amountMatch) {
      amounts.push(amountMatch.amount);
    }
  }

  return amounts;
};

const extractPrefixedCurrencyMatches = (
  text: string,
  markerPattern: RegExp,
  priority: number,
  allowCurrencySymbol: boolean,
) => {
  const matches: IndexedAmountMatch[] = [];

  for (const markerMatch of text.matchAll(markerPattern)) {
    let cursor = skipHorizontalWhitespace(
      text,
      markerMatch.index + markerMatch[0].length,
    );

    if (allowCurrencySymbol && text[cursor] === "$") {
      cursor = skipHorizontalWhitespace(text, cursor + 1);
    }

    const amountMatch = extractAmountAt(text, cursor);
    if (amountMatch) {
      matches.push({
        index: markerMatch.index,
        end: amountMatch.end,
        priority,
        amount: amountMatch.amount,
      });
    }
  }

  return matches;
};

const extractTrailingCurrencyMatches = (text: string) =>
  Array.from(text.matchAll(trailingCurrencyPattern), (match) => ({
    index: match.index,
    end: match.index + match[0].length,
    priority: 2,
    amount: match[1]!,
  }));

const extractCurrencyAmounts = (text: string) => {
  const matches = [
    ...extractPrefixedCurrencyMatches(text, currencyWordPattern, 0, true),
    ...extractPrefixedCurrencyMatches(text, currencySymbolPattern, 1, false),
    ...extractTrailingCurrencyMatches(text),
  ];

  matches.sort(
    (left, right) => left.index - right.index || left.priority - right.priority,
  );

  const amounts: string[] = [];
  let nextAvailableIndex = 0;

  for (const match of matches) {
    if (match.index < nextAvailableIndex) {
      continue;
    }

    amounts.push(match.amount);
    nextAvailableIndex = match.end;
  }

  return amounts;
};

const isReferenceCharacter = (character: string) => {
  const lower = character.toLowerCase();

  return (
    character === "-" ||
    (character >= "0" && character <= "9") ||
    (lower >= "a" && lower <= "z")
  );
};

const extractReferenceValue = (text: string, start: number) => {
  let cursor = skipHorizontalWhitespace(text, start);

  if ([":", "#", "-"].includes(text[cursor] ?? "")) {
    cursor = skipHorizontalWhitespace(text, cursor + 1);
  }

  const valueStart = cursor;
  while (
    cursor < text.length &&
    cursor - valueStart < 30 &&
    isReferenceCharacter(text[cursor]!)
  ) {
    cursor += 1;
  }

  const value = text.slice(valueStart, cursor);
  return value.length >= 5 ? value : null;
};

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

    for (const raw of [
      ...extractLabeledAmounts(text),
      ...extractCurrencyAmounts(text),
    ]) {
      const parsed = parseColombianAmount(raw.trim());

      if (parsed && parsed <= 1_000_000_000) {
        candidates.push(parsed);
      }
    }

    const candidatosMonto = unique(candidates);

    return {
      montoDetectado: candidatosMonto[0] ?? null,
      candidatosMonto,
    };
  }

  extractReference(text: string) {
    referenceLabelPattern.lastIndex = 0;
    const label = referenceLabelPattern.exec(text);

    return label
      ? extractReferenceValue(text, label.index + label[0].length)
      : null;
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
