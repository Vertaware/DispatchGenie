import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AssignVehicleDto } from './dto/assign-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import {
  AssignVehicleCommand,
  ExportVehiclesQuery,
  GetVehicleQuery,
  ListVehiclesQuery,
  SearchVehiclesQuery,
  UpdateVehicleCommand,
  UploadVehiclePhotoCommand,
  UploadVehiclePodCommand,
  UploadVehicleInvoicePdfCommand,
  UploadVehicleLrCopyCommand,
} from '../../../application/vehicles/vehicles.handlers';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../guards/subscription.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/enums/index';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { type Express, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Vehicles')
@Controller('vehicles')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@ApiBearerAuth('access-token')
export class VehiclesController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post('assign')
  @ApiOperation({ summary: 'Assign a vehicle to an order or driver' })
  async assign(
    @Body() dto: AssignVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandBus.execute(
      new AssignVehicleCommand(user.tenantId, user.role, { ...dto }),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List vehicles with pagination and filtering' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query() filters?: Record<string, any>,
  ) {
    const filterCopy: Record<string, string> = {};
    
    // Extract nested filters object if present (from filters[key]=value format)
    if (filters?.filters && typeof filters.filters === 'object') {
      Object.assign(filterCopy, filters.filters);
    }
    
    // Also extract top-level filter keys (for backward compatibility)
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (key !== 'page' && key !== 'pageSize' && key !== 'sortBy' && key !== 'sortOrder' && key !== 'filters') {
        if (typeof value === 'string') {
          filterCopy[key] = value;
        }
      }
    });
    
    return this.queryBus.execute(
      new ListVehiclesQuery(
        user.tenantId,
        Number(page),
        Number(pageSize),
        sortBy,
        sortOrder,
        filterCopy,
        user.role,
      ),
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'Search vehicles by vehicle number for autocomplete' })
  @ApiQuery({ name: 'q', required: true, description: 'Search term for vehicle number' })
  async search(
    @Query('q') searchTerm: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queryBus.execute(new SearchVehiclesQuery(user.tenantId, searchTerm));
  }

  @Get('export')
  @ApiOperation({ summary: 'Export filtered vehicles to an Excel spreadsheet' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async export(
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query() filters?: Record<string, string>,
  ) {
    const filterCopy = { ...filters };
    delete filterCopy.sortBy;
    delete filterCopy.sortOrder;
    const { buffer, fileName } = await this.queryBus.execute(
      new ExportVehiclesQuery(user.tenantId, filterCopy, sortBy, sortOrder, user.role),
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a vehicle by id' })
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queryBus.execute(new GetVehicleQuery(user.tenantId, id, user.role));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vehicle metadata' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandBus.execute(
      new UpdateVehicleCommand(user.tenantId, id, dto, user.role),
    );
  }

  @Post(':id/pod')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload proof-of-delivery document for a vehicle' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  async uploadPod(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new Error('File is required');
    }
    return this.commandBus.execute(
      new UploadVehiclePodCommand(user.tenantId, id, {
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      }),
    );
  }

  @Post(':id/invoice-pdf')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload invoice PDF for a vehicle' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  async uploadInvoicePdf(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new Error('File is required');
    }
    return this.commandBus.execute(
      new UploadVehicleInvoicePdfCommand(user.tenantId, id, {
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      }),
    );
  }

  @Post(':id/lr-copy')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload LR copy document for a vehicle' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  async uploadLrCopy(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new Error('File is required');
    }
    return this.commandBus.execute(
      new UploadVehicleLrCopyCommand(user.tenantId, id, {
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      }),
    );
  }

  @Post(':id/photos')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({ summary: 'Upload reference photos for a vehicle' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['files'],
    },
  })
  async uploadPhotos(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!files || files.length === 0) {
      throw new Error('Files are required');
    }
    const results = [];
    for (const file of files) {
      const result = await this.commandBus.execute(
        new UploadVehiclePhotoCommand(user.tenantId, id, {
          buffer: file.buffer,
          mimeType: file.mimetype,
          originalName: file.originalname,
        }),
      );
      results.push(result);
    }
    return results;
  }
}
