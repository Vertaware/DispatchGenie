import { BaseEntity } from '../common/base.entity';

export interface ArticleProps {
  id: string;
  tenantId: string;
  description: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Article extends BaseEntity<ArticleProps> {
  static create(props: ArticleProps): Article {
    return new Article(props);
  }

  get description(): string {
    return this.props.description;
  }

  get quantity(): number {
    return this.props.quantity;
  }
}

