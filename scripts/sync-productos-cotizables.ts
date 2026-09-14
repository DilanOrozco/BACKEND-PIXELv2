import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: `${process.env.DATABASE_URL}` });
const prisma = new PrismaClient({ adapter });

const productos = [
  {
    nombre: "Camiseta 100% algodón estampada adelante tamaño carta",
    nombreAnterior: "Camiseta 100% algodon estampada adelante tamano carta",
    precioBase: 28000,
  },
  {
    nombre: "Camiseta estampada tamaño carta atrás y adelante",
    nombreAnterior: "Camiseta estampada tamano carta atras y adelante",
    precioBase: 38000,
  },
  {
    nombre: "Estampada adelante carta y atrás tabloide",
    nombreAnterior: "Estampada adelante carta y atras tabloide",
    precioBase: 43000,
  },
  {
    nombre: "Camiseta estampada adelante punto corazón y atrás carta",
    nombreAnterior: "Camiseta estampada adelante punto corazon y atras carta",
    precioBase: 32000,
  },
  {
    nombre: "Camiseta estampada atrás tabloide y adelante punto corazón",
    nombreAnterior: "Camiseta estampada atras tabloide y adelante punto corazon",
    precioBase: 38000,
  },
  {
    nombre: "Gorras acrílicas estampadas",
    nombreAnterior: "Gorras acrilicas estampadas",
    precioBase: 13000,
  },
  {
    nombre: "Polo estampada punto corazón",
    nombreAnterior: "Polo estampada punto corazon",
    precioBase: 35000,
  },
  {
    nombre: "Polo estampada adelante punto corazón y atrás carta",
    nombreAnterior: "Polo estampada adelante punto corazon y atras carta",
    precioBase: 45000,
  },
  {
    nombre: "Polo estampada atrás tabloide y adelante punto corazón",
    nombreAnterior: "Polo estampada atras tabloide y adelante punto corazon",
    precioBase: 50000,
  },
  {
    nombre: "Logos adicionales pequeños como para las mangas",
    nombreAnterior: "Logos adicionales pequenos como para las mangas",
    precioBase: 3500,
  },
] as const;

const rangos = [
  [1, 0],
  [12, 7.14],
  [24, 17.86],
  [50, 21.43],
  [100, 28.57],
] as const;

try {
  const categoriaGeneral = await prisma.categoriaProducto.upsert({
    where: { nombre: "General" },
    update: {
      estado: true,
    },
    create: {
      nombre: "General",
      descripcion: "Categoria general para productos cotizables existentes.",
      estado: true,
    },
  });

  await prisma.productoCotizable.updateMany({
    where: {
      idCategoriaProducto: null,
    },
    data: {
      idCategoriaProducto: categoriaGeneral.idCategoriaProducto,
    },
  });

  for (const productoSeed of productos) {
    const productoExistente = await prisma.productoCotizable.findFirst({
      where: {
        OR: [
          { nombre: productoSeed.nombre },
          { nombre: productoSeed.nombreAnterior },
        ],
      },
    });
    const producto = productoExistente
      ? await prisma.productoCotizable.update({
        where: { idProducto: productoExistente.idProducto },
        data: {
          nombre: productoSeed.nombre,
          precioBase: productoSeed.precioBase,
          idCategoriaProducto: categoriaGeneral.idCategoriaProducto,
          estado: true,
        },
      })
      : await prisma.productoCotizable.create({
        data: {
          nombre: productoSeed.nombre,
          precioBase: productoSeed.precioBase,
          idCategoriaProducto: categoriaGeneral.idCategoriaProducto,
          estado: true,
        },
      });

    for (const [cantidadMin, descuentoPorcentaje] of rangos) {
      await prisma.precioProductoRango.upsert({
        where: {
          idProducto_cantidadMin: {
            idProducto: producto.idProducto,
            cantidadMin,
          },
        },
        update: {
          descuentoPorcentaje,
          estado: true,
        },
        create: {
          idProducto: producto.idProducto,
          cantidadMin,
          descuentoPorcentaje,
          estado: true,
        },
      });
    }
  }

  console.log("Productos cotizables sincronizados correctamente.");
} finally {
  await prisma.$disconnect();
}
