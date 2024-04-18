import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  Get,
  UseGuards,
  Query,
  Delete,
  Param,
  Res,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileStorage } from './storage';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { UserId } from '../decorators/user-id.decorator';
import { FileType } from './entities/file.entity';

import * as fs from 'fs';
import { Response } from 'express';
import * as path from 'path';

@Controller('files')
@ApiTags('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) { }

  @Get()
  findAll(@UserId() userId: number, @Query('type') fileType: FileType) {
    return this.filesService.findAll(userId, fileType);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: fileStorage,
    }),
  )
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
    },
  })
  create(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 })],
      }),
    )
    file: Express.Multer.File,
    @UserId() userId: number,
  ) {
    return this.filesService.create(file, userId);
  }

  @Delete()
  remove(@UserId() userId: number, @Query('ids') ids: string) {
    return this.filesService.remove(userId, ids);
  }

  @Get('/one/:fileName')
  parseJsonData(@Res() res: Response, @Param('fileName') fileName: string) {
    const filePath = 'uploads'
    res.set({
      'Content-Disposition': `attachment; filename=${fileName}`,
      'Content-Type': 'application/json; charset=utf-8',
    })
    return fs.createReadStream(filePath).pipe(res)
  }

  @Get('/all')
  async downloadAllFiles(@Res() res: Response) {
    const directoryPath = 'uploads';
    const files = await fs.promises.readdir(directoryPath);

    res.set({
      'Content-Type': 'application/octet-stream',
    });

    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      if ((await fs.promises.stat(filePath)).isFile()) {
        res.attachment(file);
        fs.createReadStream(filePath).pipe(res);
      }
    }
  }
}
