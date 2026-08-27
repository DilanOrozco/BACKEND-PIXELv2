import { RolRepository } from "../../infrastructure/repositories/rol.repository";
import { PermisoRepository } from "../../infrastructure/repositories/permiso.repository";
import { PERMISOS_SISTEMA, PERMISOS_VALIDOS } from "../../utils/permisos";

const permisoRepository = new PermisoRepository();
const rolRepository = new RolRepository();

const PERMISOS_ROL_CLIENTE = [
  "dashboard.cliente",
  "cotizaciones.cliente.ver",
  "cotizaciones.crear_cliente",
  "cotizaciones.editar_cliente",
  "cotizaciones.cliente.responder",
  "pedidos.cliente.ver",
  "abonos.cliente.ver",
  "abonos.cliente.crear",
  "disenos.cliente.ver",
  "disenos.cliente.aprobar",
  "disenos.cliente.rechazar",
  "perfil.ver",
  "perfil.editar",
];

const validarIdRol = (idRol: number) => {
  if (!Number.isInteger(idRol) || idRol <= 0) {
    throw new Error("El ID del rol no es valido.");
  }
};

const normalizarCodigos = (codigos: unknown) => {
  if (!Array.isArray(codigos)) {
    throw new Error("Los permisos deben enviarse como un arreglo.");
  }

  return [...new Set(codigos.map((codigo) => String(codigo).trim()))].filter(
    Boolean,
  );
};

export class PermisoService {
  async asegurarRolCliente() {
    const rolExistente = await rolRepository.buscarPorNombreExacto("Cliente");

    if (rolExistente) {
      if (rolExistente.estado) {
        return rolExistente;
      }

      return await rolRepository.actualizarRol(rolExistente.idRol, {
        descripcion:
          rolExistente.descripcion ??
          "Cliente externo con acceso a su propio dashboard",
        estado: true,
      });
    }

    return await rolRepository.crearRol(
      "Cliente",
      "Cliente externo con acceso a su propio dashboard",
    );
  }

  async sincronizarPermisosSistema() {
    const permisos = await permisoRepository.sincronizarPermisosSistema();
    await rolRepository.asegurarRolConPermisos(
      "Cliente",
      "Cliente externo con acceso a su propio dashboard",
      PERMISOS_ROL_CLIENTE,
    );

    return permisos;
  }

  async listarPermisos() {
    const permisosDb = await permisoRepository.listarPermisos();

    if (permisosDb.length > 0) {
      return permisosDb;
    }

    return PERMISOS_SISTEMA;
  }

  async listarPermisosPorRol(idRol: number) {
    validarIdRol(idRol);

    const rol = await rolRepository.buscarPorId(idRol);

    if (!rol) {
      throw new Error("El rol no existe.");
    }

    const permisos = await permisoRepository.listarPermisosPorRol(idRol);

    return permisos.map((item) => item.permiso);
  }

  async listarCodigosPorRol(idRol: number) {
    validarIdRol(idRol);

    return await permisoRepository.listarCodigosPorRol(idRol);
  }

  async rolTienePermiso(idRol: number, codigo: string) {
    validarIdRol(idRol);

    if (!PERMISOS_VALIDOS.has(codigo)) {
      return false;
    }

    return await permisoRepository.rolTienePermiso(idRol, codigo);
  }

  async asignarPermisosARol(idRol: number, codigosEntrada: unknown) {
    validarIdRol(idRol);

    const rol = await rolRepository.buscarPorId(idRol);

    if (!rol) {
      throw new Error("El rol no existe.");
    }

    const codigos = normalizarCodigos(codigosEntrada);
    const permisosExistentes =
      await permisoRepository.listarPermisosActivosPorCodigos(codigos);
    const codigosExistentes = new Set(
      permisosExistentes.map((permiso) => permiso.codigo),
    );
    const codigosInvalidos = codigos.filter(
      (codigo) => !codigosExistentes.has(codigo),
    );

    if (codigosInvalidos.length > 0) {
      throw new Error(
        "Algunos permisos no existen en el catálogo. Sincroniza permisos primero.",
      );
    }

    return await permisoRepository.reemplazarPermisosARol(
      idRol,
      permisosExistentes,
    );
  }
}
