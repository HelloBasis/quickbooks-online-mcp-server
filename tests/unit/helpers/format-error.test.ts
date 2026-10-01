import { formatError } from '../../../src/helpers/format-error';

describe('formatError', () => {
  it('should format Error instances', () => {
    const error = new Error('Something went wrong');
    expect(formatError(error)).toBe('Error: Something went wrong');
  });

  it('should format string errors', () => {
    expect(formatError('A string error')).toBe('Error: A string error');
  });

  it('should format unknown error types', () => {
    const unknownError = { code: 500, message: 'Server error' };
    expect(formatError(unknownError)).toBe(
      'Unknown error: {"code":500,"message":"Server error"}'
    );
  });

  it('should handle null errors', () => {
    expect(formatError(null)).toBe('Unknown error: null');
  });

  it('should handle undefined errors', () => {
    expect(formatError(undefined)).toBe('Unknown error: undefined');
  });

  it('should handle number errors', () => {
    expect(formatError(404)).toBe('Unknown error: 404');
  });

  it('should surface QuickBooks Fault details from an axios error', () => {
    const error = Object.assign(new Error('Request failed with status code 400'), {
      response: {
        status: 400,
        data: {
          Fault: {
            type: 'ValidationFault',
            Error: [{ Message: 'Object Not Found', Detail: 'Object Not Found : Something you\'re trying to use has been made inactive.', code: '610' }],
          },
        },
      },
    });
    expect(formatError(error)).toBe(
      "Error: QuickBooks ValidationFault fault (HTTP 400): Object Not Found - Object Not Found : Something you're trying to use has been made inactive. - (code 610)"
    );
  });

  it('should surface QuickBooks Fault details when the body itself is the error', () => {
    const body = { Fault: { Error: [{ Message: 'Invalid query', code: '4000' }] } };
    expect(formatError(body)).toBe('Error: QuickBooks fault: Invalid query - (code 4000)');
  });

  it('should skip missing or non-string Fault parts', () => {
    const body = { Fault: { Error: [{ Message: 'Missing', Detail: 12 }, { Detail: 'Second' }] } };
    expect(formatError(body)).toBe('Error: QuickBooks fault: Missing; Second');
  });
});
