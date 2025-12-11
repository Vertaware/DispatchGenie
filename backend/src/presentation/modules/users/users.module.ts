import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UsersController } from './users.controller';
import { UserHandlers } from '../../../application/users/user.handlers';

@Module({
  imports: [CqrsModule],
  controllers: [UsersController],
  providers: [...UserHandlers],
})
export class UsersModule {}
