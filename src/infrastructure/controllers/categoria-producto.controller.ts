import type { Request, Response } from "express";
import { CategoriaProductoService } from "../../applications/services/categoria-producto.service";

const categoriaProductoService = new CategoriaProductoService();

const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : "Error inesperado.";

export class CategoriaProductoController {
  async listarCategorias(req: Request, res: Response) {
    try {
      const categorias = await categoriaProductoService.listarCategorias(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json(categorias);
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const categoria = await categoriaProductoService.buscarPorId(
        Number(req.params.id),
      );

      return res.status(200).json({
        data: categoria,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async crearCategoria(req: Request, res: Response) {
    try {
      const categoria = await categoriaProductoService.crearCategoria(req.body);

      return res.status(201).json({
        message: "Categoria creada correctamente.",
        data: categoria,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async actualizarCategoria(req: Request, res: Response) {
    try {
      const categoria = await categoriaProductoService.actualizarCategoria(
        Number(req.params.id),
        req.body,
      );

      return res.status(200).json({
        message: "Categoria actualizada correctamente.",
        data: categoria,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async desactivarCategoria(req: Request, res: Response) {
    try {
      const categoria = await categoriaProductoService.desactivarCategoria(
        Number(req.params.id),
      );

      return res.status(200).json({
        message: "Categoria desactivada correctamente.",
        data: categoria,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async eliminarCategoria(req: Request, res: Response) {
    try {
      const categoria = await categoriaProductoService.eliminarCategoria(
        Number(req.params.id),
      );

      return res.status(200).json({
        message: "Categoria eliminada correctamente.",
        data: categoria,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }
}
