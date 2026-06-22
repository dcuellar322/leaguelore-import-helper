import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LeagueLoreImportBundle } from '@leaguelore/import-contract';
import type { HelperSettings, SessionStatus, UploadResult } from '../shared/ipc';

type Step = 'setup' | 'signin' | 'preview' | 'upload';

const DEFAULT_STATUS: SessionStatus = {
  isSignedIn: false,
  hasSwid: false,
  hasEspnS2: false,
  cookieCount: 0,
  domains: [],
  lastCheckedAt: new Date().toISOString()
};

export default function App() {
  const [version, setVersion] = useState('');
  const [step, setStep] = useState<Step>('setup');
  const [settings, setSettings] = useState<HelperSettings>({ apiBaseUrl: 'http://localhost:8000', importToken: '', leagueId: '', season: new Date().getFullYear() });
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(DEFAULT_STATUS);
  const [bundle, setBundle] = useState<LeagueLoreImportBundle | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    void window.leagueLore.appVersion().then(setVersion);
    void window.leagueLore.getSettings().then((loaded) => {
      setSettings(loaded);
    });
    void refreshStatus();

    const unsubscribe = window.leagueLore.onDeepLink((parsed) => {
      setSettings((current) => ({ ...current, ...parsed }));
      setNotice('Import session loaded from LeagueLore. Review the details, then continue.');
    });

    return unsubscribe;
  }, []);

  const canImport = useMemo(() => Boolean(settings.leagueId.trim()) && settings.season >= 2000, [settings]);

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
      const result = await window.leagueLore.createMockImport({ leagueId: settings.leagueId || 'mock-league', season: settings.season });
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
        <div className="brand-mark">LL</div>
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
          <StepButton active={step === 'setup'} number="1" title="Setup" body="League, season, and LeagueLore session" onClick={() => setStep('setup')} />
          <StepButton active={step === 'signin'} number="2" title="ESPN Sign-in" body="Authenticate directly with ESPN" onClick={() => setStep('signin')} />
          <StepButton active={step === 'preview'} number="3" title="Preview" body="Validate and inspect local bundle" onClick={() => setStep('preview')} />
          <StepButton active={step === 'upload'} number="4" title="Send" body="Upload or save JSON" onClick={() => setStep('upload')} />
        </aside>

        <div className="content">
          {notice && <div className="notice">{notice}</div>}
          {step === 'setup' && (
            <SetupStep settings={settings} setSettings={setSettings} busy={busy} onContinue={() => setStep('signin')} onMock={importMock} />
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
            />
          )}
          {step === 'preview' && <PreviewStep bundle={bundle} busy={busy} onSave={saveBundle} onUpload={upload} />}
          {step === 'upload' && <UploadStep bundle={bundle} result={uploadResult} busy={busy} onSave={saveBundle} onUpload={upload} />}
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

function SetupStep({ settings, setSettings, busy, onContinue, onMock }: { settings: HelperSettings; setSettings: (s: HelperSettings) => void; busy: boolean; onContinue: () => void; onMock: () => void }) {
  return (
    <section>
      <h2>Start with your LeagueLore import session</h2>
      <p className="muted">In production, LeagueLore should open this helper through a deep link and prefill the API URL and short-lived import token.</p>
      <div className="form-grid">
        <Field label="LeagueLore API URL">
          <input value={settings.apiBaseUrl} onChange={(event) => setSettings({ ...settings, apiBaseUrl: event.target.value })} placeholder="https://www.leagueloreapp.com" />
        </Field>
        <Field label="Import token">
          <input value={settings.importToken} onChange={(event) => setSettings({ ...settings, importToken: event.target.value })} placeholder="Created by LeagueLore" />
        </Field>
        <Field label="ESPN League ID">
          <input value={settings.leagueId} onChange={(event) => setSettings({ ...settings, leagueId: event.target.value })} placeholder="123456" />
        </Field>
        <Field label="Season">
          <input type="number" value={settings.season} onChange={(event) => setSettings({ ...settings, season: Number(event.target.value) })} />
        </Field>
      </div>
      <div className="actions">
        <button className="primary" disabled={busy} onClick={onContinue}>Continue to ESPN Sign-in</button>
        <button disabled={busy} onClick={onMock}>Create Mock Import</button>
      </div>
    </section>
  );
}

function SignInStep({ settings, status, busy, canImport, onOpenEspn, onRefresh, onClear, onImport, onMock }: {
  settings: HelperSettings;
  status: SessionStatus;
  busy: boolean;
  canImport: boolean;
  onOpenEspn: () => void;
  onRefresh: () => void;
  onClear: () => void;
  onImport: () => void;
  onMock: () => void;
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
        <button className="primary" disabled={busy || !settings.leagueId} onClick={onOpenEspn}>Open ESPN Sign-in</button>
        <button disabled={busy} onClick={onRefresh}>Check ESPN Session</button>
        <button disabled={busy} onClick={onClear}>Clear ESPN Session</button>
      </div>
      <div className="actions split-actions">
        <button className="primary" disabled={busy || !canImport || !status.isSignedIn} onClick={onImport}>Import from ESPN</button>
        <button disabled={busy} onClick={onMock}>Create Mock Import Instead</button>
      </div>
    </section>
  );
}

function PreviewStep({ bundle, busy, onSave, onUpload }: { bundle: LeagueLoreImportBundle | null; busy: boolean; onSave: () => void; onUpload: () => void }) {
  if (!bundle) return <EmptyState title="No bundle yet" body="Import from ESPN or create a mock import first." />;
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

function UploadStep({ bundle, result, busy, onSave, onUpload }: { bundle: LeagueLoreImportBundle | null; result: UploadResult | null; busy: boolean; onSave: () => void; onUpload: () => void }) {
  if (!bundle) return <EmptyState title="No bundle yet" body="Import from ESPN or create a mock import first." />;
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
