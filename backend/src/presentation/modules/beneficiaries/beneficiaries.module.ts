import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BeneficiariesController } from './beneficiaries.controller';
import { BeneficiaryHandlers } from '../../../application/beneficiaries/beneficiaries.handlers';

@Module({
  imports: [CqrsModule],
  controllers: [BeneficiariesController],
  providers: [...BeneficiaryHandlers],
})
export class BeneficiariesModule {}
