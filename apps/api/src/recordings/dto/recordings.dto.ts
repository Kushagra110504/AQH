import { IsNotEmpty, IsString } from 'class-validator';

export class StartRecordingDto {
  @IsString()
  @IsNotEmpty({ message: 'Session ID is required.' })
  sessionId: string;
}

export class StopRecordingDto {
  @IsString()
  @IsNotEmpty({ message: 'Session ID is required.' })
  sessionId: string;
}
