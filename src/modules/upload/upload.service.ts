import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import type { Env } from '../../config/env.schema';

export interface UploadOptions {
  bucket?: string;
  folder?: string;
}

@Injectable()
export class UploadService {
  private supabase;
  private allowedBuckets: string[];
  private allowedFolders: string[];

  constructor(private readonly config: ConfigService<Env, true>) {
    const url = this.config.get('SUPABASE_URL', { infer: true });
    const serviceRoleKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY', {
      infer: true,
    });

    this.supabase = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const rawBuckets = this.config.get('SUPABASE_ALLOWED_BUCKETS', { infer: true }) ?? '';
    this.allowedBuckets = rawBuckets.split(',').map((s) => s.trim()).filter(Boolean);

    const rawFolders = this.config.get('SUPABASE_ALLOWED_FOLDERS', { infer: true }) ?? '';
    this.allowedFolders = rawFolders.split(',').map((s) => s.trim()).filter(Boolean);
  }

  async uploadImage(
    file: Express.Multer.File,
    options?: UploadOptions,
  ): Promise<{ url: string; path: string }> {
    const bucket = options?.bucket ?? this.config.get('SUPABASE_STORAGE_BUCKET', { infer: true }) ?? 'images';
    const folder = options?.folder ?? 'categories';

    if (!this.allowedBuckets.includes(bucket)) {
      throw new BadRequestException(`Bucket "${bucket}" no permitido`);
    }

    if (!this.allowedFolders.includes(folder)) {
      throw new BadRequestException(`Carpeta "${folder}" no permitida`);
    }

    const ext = '.webp';
    const path = `${folder}/${crypto.randomUUID()}${ext}`;

    const compressed = await sharp(file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(path, compressed, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    const { data: publicUrlData } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return { url: publicUrlData.publicUrl, path };
  }
}
