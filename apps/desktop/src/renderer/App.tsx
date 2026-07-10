import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LeagueLoreImportBundle } from '@leaguelore/import-contract';
import type { DeepLinkSettings, HelperSettings, RuntimeConfig, SessionStatus, UploadResult } from '../shared/ipc';
import { currentSeasonYear, defaultLeagueLoreApiBaseUrl } from '../shared/environment';
import leagueLoreLogoUrl from '../../assets/league-lore-mark.png';

type Step = 'setup' | 'signin' | 'preview' | 'upload';
type BusyAction = 'opening-espn' | 'checking-session' | 'clearing-session' | 'importing' | 'mocking' | 'saving' | 'uploading';
type Notice = { tone: 'info' | 'success' | 'error'; title: string; message: string };
type IconName = 'arrow' | 'check' | 'chevron' | 'download' | 'external' | 'file' | 'lock' | 'refresh' | 'shield' | 'upload';

const STEPS: Step[] = ['setup', 'signin', 'preview', 'upload'];

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
  leagueId: '',
  season: currentSeasonYear()
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
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const deepLinkSettingsRef = useRef<DeepLinkSettings | null>(null);

  useEffect(() => {
    function withSeasonFallback(next: HelperSettings): HelperSettings {
      return { ...next, season: next.season ?? currentSeasonYear() };
    }

    function applyDeepLink(parsed: DeepLinkSettings) {
      deepLinkSettingsRef.current = { ...(deepLinkSettingsRef.current ?? {}), ...parsed };
      setSettings((current) => withSeasonFallback({ ...current, ...parsed }));
      setNotice({
        tone: 'success',
        title: 'Connected to LeagueLore',
        message: 'Your league details and secure import session are ready. Confirm them below to continue.'
      });
    }

    const unsubscribe = window.leagueLore.onDeepLink(applyDeepLink);

    void window.leagueLore.appVersion().then(setVersion);
    void window.leagueLore.runtimeConfig().then((config) => {
      setRuntimeConfig(config);
      setSettings((current) => ({ ...current, apiBaseUrl: deepLinkSettingsRef.current?.apiBaseUrl ?? config.apiBaseUrl }));
    });
    void window.leagueLore.getSettings().then((loaded) => {
      const deepLinkSettings = deepLinkSettingsRef.current;
      setSettings(withSeasonFallback(deepLinkSettings ? { ...loaded, ...deepLinkSettings } : loaded));
    });
    void refreshStatus();
    void window.leagueLore.rendererReady().then((pendingDeepLink) => {
      if (pendingDeepLink) applyDeepLink(pendingDeepLink);
    });

    return unsubscribe;
  }, []);

  const seasonIsValid = useMemo(
    () => settings.season !== undefined && Number.isInteger(settings.season) && settings.season >= 2000 && settings.season <= 2100,
    [settings.season]
  );
  const canImport = useMemo(() => Boolean(settings.leagueId.trim()) && seasonIsValid, [settings.leagueId, seasonIsValid]);
  const canUpload = Boolean(settings.importToken.trim());
  const stepIndex = STEPS.indexOf(step);

  async function refreshStatus() {
    const status = await window.leagueLore.getEspnSessionStatus();
    setSessionStatus(status);
    return status;
  }

  async function checkSession() {
    setBusyAction('checking-session');
    setNotice(null);
    try {
      const status = await refreshStatus();
      setNotice(status.isSignedIn
        ? { tone: 'success', title: 'ESPN session ready', message: 'Both required ESPN session credentials were detected locally. You can import now.' }
        : { tone: 'info', title: 'Sign-in not detected yet', message: 'Finish signing in within the ESPN window, then return here and check again.' });
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  }

  async function persistSettings(next = settings) {
    const saved = await window.leagueLore.saveSettings(next);
    setSettings(saved);
    return saved;
  }

  async function openEspn() {
    setBusyAction('opening-espn');
    setNotice(null);
    try {
      await persistSettings();
      await window.leagueLore.openEspnLogin({ leagueId: settings.leagueId, season: settings.season });
      setStep('signin');
      setNotice({
        tone: 'info',
        title: 'ESPN opened in a separate window',
        message: 'Sign in there, then return to this window and choose “Check sign-in status.”'
      });
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  }

  async function importEspn() {
    setBusyAction('importing');
    setNotice(null);
    setUploadResult(null);
    try {
      await persistSettings();
      const result = await window.leagueLore.importFromEspn({ leagueId: settings.leagueId, season: settings.season });
      setBundle(result.bundle);
      setStep('preview');
      setNotice(result.warnings.length
        ? { tone: 'info', title: 'Import ready with notes', message: result.warnings.join(' ') }
        : { tone: 'success', title: 'Import ready to review', message: 'Your ESPN data was normalized and validated locally.' });
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  }

  async function importMock() {
    setBusyAction('mocking');
    setNotice(null);
    setUploadResult(null);
    try {
      await persistSettings();
      const result = await window.leagueLore.createMockImport({ leagueId: settings.leagueId || 'mock-league', season: settings.season ?? currentSeasonYear() });
      setBundle(result.bundle);
      setStep('preview');
      setNotice({ tone: 'info', title: 'Development preview', message: 'Mock data was created locally. No request was made to ESPN.' });
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  }

  async function saveBundle() {
    if (!bundle) return;
    setBusyAction('saving');
    setNotice(null);
    try {
      const result = await window.leagueLore.saveBundleToDisk(bundle);
      if (!result.canceled) {
        setNotice({ tone: 'success', title: 'JSON saved locally', message: result.filePath ?? 'Your import bundle was saved.' });
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  }

  async function upload() {
    if (!bundle) return;
    if (!canUpload) {
      setNotice({
        tone: 'info',
        title: 'Open this helper from LeagueLore to send data',
        message: 'This manual session can save JSON locally, but it does not include a secure LeagueLore upload token.'
      });
      return;
    }
    setBusyAction('uploading');
    setNotice(null);
    try {
      await persistSettings();
      const result = await window.leagueLore.uploadBundle({
        apiBaseUrl: settings.apiBaseUrl,
        importToken: settings.importToken,
        bundle
      });
      setUploadResult(result);
      setStep('upload');
      setNotice(null);
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  }

  async function clearSession() {
    setBusyAction('clearing-session');
    setNotice(null);
    try {
      await window.leagueLore.clearEspnSession();
      await refreshStatus();
      setNotice({ tone: 'success', title: 'ESPN session cleared', message: 'The helper removed its locally stored ESPN session.' });
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  }

  function showError(error: unknown) {
    setNotice({ tone: 'error', title: 'Something needs attention', message: formatError(error) });
  }

  function goToStep(nextStep: Step) {
    const nextIndex = STEPS.indexOf(nextStep);
    if (nextIndex <= 1 || bundle) {
      setStep(nextStep);
      setNotice(null);
    }
  }

  return (
    <main className="shell">
      <header className="app-header">
        <div className="brand-lockup">
          <img className="brand-logo" src={leagueLoreLogoUrl} alt="" />
          <div>
            <p className="eyebrow">LeagueLore</p>
            <h1>ESPN Import Helper</h1>
          </div>
        </div>
        <div className="secure-badge"><Icon name="shield" /> Secure local helper {version ? `· v${version}` : ''}</div>
      </header>

      <section className="intro">
        <div>
          <h2>Bring your ESPN league into LeagueLore.</h2>
          <p>Sign in directly with ESPN, review the normalized data, then choose exactly what leaves your computer.</p>
        </div>
        <div className="privacy-points" aria-label="Privacy protections">
          <span><Icon name="lock" /> Cookies stay local</span>
          <span><Icon name="check" /> Review before sending</span>
        </div>
      </section>

      <section className="panel layout">
        <aside className="steps" aria-label="Import progress">
          <div className="steps-heading">
            <p className="eyebrow">Import progress</p>
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
          </div>
          <nav>
            <StepButton state={step === 'setup' ? 'active' : stepIndex > 0 ? 'complete' : 'available'} number="1" title="League details" body="Choose league and season" onClick={() => goToStep('setup')} />
            <StepButton state={step === 'signin' ? 'active' : stepIndex > 1 ? 'complete' : canImport ? 'available' : 'locked'} number="2" title="Connect ESPN" body="Sign in securely" onClick={() => goToStep('signin')} />
            <StepButton state={step === 'preview' ? 'active' : stepIndex > 2 ? 'complete' : bundle ? 'available' : 'locked'} number="3" title="Review data" body="Inspect the local bundle" onClick={() => goToStep('preview')} />
            <StepButton state={step === 'upload' ? 'active' : bundle ? 'available' : 'locked'} number="4" title="Finish" body="Save or send to LeagueLore" onClick={() => goToStep('upload')} />
          </nav>
          <div className="privacy-note">
            <Icon name="shield" />
            <div><strong>Your ESPN password never enters LeagueLore.</strong><span>Authentication happens only in this helper.</span></div>
          </div>
        </aside>

        <div className="content">
          {notice && <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />}
          {step === 'setup' && (
            <SetupStep
              settings={settings}
              setSettings={setSettings}
              busyAction={busyAction}
              canContinue={canImport}
              seasonIsValid={seasonIsValid}
              hasImportSession={canUpload}
              mockImportsEnabled={runtimeConfig.mockImportsEnabled}
              onContinue={() => goToStep('signin')}
              onMock={importMock}
            />
          )}
          {step === 'signin' && (
            <SignInStep
              settings={settings}
              status={sessionStatus}
              busyAction={busyAction}
              canImport={canImport}
              onOpenEspn={openEspn}
              onRefresh={checkSession}
              onClear={clearSession}
              onImport={importEspn}
              onMock={importMock}
              mockImportsEnabled={runtimeConfig.mockImportsEnabled}
            />
          )}
          {step === 'preview' && <PreviewStep bundle={bundle} busyAction={busyAction} canUpload={canUpload} mockImportsEnabled={runtimeConfig.mockImportsEnabled} onSave={saveBundle} onUpload={upload} />}
          {step === 'upload' && <UploadStep bundle={bundle} result={uploadResult} busyAction={busyAction} canUpload={canUpload} mockImportsEnabled={runtimeConfig.mockImportsEnabled} onSave={saveBundle} onUpload={upload} />}
        </div>
      </section>
    </main>
  );
}

function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  return (
    <div className={`notice ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <span className="notice-icon"><Icon name={notice.tone === 'success' ? 'check' : notice.tone === 'error' ? 'external' : 'shield'} /></span>
      <div><strong>{notice.title}</strong><p>{notice.message}</p></div>
      <button className="icon-button" aria-label="Dismiss message" onClick={onDismiss}>×</button>
    </div>
  );
}

function StepButton({ state, number, title, body, onClick }: { state: 'active' | 'complete' | 'available' | 'locked'; number: string; title: string; body: string; onClick: () => void }) {
  return (
    <button className={`step-button ${state}`} onClick={onClick} disabled={state === 'locked'} aria-current={state === 'active' ? 'step' : undefined}>
      <span className="step-number">{state === 'complete' ? <Icon name="check" /> : number}</span>
      <strong>{title}</strong>
      <small>{body}</small>
      <Icon name="chevron" />
    </button>
  );
}

function SetupStep({ settings, setSettings, busyAction, canContinue, seasonIsValid, hasImportSession, mockImportsEnabled, onContinue, onMock }: {
  settings: HelperSettings;
  setSettings: (settings: HelperSettings) => void;
  busyAction: BusyAction | null;
  canContinue: boolean;
  seasonIsValid: boolean;
  hasImportSession: boolean;
  mockImportsEnabled: boolean;
  onContinue: () => void;
  onMock: () => void;
}) {
  function updateSeason(value: string) {
    setSettings({ ...settings, season: value.trim() ? Number(value) : undefined });
  }

  return (
    <section className="step-content">
      <StepHeader kicker="Step 1" title="Confirm your league" body="We use these details to request the correct ESPN season. You can review everything before it is sent anywhere." />
      <div className={`connection-card ${hasImportSession ? 'connected' : ''}`}>
        <span className="connection-icon"><Icon name={hasImportSession ? 'check' : 'external'} /></span>
        <div>
          <strong>{hasImportSession ? 'LeagueLore session connected' : 'Manual setup'}</strong>
          <p>{hasImportSession ? 'A secure, one-time upload session was provided by LeagueLore.' : 'You can create and save an import locally. Open the helper from LeagueLore when you are ready to send it.'}</p>
        </div>
      </div>
      <div className="form-grid">
        <Field label="ESPN League ID" hint="Find this number in your ESPN league URL.">
          <input value={settings.leagueId} onChange={(event) => setSettings({ ...settings, leagueId: event.target.value.trim() })} placeholder="e.g. 123456" autoComplete="off" />
        </Field>
        <Field label="ESPN season" hint="Confirm the year you want to import." error={!seasonIsValid ? 'Enter a year from 2000 to 2100.' : undefined}>
          <input type="number" inputMode="numeric" min="2000" max="2100" value={settings.season ?? ''} onChange={(event) => updateSeason(event.target.value)} aria-invalid={!seasonIsValid} />
        </Field>
      </div>
      <div className="actions step-actions">
        <button className="primary" disabled={Boolean(busyAction) || !canContinue} onClick={onContinue}>Continue <Icon name="arrow" /></button>
        {mockImportsEnabled && <button className="text-button" disabled={Boolean(busyAction)} onClick={onMock}>{busyAction === 'mocking' ? 'Creating preview…' : 'Use development data'}</button>}
      </div>
    </section>
  );
}

function SignInStep({ settings, status, busyAction, canImport, onOpenEspn, onRefresh, onClear, onImport, onMock, mockImportsEnabled }: {
  settings: HelperSettings;
  status: SessionStatus;
  busyAction: BusyAction | null;
  canImport: boolean;
  onOpenEspn: () => void;
  onRefresh: () => void;
  onClear: () => void;
  onImport: () => void;
  onMock: () => void;
  mockImportsEnabled: boolean;
}) {
  const busy = Boolean(busyAction);
  return (
    <section className="step-content">
      <StepHeader kicker="Step 2" title="Connect to ESPN" body={`Sign in for league ${settings.leagueId}, season ${settings.season}. ESPN opens in a separate, isolated window.`} />
      <div className="instruction-row" aria-label="Sign-in instructions">
        <Instruction number="1" text="Open ESPN" />
        <Instruction number="2" text="Sign in there" />
        <Instruction number="3" text="Return and check status" />
      </div>
      <div className={`session-card ${status.isSignedIn ? 'ready' : ''}`}>
        <div className="session-heading">
          <span className="session-icon"><Icon name={status.isSignedIn ? 'check' : 'lock'} /></span>
          <div>
            <p className="eyebrow">ESPN connection</p>
            <h3>{status.isSignedIn ? 'Ready to import' : 'Waiting for sign-in'}</h3>
          </div>
          <span className={`status-pill ${status.isSignedIn ? 'good' : 'warn'}`}>{status.isSignedIn ? 'Connected' : 'Not connected'}</span>
        </div>
        <div className="credential-checks">
          <CredentialCheck label="ESPN identity" detected={status.hasSwid} />
          <CredentialCheck label="ESPN session" detected={status.hasEspnS2} />
        </div>
        <p className="session-detail">These credentials remain encrypted in the helper's isolated local session and are never uploaded.</p>
      </div>
      <div className="actions step-actions">
        {!status.isSignedIn ? (
          <>
            <button className="primary" disabled={busy || !canImport} onClick={onOpenEspn}>{busyAction === 'opening-espn' ? 'Opening ESPN…' : 'Open ESPN sign-in'} <Icon name="external" /></button>
            <button disabled={busy} onClick={onRefresh}>{busyAction === 'checking-session' ? 'Checking…' : 'Check sign-in status'} <Icon name="refresh" /></button>
          </>
        ) : (
          <button className="primary" disabled={busy || !canImport} onClick={onImport}>{busyAction === 'importing' ? 'Importing and validating…' : 'Import this ESPN season'} <Icon name="arrow" /></button>
        )}
        <button className="text-button danger" disabled={busy} onClick={onClear}>{busyAction === 'clearing-session' ? 'Clearing…' : 'Clear local ESPN session'}</button>
      </div>
      {mockImportsEnabled && <div className="developer-option"><span>Development mode</span><button className="text-button" disabled={busy} onClick={onMock}>{busyAction === 'mocking' ? 'Creating…' : 'Preview with mock data'}</button></div>}
    </section>
  );
}

function PreviewStep({ bundle, busyAction, canUpload, mockImportsEnabled, onSave, onUpload }: { bundle: LeagueLoreImportBundle | null; busyAction: BusyAction | null; canUpload: boolean; mockImportsEnabled: boolean; onSave: () => void; onUpload: () => void }) {
  if (!bundle) return <EmptyState title="Nothing to review yet" body={mockImportsEnabled ? 'Connect to ESPN or use development data to create an import.' : 'Connect to ESPN to create an import first.'} />;
  const busy = Boolean(busyAction);
  return (
    <section className="step-content">
      <StepHeader kicker="Step 3" title="Review your import" body="This is the complete, validated data bundle. ESPN passwords and raw session cookies are never included." />
      <BundleHero bundle={bundle} />
      <BundleSummary bundle={bundle} />
      <div className="actions step-actions">
        <button disabled={busy} onClick={onSave}>{busyAction === 'saving' ? 'Saving…' : 'Save JSON locally'} <Icon name="download" /></button>
        <button className="primary" disabled={busy || !canUpload} onClick={onUpload}>{busyAction === 'uploading' ? 'Sending securely…' : 'Send to LeagueLore'} <Icon name="upload" /></button>
      </div>
      {!canUpload && <p className="action-note"><Icon name="lock" /> Sending is available when this helper is opened from LeagueLore. Local export is always available.</p>}
      <details className="json-preview">
        <summary><Icon name="file" /> Inspect complete JSON <Icon name="chevron" /></summary>
        <pre>{JSON.stringify(bundle, null, 2)}</pre>
      </details>
    </section>
  );
}

function UploadStep({ bundle, result, busyAction, canUpload, mockImportsEnabled, onSave, onUpload }: { bundle: LeagueLoreImportBundle | null; result: UploadResult | null; busyAction: BusyAction | null; canUpload: boolean; mockImportsEnabled: boolean; onSave: () => void; onUpload: () => void }) {
  if (!bundle) return <EmptyState title="No import to finish" body={mockImportsEnabled ? 'Connect to ESPN or use development data first.' : 'Connect to ESPN and review an import first.'} />;
  const busy = Boolean(busyAction);
  return (
    <section className="step-content">
      <StepHeader kicker="Step 4" title={result?.ok ? 'Import delivered' : 'Finish your import'} body={result?.ok ? 'LeagueLore received the reviewed bundle and will guide you through the final preview.' : 'Save a local copy or send the reviewed bundle to LeagueLore.'} />
      {result ? (
        <div className={`result-card ${result.ok ? 'good' : 'bad'}`}>
          <span className="result-icon"><Icon name={result.ok ? 'check' : 'external'} /></span>
          <div><strong>{result.ok ? 'LeagueLore received your data' : 'The upload did not complete'}</strong><p>{result.message}</p></div>
        </div>
      ) : <BundleHero bundle={bundle} compact />}
      <div className="actions step-actions">
        <button disabled={busy} onClick={onSave}>{busyAction === 'saving' ? 'Saving…' : 'Save JSON locally'} <Icon name="download" /></button>
        <button className="primary" disabled={busy || !canUpload} onClick={onUpload}>{busyAction === 'uploading' ? 'Sending securely…' : result?.ok ? 'Send again' : 'Send to LeagueLore'} <Icon name="upload" /></button>
      </div>
      {!canUpload && <p className="action-note"><Icon name="lock" /> Open this helper from LeagueLore to enable secure sending.</p>}
      {result?.response ? <details className="json-preview"><summary><Icon name="file" /> View LeagueLore response <Icon name="chevron" /></summary><pre>{JSON.stringify(result.response, null, 2)}</pre></details> : null}
    </section>
  );
}

function StepHeader({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return <header className="step-header"><p className="eyebrow">{kicker}</p><h2>{title}</h2><p>{body}</p></header>;
}

function Instruction({ number, text }: { number: string; text: string }) {
  return <div className="instruction"><span>{number}</span><strong>{text}</strong></div>;
}

function CredentialCheck({ label, detected }: { label: string; detected: boolean }) {
  return <div className={detected ? 'detected' : ''}><span><Icon name={detected ? 'check' : 'lock'} /></span><strong>{label}</strong><small>{detected ? 'Detected locally' : 'Waiting'}</small></div>;
}

function BundleHero({ bundle, compact = false }: { bundle: LeagueLoreImportBundle; compact?: boolean }) {
  return (
    <div className={`bundle-hero ${compact ? 'compact' : ''}`}>
      <span className="bundle-icon"><Icon name="file" /></span>
      <div><p className="eyebrow">Validated import bundle</p><h3>{bundle.league.name}</h3><p>ESPN season {bundle.league.season} · {bundle.teams.length} teams</p></div>
      <span className="validated-badge"><Icon name="check" /> Validated</span>
    </div>
  );
}

function BundleSummary({ bundle }: { bundle: LeagueLoreImportBundle }) {
  const items = [
    ['Teams', bundle.teams.length],
    ['Roster entries', bundle.rosterEntries.length],
    ['Matchups', bundle.matchups.length],
    ['Draft picks', bundle.draftPicks.length],
    ['Transactions', bundle.transactions.length],
    ['Contract', bundle.metadata.contractVersion]
  ];
  return <div className="summary-grid">{items.map(([label, value]) => <Summary key={label} label={String(label)} value={String(value)} />)}</div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="summary-item"><strong>{value}</strong><small>{label}</small></div>;
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return <label className={`field ${error ? 'invalid' : ''}`}><span>{label}</span>{children}<small>{error ?? hint}</small></label>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty"><span><Icon name="file" /></span><h2>{title}</h2><p>{body}</p></div>;
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    download: <><path d="M12 3v12m-4-4 4 4 4-4" /><path d="M5 20h14" /></>,
    external: <><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></>,
    file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M18 12a6 6 0 0 0-10-4L4 12m16 0-4 4a6 6 0 0 1-10-4" /></>,
    shield: <path d="M12 3 4.5 6v5.5c0 4.5 3 7.7 7.5 9.5 4.5-1.8 7.5-5 7.5-9.5V6z" />,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M5 20h14" /></>
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
