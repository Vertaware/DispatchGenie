import { AggregateRoot } from '@nestjs/cqrs';

export abstract class BaseEntity<Props> extends AggregateRoot {
  protected constructor(protected readonly props: Props) {
    super();
  }

  toJSON(): Props {
    return this.props;
  }
}
