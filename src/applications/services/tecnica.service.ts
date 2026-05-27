import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import {
  validarCrearTecnica,
  validarActualizarTecnica,
} from "../validators/tecnica.validator";

const tecnicaRepository = new TecnicaRepository();

export class TecnicaService {
  async crearTecnica(data: any) {
    const error = validarCrearTecnica(data);

    if (error) {
      throw new Error(error);
    }

    const nombreLimpio = data.nombre.trim();

    const tecnicaExistente =
      await tecnicaRepository.buscarPorNombreExacto(nombreLimpio);

    if (tecnicaExistente) {
      throw new Error(
        "El nombre de la técnica no puede repetirse en el sistema.",
      );
    }

    return await tecnicaRepository.crearTecnica({
      nombre: nombreLimpio,
      descripcion: data.descripcion?.trim(),
      estado: true,
    });
  }

  async listarTecnicas() {
    const tecnicas = await tecnicaRepository.listarTecnicas();

    if (tecnicas.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return tecnicas;
  }

  async buscarPorId(idTecnica: number) {
    if (isNaN(idTecnica) || idTecnica <= 0) {
      throw new Error("El ID de la técnica no es válido.");
    }

    const tecnica = await tecnicaRepository.buscarPorId(idTecnica);

    if (!tecnica) {
      throw new Error("No se encontraron resultados.");
    }

    return tecnica;
  }

  async buscarParcial(termino: string) {
    if (!termino || termino.trim() === "") {
      throw new Error("Debe ingresar un término de búsqueda.");
    }

    const tecnicas = await tecnicaRepository.buscarParcial(termino.trim());

    if (tecnicas.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return tecnicas;
  }

  async actualizarTecnica(idTecnica: number, data: any) {
    if (isNaN(idTecnica) || idTecnica <= 0) {
      throw new Error("El ID de la técnica no es válido.");
    }

    const error = validarActualizarTecnica(data);

    if (error) {
      throw new Error(error);
    }

    const tecnica = await tecnicaRepository.buscarPorId(idTecnica);

    if (!tecnica) {
      throw new Error("No se encontraron resultados.");
    }

    const dataActualizar: any = {};

    if (data.nombre !== undefined) {
      const nombreLimpio = data.nombre.trim();

      const tecnicaExistente =
        await tecnicaRepository.buscarPorNombreExacto(nombreLimpio);

      if (tecnicaExistente && tecnicaExistente.idTecnica !== idTecnica) {
        throw new Error(
          "El nombre de la técnica no puede repetirse en el sistema.",
        );
      }

      dataActualizar.nombre = nombreLimpio;
    }

    if (data.descripcion !== undefined) {
      dataActualizar.descripcion = data.descripcion.trim();
    }

    if (data.estado !== undefined) {
      dataActualizar.estado = data.estado;
    }

    return await tecnicaRepository.actualizarTecnica(idTecnica, dataActualizar);
  }

  async desactivarTecnica(idTecnica: number) {
    if (isNaN(idTecnica) || idTecnica <= 0) {
      throw new Error("El ID de la técnica no es válido.");
    }

    const tecnica = await tecnicaRepository.buscarPorId(idTecnica);

    if (!tecnica) {
      throw new Error("No se encontraron resultados.");
    }

    return await tecnicaRepository.desactivarTecnica(idTecnica);
  }

  async eliminarTecnica(idTecnica: number) {
    if (isNaN(idTecnica) || idTecnica <= 0) {
      throw new Error("El ID de la tecnica no es valido.");
    }

    const tecnica = await tecnicaRepository.buscarPorId(idTecnica);

    if (!tecnica) {
      throw new Error("No se encontraron resultados.");
    }

    return await tecnicaRepository.eliminarTecnica(idTecnica);
  }
}
