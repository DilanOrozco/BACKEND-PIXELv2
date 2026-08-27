import type { NextFunction, Response } from "express";
import multer from "multer";
import type { AuthRequest } from "./auth.middleware";

const maxSizeMb = Number(process.env.MAX_PAYMENT_RECEIPT_SIZE_MB ?? 10);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:
      (Number.isFinite(maxSizeMb) && maxSizeMb > 0 ? maxSizeMb : 10) *
      1024 *
      1024,
    files: 1,
  },
});

export const uploadPaymentReceipt = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  upload.single("archivo")(req, res, (error: unknown) => {
    if (!error) {
      return next();
    }

    const message =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "El comprobante supera el tamano maximo permitido."
        : "No fue posible procesar el archivo adjunto.";

    return res.status(400).json({ message });
  });
};
