import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ArticlesController } from './articles.controller';
import { ArticleHandlers } from '../../../application/articles/articles.handlers';

@Module({
  imports: [CqrsModule],
  controllers: [ArticlesController],
  providers: [...ArticleHandlers],
})
export class ArticlesModule {}

