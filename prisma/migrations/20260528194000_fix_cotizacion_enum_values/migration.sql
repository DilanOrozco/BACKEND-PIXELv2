/*
  Fix the quotation enum values without resetting data.

  The previous applied database state used APROVADA/RECHAZADA.
  The API and domain language use APROBADA/ANULADA.
*/

ALTER TYPE "EstadoCotizacion" RENAME VALUE 'APROVADA' TO 'APROBADA';
ALTER TYPE "EstadoCotizacion" RENAME VALUE 'RECHAZADA' TO 'ANULADA';
