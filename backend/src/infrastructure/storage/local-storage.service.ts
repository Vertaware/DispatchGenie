import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ensureDir } from '../../shared/utils/fs-utils';
import { createReadStream, createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Stream } from 'stream';

export interface SaveFileOptions {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  tenantId: string;
}

@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly baseDir: string;

  constructor(configService: ConfigService) {
    this.baseDir =
      configService.get<string>('uploads.directory') ??
      path.join(process.cwd(), 'uploads');
  }

  private buildPath(tenantId: string, fileName: string): string {
    return path.join(this.baseDir, tenantId, fileName);
  }

  async saveFile(options: SaveFileOptions): Promise<string> {
    const filePath = this.buildPath(options.tenantId, options.fileName);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, options.buffer);
    this.logger.log(`Saved file ${filePath}`);
    return filePath;
  }

  async deleteFile(storagePath: string): Promise<void> {
    try {
      await fs.unlink(storagePath);
    } catch (error) {
      this.logger.warn(`Failed to delete file ${storagePath}: ${error}`);
    }
  }

  getStream(storagePath: string): Stream {
    if (!storagePath) {
      throw new NotFoundException('File not found');
    }
    return createReadStream(storagePath);
  }
}
