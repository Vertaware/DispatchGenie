import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DocumentDto, DocumentType } from '~/enums/index';
import { DocumentManager, DocumentFilePayload } from '../../infrastructure/documents/document.manager';

export class CreateDocumentCommand {
  constructor(
    public readonly tenantId: string,
    public readonly type: DocumentType,
    public readonly file: DocumentFilePayload,
  ) {}
}

export class GetDocumentQuery {
  constructor(public readonly tenantId: string, public readonly id: string) {}
}

export class DeleteDocumentCommand {
  constructor(public readonly tenantId: string, public readonly id: string) {}
}

@CommandHandler(CreateDocumentCommand)
export class CreateDocumentHandler
  implements ICommandHandler<CreateDocumentCommand, DocumentDto>
{
  constructor(private readonly documentManager: DocumentManager) {}

  async execute(command: CreateDocumentCommand): Promise<DocumentDto> {
    const document = await this.documentManager.createDocument(
      command.tenantId,
      command.type,
      command.file,
    );
    return this.map(document);
  }

  private map(document: any): DocumentDto {
    return {
      id: document.id,
      tenantId: document.tenantId,
      type: document.type as DocumentType,
      fileName: document.fileName,
      mimeType: document.mimeType,
      storagePath: document.storagePath,
      viewerUrl: `/documents/${document.id}`,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(GetDocumentQuery)
export class GetDocumentHandler implements IQueryHandler<GetDocumentQuery, DocumentDto> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetDocumentQuery): Promise<DocumentDto> {
    const document = await this.prisma.document.findFirst({
      where: { id: query.id, tenantId: query.tenantId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return {
      id: document.id,
      tenantId: document.tenantId,
      type: document.type as DocumentType,
      fileName: document.fileName,
      mimeType: document.mimeType,
      storagePath: document.storagePath,
      viewerUrl: `/documents/${document.id}`,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}

@CommandHandler(DeleteDocumentCommand)
export class DeleteDocumentHandler
  implements ICommandHandler<DeleteDocumentCommand, void>
{
  constructor(private readonly documentManager: DocumentManager) {}

  async execute(command: DeleteDocumentCommand): Promise<void> {
    await this.documentManager.deleteDocument(command.tenantId, command.id);
  }
}

export const DocumentHandlers = [
  CreateDocumentHandler,
  GetDocumentHandler,
  DeleteDocumentHandler,
];
