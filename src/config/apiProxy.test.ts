import { describe, expect, it } from 'vitest';
import {
  buildProxyUrl,
  isAllowedUpstreamUrl,
  toProxiedGraphqlUrl,
} from '@/config/apiProxy';

describe('apiProxy', () => {
  it('allows standard devbox GraphQL hosts', () => {
    expect(
      isAllowedUpstreamUrl(
        'https://api.e-7nan5854f07w.dev.cks-env.com/graphql',
        'mgmt',
      ),
    ).toBe(true);
    expect(
      isAllowedUpstreamUrl(
        'https://game.e-7nan5854f07w.dev.cks-env.com/graphql',
        'game',
      ),
    ).toBe(true);
  });

  it('rejects arbitrary external hosts', () => {
    expect(
      isAllowedUpstreamUrl('https://evil.example.com/graphql', 'mgmt'),
    ).toBe(false);
    expect(
      isAllowedUpstreamUrl('http://api.e-foo.dev.cks-env.com/graphql', 'mgmt'),
    ).toBe(false);
  });

  it('builds encoded proxy URLs', () => {
    const upstream = 'https://api.e-foo.dev.cks-env.com/graphql';
    expect(buildProxyUrl('mgmt', upstream)).toBe(
      `/cks-proxy/mgmt?target=${encodeURIComponent(upstream)}`,
    );
    expect(toProxiedGraphqlUrl('mgmt', upstream)).toBe(buildProxyUrl('mgmt', upstream));
    expect(toProxiedGraphqlUrl('mgmt', buildProxyUrl('mgmt', upstream))).toBe(
      buildProxyUrl('mgmt', upstream),
    );
  });
});
