import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Req,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { CreateDocumentDto } from "./dto/create-document.dto";
import {
  CreateDocumentCommand,
  DeleteDocumentCommand,
  GetDocumentQuery,
} from "../../../application/documents/document.handlers";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";
import { SubscriptionGuard } from "../../guards/subscription.guard";
import { CurrentUser } from "../../decorators/current-user.decorator";
import { AuthenticatedUser } from "~/enums/index";
import { FileInterceptor } from "@nestjs/platform-express";
import { DocumentManager } from "../../../infrastructure/documents/document.manager";
import { type Express, Response, type Request } from "express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";

@ApiTags("Documents")
@Controller("documents")
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@ApiBearerAuth("access-token")
export class DocumentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly documentManager: DocumentManager
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload a document" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        type: { type: "string" },
      },
      required: ["file", "type"],
    },
  })
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    if (!file) {
      throw new Error("File required");
    }
    return this.commandBus.execute(
      new CreateDocumentCommand(user.tenantId, dto.type, {
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      })
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Download a document" })
  @ApiProduces("application/octet-stream")
  async download(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response
  ) {
    const document = await this.queryBus.execute(
      new GetDocumentQuery(user.tenantId, id)
    );
    const fileData = await this.documentManager.getDocumentFile(user.tenantId, id);
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${document.fileName}"`
    );
    res.send(fileData);
  }

  @Get(":id/url")
  @ApiOperation({ summary: "Get a document viewer URL" })
  async getViewerUrl(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request
  ) {
    // Ensure the document exists and belongs to the tenant
    await this.queryBus.execute(new GetDocumentQuery(user.tenantId, id));
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    return { url: `${baseUrl}/documents/${id}` };
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a document" })
  async delete(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.commandBus.execute(new DeleteDocumentCommand(user.tenantId, id));
  }
}
