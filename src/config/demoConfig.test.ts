import { describe, expect, it } from 'vitest';
import {
  parseDemoConfig,
  resolveUpstreamUrls,
  serializeDemoConfig,
} from '@/config/demoConfig';
import { buildProxyUrl } from '@/config/apiProxy';

describe('demoConfig proxy URLs', () => {
  it('routes query env through same-origin proxy paths', () => {
    const config = parseDemoConfig('?env=e-7nan5854f07w&app=1&org=1');
    const upstream = resolveUpstreamUrls('e-7nan5854f07w');

    expect(upstream.managementGraphqlUrl).toBe(
      'https://api.e-7nan5854f07w.dev.cks-env.com/graphql',
    );
    expect(config.managementGraphqlUrl).toBe(
      buildProxyUrl('mgmt', upstream.managementGraphqlUrl),
    );
    expect(config.gameHttpUrl).toBe(
      buildProxyUrl('game', upstream.gameHttpUrl),
    );
    expect(config.gameWsUrl).toBe(upstream.gameWsUrl);
    expect(config.managementGraphqlUrl).toMatch(/^\/cks-proxy\//);
    expect(config.gameHttpUrl).toMatch(/^\/cks-proxy\//);
  });

  it('serializes env handle without embedding proxy URLs', () => {
    const config = parseDemoConfig('?env=e-7nan5854f07w&app=2&org=3');
    expect(serializeDemoConfig(config)).toBe('?env=e-7nan5854f07w&app=2&org=3');
  });

  it('preserves custom upstream overrides in share links', () => {
    const customMgmt = 'https://api.dev.crowdedkingdoms.com/graphql';
    const search = serializeDemoConfig({
      envHandle: 'e-7nan5854f07w',
      appId: '1',
      orgId: '1',
      managementGraphqlUrl: customMgmt,
    });
    expect(search).toContain('mgmt=');
    const config = parseDemoConfig(search);
    expect(config.managementGraphqlUrl).toBe(buildProxyUrl('mgmt', customMgmt));
  });

  it('supports shared management override for dedicated environments', () => {
    const sharedMgmt = 'https://api.dev.crowdedkingdoms.com/graphql';
    const config = parseDemoConfig(
      `?env=e-dedicated1&mgmt=${encodeURIComponent(sharedMgmt)}`,
    );
    expect(config.managementGraphqlUrl).toBe(buildProxyUrl('mgmt', sharedMgmt));
  });
});
