export const aNumero = (valor: unknown) => Number(valor ?? 0);

export const redondearMoneda = (valor: number) => Math.round(valor * 100) / 100;

export const esEnteroPositivo = (valor: unknown) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0;
};

export const esMontoValido = (valor: unknown) => {
  if (valor === undefined || valor === null || valor === "") {
    return false;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0;
};
