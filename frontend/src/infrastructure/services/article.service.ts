import type { Article, ArticleSearchParams } from "~/domain/entities/article";
import type { PaginatedResult } from "~/domain/entities/pagination";
import api from "../configs/axios.config";

export async function searchArticles(params: ArticleSearchParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.search) {
    searchParams.append("search", params.search);
  }
  if (params.page) {
    searchParams.append("page", params.page.toString());
  }
  if (params.pageSize) {
    searchParams.append("pageSize", params.pageSize.toString());
  }

  const response = await api.get<PaginatedResult<Article>>(`/articles?${searchParams.toString()}`);
  return response.data;
}
