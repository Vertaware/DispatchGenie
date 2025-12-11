import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PaginatedResult } from '../../shared/enums/index';

export interface ArticleDto {
  id: string;
  tenantId: string;
  description: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export class SearchArticlesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly search?: string,
    public readonly page?: number,
    public readonly pageSize?: number,
  ) {}
}

@QueryHandler(SearchArticlesQuery)
export class SearchArticlesHandler
  implements IQueryHandler<SearchArticlesQuery, PaginatedResult<ArticleDto>>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: SearchArticlesQuery): Promise<PaginatedResult<ArticleDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    
    const where: any = {
      tenantId: query.tenantId,
    };

    if (query.search && query.search.trim().length > 0) {
      where.description = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const [totalCount, articles] = await this.prisma.$transaction([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { description: 'asc' },
      }),
    ]);

    return {
      data: articles.map((article) => ({
        id: article.id,
        tenantId: article.tenantId,
        description: article.description,
        quantity: article.quantity,
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(),
      })),
      page,
      pageSize,
      totalCount,
    };
  }
}

export const ArticleHandlers = [SearchArticlesHandler];

