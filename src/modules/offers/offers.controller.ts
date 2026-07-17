import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OffersService } from './offers.service';
import { ListOffersQuerySchema } from '@0xc1x/role-commons';
import type { ListOffersQuery } from '@0xc1x/role-commons';

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
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Offer detail with business and location' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.offersService.getById(id);
  }
}
