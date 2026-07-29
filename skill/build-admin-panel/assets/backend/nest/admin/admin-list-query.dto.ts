import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ToTrimmedString } from '../../../common/dto/transforms';

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/**
 * Base for every admin list query.
 *
 * The global ValidationPipe runs with `forbidNonWhitelisted: true`, so any
 * query parameter that is not declared on one of these DTOs is rejected with a
 * 400, every filter the panel sends must have a field here.
 */
export class AdminListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search term' })
  @IsOptional()
  @ToTrimmedString()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Created at or after (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Created at or before (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  createdTo?: string;

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder?: SortOrder = 'desc';
}

/** Builds a `createdAt` range filter, omitted entirely when unset. */
export function buildDateRangeFilter(
  from?: string,
  to?: string,
): Record<string, Date> | undefined {
  if (!from && !to) {
    return undefined;
  }

  return {
    ...(from ? { $gte: new Date(from) } : {}),
    ...(to ? { $lte: new Date(to) } : {}),
  };
}

/** Mongo sort direction from a validated `sortOrder`. */
export function toSortDirection(order: SortOrder = 'desc'): 1 | -1 {
  return order === 'asc' ? 1 : -1;
}
