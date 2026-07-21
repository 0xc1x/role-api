import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

describe('UploadController', () => {
  let controller: UploadController;
  let uploadService: jest.Mocked<UploadService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: {
            uploadImage: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UploadController);
    uploadService = module.get(UploadService);
  });

  describe('uploadImage', () => {
    const mockFile = {
      fieldname: 'file',
      originalname: 'photo.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake'),
      size: 500_000,
    } as Express.Multer.File;

    it('should return the URL from the service', async () => {
      uploadService.uploadImage.mockResolvedValue({
        url: 'https://supabase.co/storage/v1/object/public/images/categories/uuid.webp',
        path: 'categories/uuid.webp',
      });

      const result = await controller.uploadImage(mockFile);

      expect(result).toEqual({
        url: 'https://supabase.co/storage/v1/object/public/images/categories/uuid.webp',
      });
      expect(uploadService.uploadImage).toHaveBeenCalledWith(mockFile);
    });

    it('should pass through service errors', async () => {
      uploadService.uploadImage.mockRejectedValue(
        new Error('Bucket not found'),
      );

      await expect(controller.uploadImage(mockFile)).rejects.toThrow(
        'Bucket not found',
      );
    });
  });
});
