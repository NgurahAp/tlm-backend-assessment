import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_RESPONSE_HEADER = 'X-Request-Id';

const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

function isSafeRequestId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_REQUEST_ID_LENGTH &&
    SAFE_REQUEST_ID_PATTERN.test(value)
  );
}

export function resolveRequestId(
  request: IncomingMessage,
  response: ServerResponse,
): string {
  const header = request.headers[REQUEST_ID_HEADER];
  const assignedRequestId = request.id;
  const candidate =
    assignedRequestId !== undefined
      ? String(assignedRequestId)
      : Array.isArray(header)
        ? header[0]
        : header;
  const normalized = candidate?.trim();
  const requestId =
    normalized && isSafeRequestId(normalized) ? normalized : randomUUID();

  response.setHeader(REQUEST_ID_RESPONSE_HEADER, requestId);
  return requestId;
}
