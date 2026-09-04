import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CandidateHeaderService {
  constructor(private readonly config: ConfigService) {}

  getValue(): string {
    const candidateName = this.config
      .getOrThrow<string>('app.candidateName')
      .trim();

    if (candidateName.length === 0) {
      throw new InternalServerErrorException({
        code: 'PAYMENT_CONFIGURATION_ERROR',
        message: 'Candidate name is not configured',
      });
    }

    const normalizedName = candidateName
      .toLocaleLowerCase('en-US')
      .replace(/\s+/g, '_');
    return Buffer.from(normalizedName, 'utf8').toString('base64');
  }
}
