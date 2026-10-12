import { Transform } from 'class-transformer';
import { trimLowercase } from '../../common/transforms';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @Transform(trimLowercase)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  /** bcrypt only uses the first 72 bytes, so longer passwords are rejected. */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
