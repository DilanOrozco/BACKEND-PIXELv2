import type { Request, RequestHandler, Response } from "express";
import { DeletionImpactService } from "../../applications/services/deletion-impact.service";
import type { DeletionImpactResource } from "../repositories/deletion-impact.repository";

const service = new DeletionImpactService();

export const crearControladorImpactoEliminacion = (
  resource: DeletionImpactResource,
): RequestHandler => {
  return async (req: Request, res: Response) => {
    try {
      const impacto = await service.obtener(resource, Number(req.params.id));
      return res.status(200).json({ data: impacto });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      return res.status(404).json({ message });
    }
  };
};
