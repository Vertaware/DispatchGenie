import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PaginatedResult, UserDto, UserRole } from '~/enums/index';
import { UserRole as PrismaUserRole } from '@prisma/client';

export class CreateUserCommand {
  constructor(
    public readonly tenantId: string,
    public readonly email: string,
    public readonly name: string,
    public readonly role: UserRole,
  ) {}
}

export class ListUsersQuery {
  constructor(
    public readonly tenantId: string,
    public readonly page = 1,
    public readonly pageSize = 25,
  ) {}
}

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand, UserDto> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateUserCommand): Promise<UserDto> {
    const email = command.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { tenantId: command.tenantId, email },
    });
    if (existing) {
      throw new ConflictException('User already exists for tenant');
    }
    const user = await this.prisma.user.create({
      data: {
        tenantId: command.tenantId,
        email,
        name: command.name,
        role: command.role as PrismaUserRole,
        isActive: true,
      },
    });
    return this.map(user);
  }

  private map(user: any): UserDto {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }
}

@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery, PaginatedResult<UserDto>> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListUsersQuery): Promise<PaginatedResult<UserDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const [totalCount, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { tenantId: query.tenantId } }),
      this.prisma.user.findMany({
        where: { tenantId: query.tenantId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      data: users.map((u) => ({
        id: u.id,
        tenantId: u.tenantId,
        email: u.email,
        name: u.name,
        role: u.role as UserRole,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      })),
      page,
      pageSize,
      totalCount,
    };
  }
}

export const UserHandlers = [CreateUserHandler, ListUsersHandler];
