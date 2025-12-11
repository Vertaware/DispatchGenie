import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { VehiclesController } from './vehicles.controller';
import { VehicleHandlers } from '../../../application/vehicles/vehicles.handlers';
import { DocumentManager } from '../../../infrastructure/documents/document.manager';

@Module({
  imports: [CqrsModule],
  controllers: [VehiclesController],
  providers: [...VehicleHandlers, DocumentManager],
})
export class VehiclesModule {}
