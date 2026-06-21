-- Si se elimina un rol, se eliminan los usuarios asociados a ese rol.
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_id_rol_fkey";
ALTER TABLE "usuarios"
ADD CONSTRAINT "usuarios_id_rol_fkey"
FOREIGN KEY ("id_rol") REFERENCES "roles"("id_rol")
ON DELETE CASCADE ON UPDATE CASCADE;
