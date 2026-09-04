import { IsInt, Min } from 'class-validator';
import { AppValidationPipe } from './app-validation.pipe.js';

class TestBodyDto {
  @IsInt()
  @Min(1)
  quantity!: number;
}

const bodyMetadata = {
  type: 'body' as const,
  metatype: TestBodyDto,
  data: undefined,
};

describe('AppValidationPipe', () => {
  const pipe = new AppValidationPipe();

  it('transforms a valid body into its DTO class', async () => {
    const result = await pipe.transform({ quantity: 2 }, bodyMetadata);

    expect(result).toBeInstanceOf(TestBodyDto);
    expect(result.quantity).toBe(2);
  });

  it('rejects invalid values and unknown fields', async () => {
    await expect(
      pipe.transform({ quantity: 0, unexpected: true }, bodyMetadata),
    ).rejects.toMatchObject({ status: 400 });
  });
});
