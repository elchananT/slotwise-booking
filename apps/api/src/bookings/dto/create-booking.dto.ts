import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { trim } from '../../common/transforms';
import { IsInstant } from '../../common/validators/is-instant';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  /** Omit to let the business assign the least busy professional who offers the service. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  staffId?: string;

  @IsInstant()
  startsAt!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerName!: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  customerEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
