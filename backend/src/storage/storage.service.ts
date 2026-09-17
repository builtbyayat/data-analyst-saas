import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.client = new S3Client({
      region: this.configService.get<string>(
        'S3_REGION',
        'us-east-1',
      ),

      endpoint: this.configService.get<string>(
        'S3_ENDPOINT',
      ),

      forcePathStyle:
        this.configService.get<string>(
          'S3_FORCE_PATH_STYLE',
          'true',
        ) === 'true',

      credentials: {
        accessKeyId:
          this.configService.get<string>(
            'S3_ACCESS_KEY',
            'minioadmin',
          ),

        secretAccessKey:
          this.configService.get<string>(
            'S3_SECRET_KEY',
            'minioadmin',
          ),
      },
    });

    this.bucket = this.configService.get<string>(
      'S3_BUCKET',
      'datasets',
    );
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(
        new HeadBucketCommand({
          Bucket: this.bucket,
        }),
      );
    } catch {
      await this.client.send(
        new CreateBucketCommand({
          Bucket: this.bucket,
        }),
      );
    }
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}