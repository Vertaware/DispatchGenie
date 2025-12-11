import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  CommandHandler,
  ICommandHandler,
  IQueryHandler,
  QueryHandler,
} from '@nestjs/cqrs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BeneficiaryDto, PaginatedResult } from '~/enums/index';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';

type SortOrder = 'asc' | 'desc';

export class CreateBeneficiaryCommand {
  constructor(
    public readonly tenantId: string,
    public readonly name: string,
    public readonly accountNumber: string,
    public readonly bankNameAndBranch: string,
    public readonly ifscCode: string,
    public readonly contactInfo?: string,
    public readonly documentId?: string,
  ) {}
}

export class UpdateBeneficiaryCommand {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
    public readonly payload: Partial<{
      name: string;
      bankNameAndBranch: string;
      ifscCode: string;
      contactInfo: string;
      documentId: string | null;
    }>,
  ) {}
}

export class GetBeneficiaryQuery {
  constructor(public readonly tenantId: string, public readonly id: string) {}
}

export class ListBeneficiariesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
    public readonly filters: Record<string, string>,
  ) {}
}

export class ExportBeneficiariesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters: Record<string, string>,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
  ) {}
}

@CommandHandler(CreateBeneficiaryCommand)
export class CreateBeneficiaryHandler
  implements ICommandHandler<CreateBeneficiaryCommand, BeneficiaryDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateBeneficiaryCommand): Promise<BeneficiaryDto> {
    if (command.documentId) {
      const document = await this.prisma.document.findFirst({
        where: { id: command.documentId, tenantId: command.tenantId },
      });
      if (!document) {
        throw new BadRequestException('Document not found');
      }
    }
    const beneficiary = await this.prisma.beneficiary.create({
      data: {
        tenantId: command.tenantId,
        name: command.name,
        accountNumber: command.accountNumber,
        bankNameAndBranch: command.bankNameAndBranch,
        ifscCode: command.ifscCode,
        contactInfo: command.contactInfo ?? null,
        documentId: command.documentId ?? null,
      },
    });
    return this.map(beneficiary);
  }

  private map(entity: any): BeneficiaryDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      accountNumber: entity.accountNumber,
      bankNameAndBranch: entity.bankNameAndBranch,
      ifscCode: entity.ifscCode,
      contactInfo: entity.contactInfo,
      documentId: entity.documentId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}

@CommandHandler(UpdateBeneficiaryCommand)
export class UpdateBeneficiaryHandler
  implements ICommandHandler<UpdateBeneficiaryCommand, BeneficiaryDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateBeneficiaryCommand): Promise<BeneficiaryDto> {
    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { id: command.id, tenantId: command.tenantId },
    });
    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }
    if (command.payload.documentId) {
      const document = await this.prisma.document.findFirst({
        where: { id: command.payload.documentId, tenantId: command.tenantId },
      });
      if (!document) {
        throw new BadRequestException('Document not found');
      }
    }
    const updated = await this.prisma.beneficiary.update({
      where: { id: beneficiary.id },
      data: {
        ...command.payload,
      },
    });
    return this.map(updated);
  }

  private map(entity: any): BeneficiaryDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      accountNumber: entity.accountNumber,
      bankNameAndBranch: entity.bankNameAndBranch,
      ifscCode: entity.ifscCode,
      contactInfo: entity.contactInfo,
      documentId: entity.documentId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(GetBeneficiaryQuery)
export class GetBeneficiaryHandler implements IQueryHandler<GetBeneficiaryQuery, BeneficiaryDto> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetBeneficiaryQuery): Promise<BeneficiaryDto> {
    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { id: query.id, tenantId: query.tenantId },
    });
    if (!beneficiary) throw new NotFoundException('Beneficiary not found');
    return this.map(beneficiary);
  }

  private map(entity: any): BeneficiaryDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      accountNumber: entity.accountNumber,
      bankNameAndBranch: entity.bankNameAndBranch,
      ifscCode: entity.ifscCode,
      contactInfo: entity.contactInfo,
      documentId: entity.documentId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(ListBeneficiariesQuery)
