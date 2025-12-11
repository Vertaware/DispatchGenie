import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { CreatePaymentRequestDto } from "./dto/create-payment-request.dto";
import {
  CompletePaymentRequestLinkTransactionCommand,
  CreatePaymentRequestCommand,
  ExportPaymentRequestsQuery,
  GetEligibleTransactionsForPaymentQuery,
  GetPaymentRequestQuery,
  LinkTransactionsToPaymentCommand,
  ListPaymentRequestsQuery,
  UpdatePaymentRequestBeneficiaryCommand,
} from "../../../application/payments/payments.handlers";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";
import { SubscriptionGuard } from "../../guards/subscription.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";
import { UserRole } from "../../../shared/enums/index";
import { CurrentUser } from "../../decorators/current-user.decorator";
import { AuthenticatedUser } from "../../../shared/enums/index";
import { CompletePaymentRequestLinkTransactionDto } from "./dto/complete-payment-request-link-transaction.dto";
import { Response } from "express";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

@ApiTags("Payments")
@Controller("payments/requests")
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
@ApiBearerAuth("access-token")
export class PaymentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a payment request" })
  async create(
    @Body() dto: CreatePaymentRequestDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.commandBus.execute(
      new CreatePaymentRequestCommand(
        user.tenantId,
        dto.salesOrderId,
        dto.vehicleId,
        dto.transactionType,
        dto.requestedAmount,
        dto.beneficiaryId,
        dto.notes,
        dto.locationReachedAt,
        dto.unloadedTime
      )
    );
  }

  @Get()
  @ApiOperation({ summary: "List payment requests" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ name: "sortBy", required: false })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "25",
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "asc" | "desc",
    @Query() filters?: Record<string, string>
  ) {
    const filterCopy = { ...filters };
    delete filterCopy.page;
    delete filterCopy.pageSize;
    delete filterCopy.sortBy;
    delete filterCopy.sortOrder;
    return this.queryBus.execute(
      new ListPaymentRequestsQuery(
        user.tenantId,
        Number(page),
        Number(pageSize),
        sortBy,
        sortOrder,
        filterCopy
      )
    );
  }

  @Get("export")
  @ApiOperation({ summary: "Export payment requests as an Excel spreadsheet" })
  @ApiProduces(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
  async export(
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "asc" | "desc",
    @Query() filters?: Record<string, string>
  ) {
    const filterCopy = { ...filters };
    delete filterCopy.sortBy;
    delete filterCopy.sortOrder;
    const { buffer, fileName } = await this.queryBus.execute(
      new ExportPaymentRequestsQuery(
        user.tenantId,
        filterCopy,
        sortBy,
        sortOrder
      )
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get(":id")
  @ApiOperation({ summary: "Retrieve a payment request" })
  async get(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queryBus.execute(new GetPaymentRequestQuery(user.tenantId, id));
  }

  @Post(":id/complete/link-transaction")
  @ApiOperation({
    summary: "Link one or more existing transactions to a payment request",
  })
  async linkTransaction(
    @Param("id") id: string,
    @Body() dto: CompletePaymentRequestLinkTransactionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.commandBus.execute(
      new CompletePaymentRequestLinkTransactionCommand(
        user.tenantId,
        id,
        dto.transactionIds
      )
    );
  }

  @Post(":id/beneficiary")
  @ApiOperation({ summary: "Update beneficiary for a payment request" })
  async updateBeneficiary(
    @Param("id") id: string,
    @Body() body: { beneficiaryId: string },
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.commandBus.execute(
      new UpdatePaymentRequestBeneficiaryCommand(
        user.tenantId,
        id,
        body.beneficiaryId
      )
    );
  }

  @Get(":id/eligible-transactions")
  @ApiOperation({ summary: "Get eligible transactions for a payment request" })
  async getEligibleTransactions(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.queryBus.execute(
      new GetEligibleTransactionsForPaymentQuery(user.tenantId, id)
    );
  }

  @Post(":id/link-transactions")
  @ApiOperation({ summary: "Link multiple transactions to a payment request" })
  async linkTransactions(
    @Param("id") id: string,
    @Body()
    body: {
      allocations: Array<{
        bankTransactionId: string;
        allocatedAmount: number;
      }>;
    },
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.commandBus.execute(
      new LinkTransactionsToPaymentCommand(user.tenantId, id, body.allocations)
    );
  }
}
