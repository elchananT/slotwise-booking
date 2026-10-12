import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class AvailabilityQueryDto {
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  staffId?: string;
}
