import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LeagueLoreImportBundle } from '@leaguelore/import-contract';
import type { DeepLinkSettings, HelperSettings, RuntimeConfig, SessionStatus, UploadResult } from '../shared/ipc';
import { currentSeasonYear, defaultLeagueLoreApiBaseUrl } from '../shared/environment';
import leagueLoreLogoUrl from '../../assets/league-lore-mark.png';

type Step = 'setup' | 'signin' | 'preview' | 'upload';

const DEFAULT_STATUS: SessionStatus = {
  isSignedIn: false,
  hasSwid: false,
  hasEspnS2: false,
  cookieCount: 0,
  domains: [],
  lastCheckedAt: new Date().toISOString()
};

const DEFAULT_SETTINGS: HelperSettings = {
  apiBaseUrl: defaultLeagueLoreApiBaseUrl(true),
  importToken: '',
  leagueId: ''
};

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  apiBaseUrl: DEFAULT_SETTINGS.apiBaseUrl,
  isDevelopment: false,
  mockImportsEnabled: false
};

export default function App() {
  const [version, setVersion] = useState('');
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(DEFAULT_RUNTIME_CONFIG);
  const [step, setStep] = useState<Step>('setup');
  const [settings, setSettings] = useState<HelperSettings>(DEFAULT_SETTINGS);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(DEFAULT_STATUS);
  const [bundle, setBundle] = useState<LeagueLoreImportBundle | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const deepLinkSettingsRef = useRef<DeepLinkSettings | null>(null);

  useEffect(() => {
    function applyDeepLink(parsed: DeepLinkSettings) {
      deepLinkSettingsRef.current = { ...(deepLinkSettingsRef.current ?? {}), ...parsed };
      setSettings((current) => ({ ...current, ...parsed }));
      setNotice('Import session loaded from LeagueLore. Review the details, then continue.');
    }

    const unsubscribe = window.leagueLore.onDeepLink(applyDeepLink);

    void window.leagueLore.appVersion().then(setVersion);
    void window.leagueLore.runtimeConfig().then((config) => {
      setRuntimeConfig(config);
      setSettings((current) => ({ ...current, apiBaseUrl: deepLinkSettingsRef.current?.apiBaseUrl ?? config.apiBaseUrl }));
    });
    void window.leagueLore.getSettings().then((loaded) => {
      const deepLinkSettings = deepLinkSettingsRef.current;
      setSettings(deepLinkSettings ? { ...loaded, ...deepLinkSettings } : loaded);
    });
    void refreshStatus();
    void window.leagueLore.rendererReady().then((pendingDeepLink) => {
      if (pendingDeepLink) applyDeepLink(pendingDeepLink);
    });

    return unsubscribe;
  }, []);

  const seasonIsValid = useMemo(() => settings.season === undefined || (Number.isInteger(settings.season) && settings.season >= 2000 && settings.season <= 2100), [settings.season]);
  const canImport = useMemo(() => Boolean(settings.leagueId.trim()) && seasonIsValid, [settings.leagueId, seasonIsValid]);

  async function refreshStatus() {
    const status = await window.leagueLore.getEspnSessionStatus();
    setSessionStatus(status);
    return status;
  }

  async function persistSettings(next = settings) {
    const saved = await window.leagueLore.saveSettings(next);
    setSettings(saved);
    return saved;
  }

  async function openEspn() {
    setBusy(true);
    setNotice(null);
    try {
      await persistSettings();
      await window.leagueLore.openEspnLogin({ leagueId: settings.leagueId, season: settings.season });
      setStep('signin');
      setNotice('Sign in directly with ESPN in the helper window. Then return here and click “Check ESPN Session”.');
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function importEspn() {
    setBusy(true);
    setNotice(null);
    setUploadResult(null);
    try {
      await persistSettings();
      const result = await window.leagueLore.importFromEspn({ leagueId: settings.leagueId, season: settings.season });
      setBundle(result.bundle);
      setStep('preview');
      setNotice(result.warnings.length ? result.warnings.join(' ') : 'Import bundle created locally and validated.');
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function importMock() {
    setBusy(true);
    setNotice(null);
    setUploadResult(null);
    try {
      await persistSettings();
      const result = await window.leagueLore.createMockImport({ leagueId: settings.leagueId || 'mock-league', season: settings.season ?? currentSeasonYear() });
      setBundle(result.bundle);
      setStep('preview');
      setNotice('Mock bundle created. Use this to test LeagueLore API integration without ESPN.');
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveBundle() {
    if (!bundle) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await window.leagueLore.saveBundleToDisk(bundle);
      if (!result.canceled) setNotice(`Saved import bundle to ${result.filePath}.`);
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (!bundle) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!settings.importToken.trim()) {
        setNotice('Open this helper from LeagueLore to upload a preview. You can still save the JSON locally.');
        return;
      }
      await persistSettings();
      const result = await window.leagueLore.uploadBundle({
        apiBaseUrl: settings.apiBaseUrl,
        importToken: settings.importToken,
        bundle
      });
      setUploadResult(result);
      setStep('upload');
      setNotice(result.message);
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function clearSession() {
    setBusy(true);
    setNotice(null);
    try {
      await window.leagueLore.clearEspnSession();
      await refreshStatus();
      setNotice('ESPN helper session cleared from this app.');
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <img className="brand-logo" src={leagueLoreLogoUrl} alt="LeagueLore" />
        <div>
          <p className="eyebrow">LeagueLore Import Helper {version ? `v${version}` : ''}</p>
          <h1>Import ESPN fantasy data without handing over your cookies.</h1>
          <p className="hero-copy">
            Sign in directly with ESPN in this helper. LeagueLore receives the normalized league data you approve — not your ESPN password or raw session cookies.
          </p>
        </div>
      </section>

      <section className="trust-grid">
        <TrustCard title="Local ESPN session" body="The helper uses its own isolated app session and never reads Chrome, Safari, or Firefox cookies." />
        <TrustCard title="No raw cookie upload" body="ESPN cookies stay local and are only used to request fantasy data from ESPN on your computer." />
        <TrustCard title="Review before upload" body="Export the JSON first or upload it to LeagueLore for a server-side preview before committing." />
      </section>

      <section className="panel layout">
        <aside className="steps">
          <StepButton active={step === 'setup'} number="1" title="Setup" body="League and optional start year" onClick={() => setStep('setup')} />
          <StepButton active={step === 'signin'} number="2" title="ESPN Sign-in" body="Authenticate directly with ESPN" onClick={() => setStep('signin')} />
          <StepButton active={step === 'preview'} number="3" title="Preview" body="Validate and inspect local bundle" onClick={() => setStep('preview')} />
          <StepButton active={step === 'upload'} number="4" title="Send" body="Upload or save JSON" onClick={() => setStep('upload')} />
        </aside>

        <div className="content">
          {notice && <div className="notice">{notice}</div>}
          {step === 'setup' && (
            <SetupStep settings={settings} setSettings={setSettings} busy={busy} canContinue={canImport} mockImportsEnabled={runtimeConfig.mockImportsEnabled} onContinue={() => setStep('signin')} onMock={importMock} />
          )}
          {step === 'signin' && (
            <SignInStep
              settings={settings}
              status={sessionStatus}
              busy={busy}
              canImport={canImport}
              onOpenEspn={openEspn}
              onRefresh={refreshStatus}
              onClear={clearSession}
              onImport={importEspn}
              onMock={importMock}
              mockImportsEnabled={runtimeConfig.mockImportsEnabled}
            />
          )}
          {step === 'preview' && <PreviewStep bundle={bundle} busy={busy} mockImportsEnabled={runtimeConfig.mockImportsEnabled} onSave={saveBundle} onUpload={upload} />}
          {step === 'upload' && <UploadStep bundle={bundle} result={uploadResult} busy={busy} mockImportsEnabled={runtimeConfig.mockImportsEnabled} onSave={saveBundle} onUpload={upload} />}
        </div>
      </section>
    </main>
  );
}

function TrustCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="trust-card">
      <div className="trust-dot" />
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function StepButton({ active, number, title, body, onClick }: { active: boolean; number: string; title: string; body: string; onClick: () => void }) {
  return (
    <button className={`step-button ${active ? 'active' : ''}`} onClick={onClick}>
      <span>{number}</span>
      <strong>{title}</strong>
      <small>{body}</small>
    </button>
  );
}

function SetupStep({ settings, setSettings, busy, canContinue, mockImportsEnabled, onContinue, onMock }: {
  settings: HelperSettings;
  setSettings: (s: HelperSettings) => void;
  busy: boolean;
  canContinue: boolean;
  mockImportsEnabled: boolean;
  onContinue: () => void;
  onMock: () => void;
}) {
  function updateSeason(value: string) {
    setSettings({ ...settings, season: value.trim() ? Number(value) : undefined });
  }

  return (
    <section>
      <h2>Start with your LeagueLore import session</h2>
      <p className="muted">Open this helper from LeagueLore to preload the import session. The connection details stay hidden.</p>
      <div className="form-grid">
        <Field label="ESPN League ID">
          <input value={settings.leagueId} onChange={(event) => setSettings({ ...settings, leagueId: event.target.value })} placeholder="123456" />
        </Field>
        <Field label="Season start year (optional)">
          <input type="number" inputMode="numeric" min="2000" max="2100" value={settings.season ?? ''} onChange={(event) => updateSeason(event.target.value)} />
          <small>Leave blank when you do not want to limit the history import into LeagueLore workspace by start year.</small>
        </Field>
      </div>
      <div className="actions">
        <button className="primary" disabled={busy || !canContinue} onClick={onContinue}>Continue to ESPN Sign-in</button>
        {mockImportsEnabled && <button disabled={busy} onClick={onMock}>Create Mock Import</button>}
      </div>
    </section>
  );
}

function SignInStep({ settings, status, busy, canImport, onOpenEspn, onRefresh, onClear, onImport, onMock, mockImportsEnabled }: {
  settings: HelperSettings;
  status: SessionStatus;
  busy: boolean;
  canImport: boolean;
  onOpenEspn: () => void;
  onRefresh: () => void;
  onClear: () => void;
  onImport: () => void;
  onMock: () => void;
  mockImportsEnabled: boolean;
}) {
  return (
    <section>
      <h2>Sign in directly with ESPN</h2>
      <p className="muted">The helper will open ESPN in a separate window. After signing in, return here and check the session.</p>
      <div className="session-card">
        <div>
          <p className="eyebrow">Session status</p>
          <h3>{status.isSignedIn ? 'ESPN session detected' : 'Not signed in yet'}</h3>
          <p className="muted">SWID: {status.hasSwid ? 'detected' : 'missing'} · espn_s2: {status.hasEspnS2 ? 'detected' : 'missing'} · cookies: {status.cookieCount}</p>
        </div>
        <div className={`status-pill ${status.isSignedIn ? 'good' : 'warn'}`}>{status.isSignedIn ? 'Ready' : 'Needs sign-in'}</div>
      </div>
      <div className="actions">
        <button className="primary" disabled={busy || !canImport} onClick={onOpenEspn}>Open ESPN Sign-in</button>
        <button disabled={busy} onClick={onRefresh}>Check ESPN Session</button>
        <button disabled={busy} onClick={onClear}>Clear ESPN Session</button>
      </div>
      <div className="actions split-actions">
        <button className="primary" disabled={busy || !canImport || !status.isSignedIn} onClick={onImport}>Import from ESPN</button>
        {mockImportsEnabled && <button disabled={busy} onClick={onMock}>Create Mock Import Instead</button>}
      </div>
    </section>
  );
}

function PreviewStep({ bundle, busy, mockImportsEnabled, onSave, onUpload }: { bundle: LeagueLoreImportBundle | null; busy: boolean; mockImportsEnabled: boolean; onSave: () => void; onUpload: () => void }) {
  if (!bundle) return <EmptyState title="No bundle yet" body={mockImportsEnabled ? 'Import from ESPN or create a mock import first.' : 'Import from ESPN first.'} />;
  return (
    <section>
      <h2>Review import bundle</h2>
      <p className="muted">This bundle has been validated against the shared LeagueLore import contract.</p>
      <BundleSummary bundle={bundle} />
      <div className="actions">
        <button disabled={busy} onClick={onSave}>Save JSON Locally</button>
        <button className="primary" disabled={busy} onClick={onUpload}>Upload to LeagueLore Preview</button>
      </div>
      <details className="json-preview">
        <summary>Inspect JSON</summary>
        <pre>{JSON.stringify(bundle, null, 2)}</pre>
      </details>
    </section>
  );
}

function UploadStep({ bundle, result, busy, mockImportsEnabled, onSave, onUpload }: { bundle: LeagueLoreImportBundle | null; result: UploadResult | null; busy: boolean; mockImportsEnabled: boolean; onSave: () => void; onUpload: () => void }) {
  if (!bundle) return <EmptyState title="No bundle yet" body={mockImportsEnabled ? 'Import from ESPN or create a mock import first.' : 'Import from ESPN first.'} />;
  return (
    <section>
      <h2>Send to LeagueLore</h2>
      <BundleSummary bundle={bundle} />
      {result && (
        <div className={`upload-result ${result.ok ? 'good' : 'bad'}`}>
          <strong>{result.ok ? 'Upload accepted' : 'Upload failed'}</strong>
          <p>{result.message}</p>
          {result.response ? <pre>{JSON.stringify(result.response, null, 2)}</pre> : null}
        </div>
      )}
      <div className="actions">
        <button disabled={busy} onClick={onSave}>Save JSON Locally</button>
        <button className="primary" disabled={busy} onClick={onUpload}>Upload Again</button>
      </div>
    </section>
  );
}

function BundleSummary({ bundle }: { bundle: LeagueLoreImportBundle }) {
  return (
    <div className="summary-grid">
      <Summary label="League" value={bundle.league.name} />
      <Summary label="Season" value={String(bundle.league.season)} />
      <Summary label="Teams" value={String(bundle.teams.length)} />
      <Summary label="Roster Entries" value={String(bundle.rosterEntries.length)} />
      <Summary label="Matchups" value={String(bundle.matchups.length)} />
      <Summary label="Draft Picks" value={String(bundle.draftPicks.length)} />
      <Summary label="Transactions" value={String(bundle.transactions.length)} />
      <Summary label="Contract" value={bundle.metadata.contractVersion} />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
