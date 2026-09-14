-- CreateTable
CREATE TABLE "tecnicas" (
    "id_tecnica" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(255),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tecnicas_pkey" PRIMARY KEY ("id_tecnica")
);

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id_cotizacion" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "creado_por_id" INTEGER NOT NULL,
    "tipo_cotizacion" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "costo_diseno" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "costos_adicionales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "observaciones" VARCHAR(255),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id_cotizacion")
);

-- CreateTable
CREATE TABLE "detalle_cotizacion" (
    "id_detalle_cotizacion" SERIAL NOT NULL,
    "id_cotizacion" INTEGER NOT NULL,
    "id_tecnica" INTEGER NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "costo_diseno" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "observaciones" VARCHAR(255),

    CONSTRAINT "detalle_cotizacion_pkey" PRIMARY KEY ("id_detalle_cotizacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "tecnicas_nombre_key" ON "tecnicas"("nombre");

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_cotizacion" ADD CONSTRAINT "detalle_cotizacion_id_cotizacion_fkey" FOREIGN KEY ("id_cotizacion") REFERENCES "cotizaciones"("id_cotizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_cotizacion" ADD CONSTRAINT "detalle_cotizacion_id_tecnica_fkey" FOREIGN KEY ("id_tecnica") REFERENCES "tecnicas"("id_tecnica") ON DELETE RESTRICT ON UPDATE CASCADE;
