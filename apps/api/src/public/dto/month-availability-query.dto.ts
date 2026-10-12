import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class MonthAvailabilityQueryDto {
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM' })
  month!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  staffId?: string;
}
