import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsInstant } from '../../common/validators/is-instant';

export class CreateTimeOffDto {
  @IsInstant()
  startsAt!: string;

  @IsInstant()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
