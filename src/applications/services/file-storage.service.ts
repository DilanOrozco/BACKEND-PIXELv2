import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export type StoredFile = {
  relativePath: string;
  originalName: string;
  safeName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

type StorageContext = {
  idCliente: number;
  idPedido: number;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

const parseMaxSizeMb = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const detectMimeType = (buffer: Buffer) => {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }

  if (buffer.length >= 5 && buffer.subarray(0, 5).toString() === "%PDF-") {
    return "application/pdf";
  }

  return null;
};

export class FileStorageService {
  private readonly rootPath = path.resolve(
    process.cwd(),
    process.env.UPLOADS_ROOT_PATH ?? "./uploads",
  );

  buildSafeFileName(prefix: string, mimeType: string) {
    const extension = EXTENSION_BY_MIME[mimeType];

    if (!extension) {
      throw new Error("Tipo de archivo no permitido.");
    }

    return `${prefix}-${Date.now()}-${crypto.randomBytes(12).toString("hex")}${extension}`;
  }

  async ensureDirectory(relativeDirectory: string) {
    const absoluteDirectory = this.resolveSafePath(relativeDirectory);
    await mkdir(absoluteDirectory, { recursive: true });
    return absoluteDirectory;
  }

  private validateFile(file: UploadFile, maxSizeMb: number) {
    if (!file?.buffer?.length || file.size <= 0) {
      throw new Error("El archivo esta vacio.");
    }

    const maxBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxBytes) {
      throw new Error(`El archivo supera el limite de ${maxSizeMb} MB.`);
    }

    const detectedMime = detectMimeType(file.buffer);
    const originalExtension = path.extname(file.originalname).toLowerCase();
    const expectedMime = MIME_BY_EXTENSION[originalExtension];

    if (
      !detectedMime ||
      !expectedMime ||
      expectedMime !== detectedMime ||
      (file.mimetype && file.mimetype !== detectedMime)
    ) {
      throw new Error(
        "El archivo no coincide con un formato permitido (JPG, PNG o PDF).",
      );
    }

    return detectedMime;
  }

  private async saveFile(
    file: UploadFile,
    context: StorageContext,
    folder: string,
    prefix: string,
    maxSizeMb: number,
  ): Promise<StoredFile> {
    const mimeType = this.validateFile(file, maxSizeMb);
    const relativeDirectory = path.posix.join(
      folder,
      `cliente-${context.idCliente}`,
      `pedido-${context.idPedido}`,
    );
    const safeName = this.buildSafeFileName(prefix, mimeType);
    const relativePath = path.posix.join(relativeDirectory, safeName);
    const absoluteDirectory = await this.ensureDirectory(relativeDirectory);
    const absolutePath = path.join(absoluteDirectory, safeName);

    await writeFile(absolutePath, file.buffer, { flag: "wx" });

    return {
      relativePath,
      originalName: path.basename(file.originalname),
      safeName,
      mimeType,
      sizeBytes: file.size,
      sha256: crypto.createHash("sha256").update(file.buffer).digest("hex"),
    };
  }

  async savePaymentReceipt(file: UploadFile, context: StorageContext) {
    return await this.saveFile(
      file,
      context,
      process.env.PAYMENT_RECEIPTS_FOLDER ?? "comprobantes",
      "abono",
      parseMaxSizeMb(process.env.MAX_PAYMENT_RECEIPT_SIZE_MB, 10),
    );
  }

  async saveDesignFile(file: UploadFile, context: StorageContext) {
    return await this.saveFile(
      file,
      context,
      process.env.DESIGN_FILES_FOLDER ?? "disenos",
      "diseno",
      parseMaxSizeMb(process.env.MAX_DESIGN_FILE_SIZE_MB, 15),
    );
  }

  resolveSafePath(relativePath: string) {
    if (!relativePath || path.isAbsolute(relativePath)) {
      throw new Error("Ruta de archivo no valida.");
    }

    const absolutePath = path.resolve(this.rootPath, relativePath);
    const relativeToRoot = path.relative(this.rootPath, absolutePath);

    if (
      relativeToRoot.startsWith("..") ||
      path.isAbsolute(relativeToRoot)
    ) {
      throw new Error("Ruta de archivo no valida.");
    }

    return absolutePath;
  }

  getFileStream(relativePath: string) {
    return createReadStream(this.resolveSafePath(relativePath));
  }

  async getFileMetadata(relativePath: string) {
    const absolutePath = this.resolveSafePath(relativePath);
    const metadata = await stat(absolutePath);
    return {
      absolutePath,
      sizeBytes: metadata.size,
    };
  }

  async deleteFile(relativePath: string) {
    try {
      await unlink(this.resolveSafePath(relativePath));
      return true;
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }
}
