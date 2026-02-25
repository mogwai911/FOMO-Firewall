export interface PaginationResult<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
}

export function paginateItems<T>(
  input: T[],
  page: number,
  pageSize: number
): PaginationResult<T> {
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  const totalItems = input.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const normalizedPage = Math.min(totalPages, Math.max(1, Math.floor(page)));
  const start = (normalizedPage - 1) * normalizedPageSize;
  const items = input.slice(start, start + normalizedPageSize);

  return {
    items,
    currentPage: normalizedPage,
    totalPages,
    pageSize: normalizedPageSize,
    totalItems
  };
}
