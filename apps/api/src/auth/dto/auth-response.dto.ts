import { OwnerView } from '../owner.view';

export class AuthResponseDto {
  owner!: OwnerView;
  accessToken!: string;
  refreshToken!: string;
}

export class TokenPairDto {
  accessToken!: string;
  refreshToken!: string;
}
