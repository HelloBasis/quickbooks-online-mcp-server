/**
 * QUICKBOOKS_ACCESS_TOKEN mode: the host owns the OAuth lifecycle and hands the
 * server a ready access token. The client must build node-quickbooks with that
 * token, never refresh, never read or write the token store, and not require
 * client credentials. Env is set before import because the mode is resolved at
 * module load, like QUICKBOOKS_TOKEN_STORE_PATH.
 */
import { jest } from '@jest/globals';

delete process.env.QUICKBOOKS_CLIENT_ID;
delete process.env.QUICKBOOKS_CLIENT_SECRET;
delete process.env.QUICKBOOKS_REFRESH_TOKEN;
process.env.QUICKBOOKS_ACCESS_TOKEN = 'placeholder-access-token';
process.env.QUICKBOOKS_REALM_ID = '4620816365';
process.env.QUICKBOOKS_ENVIRONMENT = 'production';

const dotenvConfig = jest.fn();
jest.unstable_mockModule('dotenv', () => ({ default: { config: dotenvConfig, parse: jest.fn(() => ({})) } }));

const refreshUsingToken = jest.fn();
jest.unstable_mockModule('intuit-oauth', () => {
  class MockOAuthClient {
    static scopes = { Accounting: 'com.intuit.quickbooks.accounting' };
    refreshUsingToken = refreshUsingToken;
    createToken = jest.fn();
    authorizeUri = jest.fn(() => 'https://mock');
    constructor(_cfg: Record<string, unknown>) {}
  }
  return { default: MockOAuthClient };
});

const quickbooksCtor = jest.fn();
jest.unstable_mockModule('node-quickbooks', () => ({
  default: class MockQuickBooks {
    constructor(...args: unknown[]) {
      quickbooksCtor(...args);
    }
  },
}));

const writeFileSync = jest.fn();
jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: jest.fn(() => false),
    readFileSync: jest.fn(() => ''),
    writeFileSync,
    renameSync: jest.fn(),
    unlinkSync: jest.fn(),
    lstatSync: jest.fn(() => ({ isSymbolicLink: () => false })),
    realpathSync: jest.fn(),
    readlinkSync: jest.fn(),
  },
}));
jest.unstable_mockModule('open', () => ({ default: jest.fn(async () => undefined) }));

const { QuickbooksClient, quickbooksClient } = await import('../../../src/clients/quickbooks-client');

describe('QUICKBOOKS_ACCESS_TOKEN mode', () => {
  it('loads without client credentials and without reading a token store', () => {
    expect(dotenvConfig).not.toHaveBeenCalled();
  });

  it('builds node-quickbooks with the provided token and realm, sandbox flag from environment', async () => {
    const instance = await QuickbooksClient.getInstance();
    expect(instance).toBeDefined();
    expect(quickbooksCtor).toHaveBeenCalledTimes(1);
    const args = quickbooksCtor.mock.calls[0];
    expect(args[2]).toBe('placeholder-access-token');
    expect(args[4]).toBe('4620816365');
    expect(args[5]).toBe(false);
  });

  it('reuses the instance and never refreshes or persists', async () => {
    const first = await QuickbooksClient.getInstance();
    const second = await QuickbooksClient.getInstance();
    expect(second).toBe(first);
    expect(quickbooksCtor).not.toHaveBeenCalled();
    expect(refreshUsingToken).not.toHaveBeenCalled();
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('exposes the static token through getAuthCredentials', async () => {
    await expect(QuickbooksClient.getAuthCredentials()).resolves.toEqual({
      accessToken: 'placeholder-access-token',
      realmId: '4620816365',
      isSandbox: false,
    });
    expect((quickbooksClient as any).isTokenExpiredOrExpiringSoon()).toBe(false);
  });
});
