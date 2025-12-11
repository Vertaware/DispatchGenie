import { IsEnum } from 'class-validator';
import { DocumentType } from '~/enums/index';

export class CreateDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;
}
