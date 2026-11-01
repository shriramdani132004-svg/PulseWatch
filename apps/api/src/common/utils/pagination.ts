export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginationResult {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function pagination(page = 1, pageSize = 20, total = 0): PaginationResult {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export function skipTake(page = 1, pageSize = 20): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
