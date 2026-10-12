import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTimeOffDto {
  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
