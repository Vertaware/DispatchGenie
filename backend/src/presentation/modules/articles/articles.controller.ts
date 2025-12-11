import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { SearchArticlesQuery } from '../../../application/articles/articles.handlers';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../guards/subscription.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '~/enums/index';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Articles')
@Controller('articles')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@ApiBearerAuth('access-token')
export class ArticlesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'Search articles' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async search(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.queryBus.execute(
      new SearchArticlesQuery(user!.tenantId, search, page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined),
    );
  }
}