export class ListBeneficiariesHandler
  implements IQueryHandler<ListBeneficiariesQuery, PaginatedResult<BeneficiaryDto>>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ListBeneficiariesQuery,
  ): Promise<PaginatedResult<BeneficiaryDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === 'desc' ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.BeneficiaryOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: direction } as Prisma.BeneficiaryOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };
    const [totalCount, beneficiaries] = await this.prisma.$transaction([
      this.prisma.beneficiary.count({ where }),
      this.prisma.beneficiary.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
      }),
    ]);
    return {
      data: beneficiaries.map((b) => this.map(b)),
      page,
      pageSize,
      totalCount,
    };
  }

  private buildWhere(tenantId: string, filters: Record<string, string>) {
    const where: any = { tenantId };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (!value) return;
      switch (key) {
        case 'name':
        case 'bankNameAndBranch':
        case 'ifscCode':
        case 'contactInfo':
          where[key] = { contains: value, mode: 'insensitive' };
          break;
        case 'accountNumber':
          where.accountNumber = value;
          break;
        case 'fromDate':
        case 'toDate':
          where.createdAt = where.createdAt ?? {};
          if (key === 'fromDate') {
            where.createdAt.gte = new Date(String(value));
          } else {
            where.createdAt.lte = new Date(String(value));
          }
          break;
        default:
          break;
      }
    });
    return where;
  }

  private map(entity: any): BeneficiaryDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      accountNumber: entity.accountNumber,
      bankNameAndBranch: entity.bankNameAndBranch,
      ifscCode: entity.ifscCode,
      contactInfo: entity.contactInfo,
      documentId: entity.documentId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(ExportBeneficiariesQuery)
export class ExportBeneficiariesHandler
  implements IQueryHandler<ExportBeneficiariesQuery, { fileName: string; buffer: Buffer }>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ExportBeneficiariesQuery,
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === 'desc' ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.BeneficiaryOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: direction } as Prisma.BeneficiaryOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };
    const beneficiaries = await this.prisma.beneficiary.findMany({
      where,
      orderBy,
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Beneficiaries');
    sheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Account Number', key: 'accountNumber', width: 20 },
      { header: 'Bank', key: 'bankNameAndBranch', width: 30 },
      { header: 'IFSC', key: 'ifscCode', width: 15 },
      { header: 'Contact', key: 'contactInfo', width: 25 },
    ];
    beneficiaries.forEach((b) => {
      sheet.addRow({
        name: b.name,
        accountNumber: b.accountNumber,
        bankNameAndBranch: b.bankNameAndBranch,
        ifscCode: b.ifscCode,
        contactInfo: b.contactInfo,
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      fileName: `beneficiaries-${new Date().toISOString()}.xlsx`,
      buffer: Buffer.from(buffer),
    };
  }

  private buildWhere(tenantId: string, filters: Record<string, string>) {
    const where: any = { tenantId };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (!value) return;
      switch (key) {
        case 'name':
        case 'bankNameAndBranch':
        case 'ifscCode':
        case 'contactInfo':
          where[key] = { contains: value, mode: 'insensitive' };
          break;
        case 'accountNumber':
          where.accountNumber = value;
          break;
        case 'fromDate':
        case 'toDate':
          where.createdAt = where.createdAt ?? {};
          if (key === 'fromDate') {
            where.createdAt.gte = new Date(String(value));
          } else {
            where.createdAt.lte = new Date(String(value));
          }
          break;
        default:
          break;
      }
    });
    return where;
  }
}

export const BeneficiaryHandlers = [
  CreateBeneficiaryHandler,
  UpdateBeneficiaryHandler,
  GetBeneficiaryHandler,
  ListBeneficiariesHandler,
  ExportBeneficiariesHandler,
];
