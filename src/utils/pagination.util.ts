export interface PaginationQuery {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
  sortBy?: unknown;
  order?: unknown;
  termino?: unknown;
}

export interface PaginationOptions {
  defaultSortBy: string;
  allowedSortBy: readonly string[];
  maxLimit?: number;
  defaultLimit?: number;
}

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
  search: string | null;
  sortBy: string;
  order: "asc" | "desc";
  isPaginated: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const parsePaginationQuery = (
  query: PaginationQuery = {},
  options: PaginationOptions,
): ParsedPagination => {
  const maxLimit = options.maxLimit ?? 100;
  const defaultLimit = options.defaultLimit ?? 10;
  const hasPaginationParams = [
    "page",
    "limit",
    "search",
    "sortBy",
    "order",
  ].some((key) => query[key as keyof PaginationQuery] !== undefined);

  const rawPage = Number(query.page ?? 1);
  const rawLimit = Number(query.limit ?? defaultLimit);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limitBase =
    Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit;
  const limit = Math.min(limitBase, maxLimit);
  const rawSearch = query.search ?? query.termino;
  const search =
    typeof rawSearch === "string" && rawSearch.trim() !== ""
      ? rawSearch.trim()
      : null;
  const rawSortBy =
    typeof query.sortBy === "string" ? query.sortBy : options.defaultSortBy;
  const sortBy = options.allowedSortBy.includes(rawSortBy)
    ? rawSortBy
    : options.defaultSortBy;
  const order = query.order === "asc" ? "asc" : "desc";

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    search,
    sortBy,
    order,
    isPaginated: hasPaginationParams,
  };
};

export const buildPaginationMeta = (
  pagination: Pick<ParsedPagination, "page" | "limit">,
  total: number,
): PaginationMeta => {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.limit);

  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPrevPage: pagination.page > 1 && totalPages > 0,
  };
};

export const paginatedResponse = <T>(
  data: T[],
  pagination: Pick<ParsedPagination, "page" | "limit">,
  total: number,
) => ({
  data,
  meta: buildPaginationMeta(pagination, total),
});

export const looksLikeEmail = (search: string) => search.includes("@");

export const looksNumeric = (search: string) => /^\d+$/.test(search);
