export interface Article {
  id: string;
  tenantId: string;
  description: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleSearchParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

