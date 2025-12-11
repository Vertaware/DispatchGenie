import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { VehiclesController } from './vehicles.controller';
import { VehicleHandlers } from '../../../application/vehicles/vehicles.handlers';
import { DocumentManager } from '../../../infrastructure/documents/document.manager';
import { LocalStorageService } from '../../../infrastructure/storage/local-storage.service';

@Module({
  imports: [CqrsModule],
  controllers: [VehiclesController],
  providers: [...VehicleHandlers, DocumentManager, LocalStorageService],
})
export class VehiclesModule {}
