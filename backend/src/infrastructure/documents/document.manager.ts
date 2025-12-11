import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType } from '../../shared/enums/index';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';

export interface DocumentFilePayload {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

@Injectable()
export class DocumentManager {
  constructor(
    private readonly storage: LocalStorageService,
    private readonly prisma: PrismaService,
  ) {}

  async createDocument(
    tenantId: string,
    type: DocumentType,
    file: DocumentFilePayload,
  ) {
    const storagePath = await this.storage.saveFile({
      buffer: file.buffer,
      fileName: `${Date.now()}-${file.originalName}`,
      mimeType: file.mimeType,
      tenantId,
    });
    return this.prisma.document.create({
      data: {
        tenantId,
        type,
        fileName: file.originalName,
        mimeType: file.mimeType,
        storagePath,
      },
    });
  }

  async deleteDocument(tenantId: string, documentId: string): Promise<void> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.document.delete({ where: { id: document.id } });
    await this.storage.deleteFile(document.storagePath);
  }
}
