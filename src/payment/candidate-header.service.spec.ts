import type { ConfigService } from '@nestjs/config';
import { CandidateHeaderService } from './candidate-header.service.js';

describe('CandidateHeaderService', () => {
  it('normalizes the candidate name and returns Base64', () => {
    const config = {
      getOrThrow: () => 'Wulan Guritno',
    } as unknown as ConfigService;
    const service = new CandidateHeaderService(config);

    expect(service.getValue()).toBe('d3VsYW5fZ3VyaXRubw==');
  });

  it('rejects an empty candidate name', () => {
    const config = {
      getOrThrow: () => '   ',
    } as unknown as ConfigService;
    const service = new CandidateHeaderService(config);

    expect(() => service.getValue()).toThrow(
      'Candidate name is not configured',
    );
  });
});
