import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { GateController } from './gate.controller';
import { GateHandlers } from '../../../application/gate/gate.handlers';

@Module({
  imports: [CqrsModule],
  controllers: [GateController],
  providers: [...GateHandlers],
})
export class GateModule {}

