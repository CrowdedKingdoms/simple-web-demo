import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  configFingerprint,
  configToDisplay,
  isConfigComplete,
  parseDemoConfig,
  serializeDemoConfig,
  setActiveDemoConfig,
  type DemoConfig,
} from '@/config/demoConfig';
import {
  checkConnectivityForConfig,
  type ConnectivityStatus,
} from '@/game/session/connectivity';

interface DemoConfigContextValue {
  config: DemoConfig;
  configDisplay: Record<string, string>;
  isComplete: boolean;
  connectivity: ConnectivityStatus;
  checking: boolean;
  applyDraft: (draft: {
    envHandle: string;
    appId: string;
    orgId: string;
  }) => void;
  recheckConnectivity: () => Promise<void>;
}

const DemoConfigContext = createContext<DemoConfigContextValue | null>(null);

export function DemoConfigProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const config = useMemo(() => {
    const parsed = parseDemoConfig(location.search);
    // Sync before any CrowdySession.getInstance() on first render (useEffect is too late).
    setActiveDemoConfig(parsed);
    return parsed;
  }, [location.search]);

  const [connectivity, setConnectivity] = useState<ConnectivityStatus>({
    managementOk: null,
    gameOk: null,
  });
  const [checking, setChecking] = useState(false);

  const recheckConnectivity = useCallback(async () => {
    if (!isConfigComplete(config)) {
      setConnectivity({ managementOk: null, gameOk: null });
      return;
    }
    setChecking(true);
    const result = await checkConnectivityForConfig(config);
    setConnectivity(result);
    setChecking(false);
  }, [config]);

  useEffect(() => {
    void recheckConnectivity();
  }, [recheckConnectivity]);

  const applyDraft = useCallback(
    (draft: { envHandle: string; appId: string; orgId: string }) => {
      const handle = draft.envHandle.trim();
      if (!handle) return;
      const search = serializeDemoConfig({
        envHandle: handle,
        appId: draft.appId.trim() || '1',
        orgId: draft.orgId.trim() || '1',
      });
      navigate({ pathname: location.pathname, search }, { replace: true });
    },
    [location.pathname, navigate],
  );

  const value = useMemo<DemoConfigContextValue>(
    () => ({
      config,
      configDisplay: configToDisplay(config),
      isComplete: isConfigComplete(config),
      connectivity,
      checking,
      applyDraft,
      recheckConnectivity,
    }),
    [config, connectivity, checking, applyDraft, recheckConnectivity],
  );

  return (
    <DemoConfigContext.Provider value={value}>
      {children}
    </DemoConfigContext.Provider>
  );
}

export function useDemoConfig(): DemoConfigContextValue {
  const ctx = useContext(DemoConfigContext);
  if (!ctx) {
    throw new Error('useDemoConfig must be used within DemoConfigProvider');
  }
  return ctx;
}

export function useConfigFingerprint(): string {
  const { config } = useDemoConfig();
  return configFingerprint(config);
}
