import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type UnitOfWorkCallback<T> = (prisma: PrismaService) => Promise<T>;

export interface UnitOfWork {
  withTransaction<T>(callback: UnitOfWorkCallback<T>): Promise<T>;
}

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async withTransaction<T>(callback: UnitOfWorkCallback<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => callback(tx as PrismaService));
  }

  get prismaClient(): PrismaService {
    return this.prisma;
  }
}
