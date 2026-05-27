import { RolRepository } from "../../infrastructure/repositories/rol.repository";
import {
  validarCrearRol,
  validarActualizarRol,
} from "../validators/rol.validator";

const rolRepository = new RolRepository();

export class RolService {
  async crearRol(nombre: string, descripcion?: string) {
    const error = validarCrearRol(nombre, descripcion);

    if (error) {
      throw new Error(error);
    }

    const rolExistente = await rolRepository.buscarPorNombreExacto(
      nombre.trim(),
    );

    if (rolExistente) {
      throw new Error("El nombre del rol no puede repetirse en el sistema.");
    }

    return await rolRepository.crearRol(nombre.trim(), descripcion?.trim());
  }

  async listarRoles() {
    const roles = await rolRepository.listarRoles();

    if (roles.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return roles;
  }

  async buscarPorNombre(nombre: string) {
    const roles = await rolRepository.buscarPorNombreParcial(nombre);

    if (roles.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return roles;
  }

  async actualizarRol(
    idRol: number,
    data: { nombre?: string; descripcion?: string; estado?: boolean },
  ) {
    if (isNaN(idRol) || idRol <= 0) {
      throw new Error("El ID del rol no es válido.");
    }

    const error = validarActualizarRol(
      data.nombre,
      data.descripcion,
      data.estado,
    );

    if (error) {
      throw new Error(error);
    }

    const rol = await rolRepository.buscarPorId(idRol);

    if (!rol) {
      throw new Error("No se encontraron resultados.");
    }

    if (data.nombre) {
      const rolExistente = await rolRepository.buscarPorNombreExacto(
        data.nombre.trim(),
      );

      if (rolExistente && rolExistente.idRol !== idRol) {
        throw new Error("El nombre del rol no puede repetirse en el sistema.");
      }

      data.nombre = data.nombre.trim();
    }

    if (data.descripcion) {
      data.descripcion = data.descripcion.trim();
    }

    return await rolRepository.actualizarRol(idRol, data);
  }

  async desactivarRol(idRol: number) {
    const rol = await rolRepository.buscarPorId(idRol);

    if (!rol) {
      throw new Error("No se encontraron resultados.");
    }

    return await rolRepository.desactivarRol(idRol);
  }

  async eliminarRol(idRol: number) {
    if (isNaN(idRol) || idRol <= 0) {
      throw new Error("El ID del rol no es valido.");
    }

    const rol = await rolRepository.buscarPorId(idRol);

    if (!rol) {
      throw new Error("No se encontraron resultados.");
    }

    const usuariosAsociados = await rolRepository.contarUsuariosAsociados(idRol);

    if (usuariosAsociados > 0) {
      throw new Error(
        "No se puede eliminar el rol porque tiene usuarios asociados. Desactivalo en su lugar.",
      );
    }

    return await rolRepository.eliminarRol(idRol);
  }
}
