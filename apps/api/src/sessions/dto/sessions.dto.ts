import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateSessionDto {}

export class JoinSessionDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required to join the session.' })
  name: string;

  @IsUUID('4', { message: 'Must be a valid invite token.' })
  @IsNotEmpty({ message: 'Invite token is required.' })
  inviteToken: string;
}
