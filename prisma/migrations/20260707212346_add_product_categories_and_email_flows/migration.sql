-- AlterTable
ALTER TABLE "productos_cotizables" ADD COLUMN     "id_categoria_producto" INTEGER;

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id_password_reset_token" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,
    "fecha_uso" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id_password_reset_token")
);

-- CreateTable
CREATE TABLE "categorias_producto" (
    "id_categoria_producto" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_producto_pkey" PRIMARY KEY ("id_categoria_producto")
);

-- CreateIndex
CREATE INDEX "password_reset_tokens_id_usuario_fecha_expiracion_idx" ON "password_reset_tokens"("id_usuario", "fecha_expiracion");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_producto_nombre_key" ON "categorias_producto"("nombre");

-- CreateIndex
CREATE INDEX "productos_cotizables_id_categoria_producto_idx" ON "productos_cotizables"("id_categoria_producto");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_cotizables" ADD CONSTRAINT "productos_cotizables_id_categoria_producto_fkey" FOREIGN KEY ("id_categoria_producto") REFERENCES "categorias_producto"("id_categoria_producto") ON DELETE SET NULL ON UPDATE CASCADE;
