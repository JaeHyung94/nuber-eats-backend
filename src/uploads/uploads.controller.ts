import {
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as AWS from 'aws-sdk';

const BUCKET_NAME = 'nubereatsmadebyjaypark';

@Controller('uploads')
export class UploadsController {
  @Post('')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file) {
    AWS.config.update({
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
    });
    try {
      // 이거는 bucket 만드는 용으로 한번만 함.
      //   const upload = await new AWS.S3()
      //     .createBucket({
      //       Bucket: 'nubereatsmadebyjaypark',
      //     })
      //     .promise();
      const objectName = `${Date.now() + file.originalname}`;
      await new AWS.S3()
        .putObject({
          Bucket: BUCKET_NAME,
          Body: file.buffer,
          Key: objectName,
          ACL: 'public-read',
        })
        .promise();
      const fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${objectName}`;
      return { url: fileUrl };
    } catch (error) {
      return null;
    }
  }
}
