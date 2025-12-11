import { BaseEntity } from '../common/base.entity';
import { DocumentType } from '~/enums/index';

export interface DocumentProps {
  id: string;
  tenantId: string;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  storagePath?: string; // Deprecated: kept for backward compatibility
  createdAt: Date;
  updatedAt: Date;
}

export class Document extends BaseEntity<DocumentProps> {
  static create(props: DocumentProps): Document {
    return new Document(props);
  }
}
