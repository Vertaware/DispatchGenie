import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType } from '~/enums/index';
import { PrismaService } from '../prisma/prisma.service';

export interface DocumentFilePayload {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

@Injectable()
export class DocumentManager {
  constructor(private readonly prisma: PrismaService) {}

  async createDocument(
    tenantId: string,
    type: DocumentType,
    file: DocumentFilePayload,
  ) {
    return this.prisma.document.create({
      data: {
        tenantId,
        type,
        fileName: file.originalName,
        mimeType: file.mimeType,
        fileData: new Uint8Array(file.buffer),
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
  }

  async getDocumentFile(tenantId: string, documentId: string): Promise<Buffer> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
      select: { fileData: true },
    });
    if (!document || !document.fileData) {
      throw new NotFoundException('Document file not found');
    }
    return Buffer.from(document.fileData);
  }
}
