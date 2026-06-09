export const DEFAULT_LIST_PAGE_SIZE = 10;
export const MAX_LIST_PAGE_SIZE = 50;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ListPageParams = {
  page: number;
  pageSize: number;
};

export function parseListPageParams(
  rawPage: string | undefined,
  rawPageSize: string | undefined,
  defaultPageSize = DEFAULT_LIST_PAGE_SIZE,
): ListPageParams {
  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const parsedPageSize = Number.parseInt(rawPageSize ?? String(defaultPageSize), 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const pageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize >= 1
      ? Math.min(parsedPageSize, MAX_LIST_PAGE_SIZE)
      : defaultPageSize;
  return { page, pageSize };
}

export function listPageOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
