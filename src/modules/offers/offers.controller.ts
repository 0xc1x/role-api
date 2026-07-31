import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateOfferSchema,
  ListOffersQuerySchema,
  UpdateOfferSchema,
} from '@0xc1x/role-commons';
import type {
  CreateOfferDto,
  ListOffersQuery,
  OfferDto,
  UpdateOfferDto,
} from '@0xc1x/role-commons';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OffersService } from './offers.service';

@ApiTags('Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List available surplus food offers' })
  @ApiOkResponse({ description: 'Paginated offer list' })
  list(
    @Query(new ZodValidationPipe(ListOffersQuerySchema))
    query: ListOffersQuery,
  ) {
    return this.offersService.list(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get offer detail' })
  @ApiOkResponse({ description: 'Offer detail with business and location' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.offersService.getById(id);
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create an offer (admin)' })
  @ApiCreatedResponse({ description: 'Offer created' })
  create(
    @Body(new ZodValidationPipe(CreateOfferSchema))
    body: CreateOfferDto,
  ): Promise<OfferDto> {
    return this.offersService.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update an offer (admin)' })
  @ApiOkResponse({ description: 'Offer updated' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateOfferSchema))
    body: UpdateOfferDto,
  ): Promise<OfferDto> {
    return this.offersService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Deactivate an offer (admin)' })
  @ApiOkResponse({ description: 'Offer deactivated' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.offersService.remove(id);
  }
}
