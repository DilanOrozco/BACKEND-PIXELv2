import {
  DeletionImpactRepository,
  type DeletionImpactResource,
} from "../../infrastructure/repositories/deletion-impact.repository";
import { buildDeletionImpact } from "../../utils/deletion-impact.util";

const repository = new DeletionImpactRepository();

const nombresRecursos: Record<DeletionImpactResource, string> = {
  usuario: "usuario",
  cliente: "cliente",
  cotizacion: "cotizacion",
  tecnica: "tecnica",
  producto: "producto",
  categoriaProducto: "categoria de producto",
  compra: "compra",
  tarifaTecnica: "tarifa tecnica",
  abono: "abono",
  diseno: "diseno",
  proveedor: "proveedor",
};

export class DeletionImpactService {
  async obtener(resource: DeletionImpactResource, id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("El ID indicado no es valido.");
    }

    const resultado = await repository.obtener(resource, id);

    if (!resultado.existe) {
      throw new Error(`No se encontro el ${nombresRecursos[resource]}.`);
    }

    return buildDeletionImpact(resultado.groups, resultado.options);
  }
}
