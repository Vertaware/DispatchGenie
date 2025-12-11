import { IsEnum } from 'class-validator';
import { DocumentType } from '../../../../shared/enums/index';

export class CreateDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;
}
