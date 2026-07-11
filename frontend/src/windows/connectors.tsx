import { useEffect, useRef, useState } from 'react';

import type { ConnectorTestResult } from '@/lib/agent-socket';
import type { CatalogEntry } from '@/lib/connector-catalog';
import type { ConnectorConfig, OAuthPreset } from '@vox/protocol';

import { invoke } from '@tauri-apps/api/core';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { startOAuth, testConnector } from '@/lib/agent-socket';
import { CONNECTOR_CATALOG } from '@/lib/connector-catalog';
import { cn } from '@/lib/utils';
import { useConnectorsStore } from '@/stores/connectors';

/** Connectors tab: add/remove/enable MCP servers, test + tool list (P5). */
export default function ConnectorsView() {
  const { connectors, loaded, refresh } = useConnectorsStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className='flex h-full flex-col gap-4 overflow-y-auto px-8 py-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-ink text-[19px] font-bold tracking-[-0.01em]'>Connectors</h1>
          <p className='text-sm text-gray-500'>
            MCP servers Vox can use. New servers stay off until you enable them.
          </p>
        </div>
        <div className='flex gap-2'>
          <DirectoryDialog />
          <AddConnectorDialog />
        </div>
      </div>

      {loaded && connectors.length === 0 ? (
        <div className='flex flex-1 flex-col items-center justify-center gap-1'>
          <p className='text-sm text-gray-500'>No connectors yet.</p>
          <p className='mono-label text-gray-400'>browse the directory to get started</p>
        </div>
      ) : (
        <div className='flex flex-col gap-2'>
          {connectors.map((connector) => (
            <ConnectorRow key={connector.id} connector={connector} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectorRow({ connector }: Readonly<{ connector: ConnectorConfig }>) {
  const { setEnabled, remove } = useConnectorsStore();
  const [test, setTest] = useState<ConnectorTestResult | null>(null);
  // Enabled rows start in "testing": the mount probe below resolves it.
  const [testing, setTesting] = useState(connector.enabled);
  const [reauth, setReauth] = useState<'idle' | 'running' | 'creds'>('idle');
  const probed = useRef(false);

  const runTest = () => {
    setTesting(true);
    setTest(null);
    void testConnector(connector).then((result) => {
      setTest(result);
      setTesting(false);
    });
  };

  // Passive status: probe each enabled connector once when the row mounts.
  useEffect(() => {
    if (connector.enabled && !probed.current) {
      probed.current = true;
      void testConnector(connector).then((result) => {
        setTest(result);
        setTesting(false);
      });
    }
  }, [connector]);

  // Reconnect is offered for connectors backed by a browser sign-in.
  const catalogEntry = CONNECTOR_CATALOG.find(
    (entry) => entry.url !== undefined && entry.url === connector.url
  );
  const oauthEntry =
    catalogEntry?.auth === 'oauth' || catalogEntry?.auth === 'oauth-preset'
      ? catalogEntry
      : undefined;

  const reconnect = async (creds?: { clientId: string; clientSecret: string }) => {
    if (oauthEntry === undefined || connector.secret_ref == null) {
      return;
    }
    setReauth('running');
    setTest(null);
    const preset =
      oauthEntry.auth === 'oauth-preset'
        ? buildPresetPayload(oauthEntry, creds?.clientId, creds?.clientSecret)
        : undefined;
    const result = await startOAuth(
      connector.url ?? '',
      connector.secret_ref,
      connector.name,
      preset
    );
    if (!result.ok) {
      // The stored token set is gone — fall back to asking for the client.
      if (result.error?.includes('client credentials required') === true) {
        setReauth('creds');
        return;
      }
      setTest({ ok: false, tools: [], error: result.error ?? 'authorization failed' });
      setReauth('idle');
      return;
    }
    setReauth('idle');
    runTest();
  };

  const status = connectorStatus(connector.enabled, testing || reauth === 'running', test);
  const monogram = connector.name.slice(0, 2).toUpperCase();
  const detail =
    connector.transport === 'stdio'
      ? `stdio · ${connector.command ?? ''} ${(connector.args ?? []).join(' ')}`
      : `remote · ${connector.url ?? ''}`;

  return (
    <div className='shadow-card flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3'>
      <div className='flex items-center gap-3'>
        <span className='bg-vox-50 text-vox-800 flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold'>
          {monogram}
        </span>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <p className='text-ink truncate text-sm font-semibold'>{connector.name}</p>
            {test?.ok ? <Badge variant='secondary'>{test.tools.length} tools</Badge> : null}
          </div>
          <p className='truncate font-mono text-[11px] text-gray-500' title={detail}>
            {detail}
          </p>
        </div>
        <StatusIndicator status={status} test={test} />
        <Button variant='outline' size='sm' disabled={testing} onClick={runTest}>
          {testing ? 'Testing…' : 'Test'}
        </Button>
        {oauthEntry === undefined ? null : (
          <Button
            variant='outline'
            size='sm'
            disabled={reauth === 'running'}
            onClick={() => void reconnect()}
          >
            {reauth === 'running' ? 'Authorizing…' : 'Reconnect'}
          </Button>
        )}
        <Button
          variant={connector.enabled ? 'secondary' : 'default'}
          size='sm'
          onClick={() => void setEnabled(connector.id, !connector.enabled)}
        >
          {connector.enabled ? 'Disable' : 'Enable'}
        </Button>
        <Button variant='ghost' size='sm' onClick={() => void remove(connector.id)}>
          Remove
        </Button>
      </div>

      {reauth === 'creds' ? (
        <ClientCredsForm
          idPrefix={`row-${connector.id}`}
          submitLabel='Authorize'
          onSubmit={(creds) => void reconnect(creds)}
          onCancel={() => {
            setReauth('idle');
          }}
        >
          <p className='mono-label text-gray-500'>
            no stored sign-in found — paste the OAuth client from Google Cloud Console
          </p>
        </ClientCredsForm>
      ) : null}

      {test === null ? null : (
        <p
          className={cn(
            'rounded-md border px-3 py-1.5 font-mono text-[11px]',
            test.ok
              ? 'border-success/30 bg-success-bg text-success'
              : 'border-danger/30 bg-danger-bg text-danger'
          )}
        >
          {test.ok ? formatToolList(test.tools) : (test.error ?? 'connection failed')}
        </p>
      )}
    </div>
  );
}

function StatusIndicator({
  status,
  test
}: Readonly<{ status: ConnectorStatus; test: ConnectorTestResult | null }>) {
  return (
    <span
      className='flex shrink-0 items-center gap-1.5'
      title={test?.ok === false ? test.error : undefined}
    >
      <span
        className={cn('size-2 rounded-full', {
          'bg-success': status.tone === 'ok',
          'bg-danger': status.tone === 'error',
          'bg-vox-300 animate-pulse': status.tone === 'checking',
          'bg-gray-300': status.tone === 'off'
        })}
        aria-hidden
      />
      <span className='mono-label text-gray-500'>{status.label}</span>
    </span>
  );
}

function formatToolList(tools: string[]): string {
  const preview = tools.slice(0, 8).join(', ');
  const suffix = tools.length > 8 ? '…' : '';
  return `connected · ${tools.length} tools: ${preview}${suffix}`;
}

export interface ConnectorStatus {
  label: string;
  tone: 'off' | 'checking' | 'ok' | 'error';
}

/** Row status from (enabled, in-flight probe, last result). */
export function connectorStatus(
  enabled: boolean,
  testing: boolean,
  test: ConnectorTestResult | null
): ConnectorStatus {
  if (!enabled) {
    return { label: 'off', tone: 'off' };
  }
  if (test?.ok === true) {
    return { label: 'connected', tone: 'ok' };
  }
  if (test !== null && !testing) {
    return { label: 'error', tone: 'error' };
  }
  return { label: 'checking…', tone: 'checking' };
}

/**
 * Map a catalog entry's OAuth preset (plus the user-created client, when
 * the UI has it) into the protocol payload. Credentials may be omitted on
 * re-auth — the sidecar then reuses the ones stored in the keychain.
 */
export function buildPresetPayload(
  entry: CatalogEntry,
  clientId?: string,
  clientSecret?: string
): OAuthPreset {
  const preset = entry.oauthPreset;
  if (!preset) {
    throw new Error(`${entry.name} has no OAuth preset`);
  }
  return {
    client_id: clientId,
    client_secret: clientSecret,
    authorization_endpoint: preset.authorizationEndpoint,
    token_endpoint: preset.tokenEndpoint,
    scopes: preset.scopes,
    extra_auth_params: preset.extraAuthParams
  };
}

/**
 * Two-field OAuth-client input (ID + secret) shared by the directory
 * cards and the row-level re-auth fallback. Children render above the
 * inputs (setup hints, notes).
 */
function ClientCredsForm({
  idPrefix,
  submitLabel,
  onSubmit,
  onCancel,
  children
}: Readonly<{
  idPrefix: string;
  submitLabel: string;
  onSubmit: (creds: { clientId: string; clientSecret: string }) => void;
  onCancel: () => void;
  children?: React.ReactNode;
}>) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  return (
    <div className='flex flex-col gap-1.5'>
      {children}
      <Label htmlFor={`${idPrefix}-cid`}>OAuth client ID</Label>
      <Input
        id={`${idPrefix}-cid`}
        value={clientId}
        onChange={(event) => {
          setClientId(event.target.value);
        }}
      />
      <Label htmlFor={`${idPrefix}-csec`}>OAuth client secret</Label>
      <Input
        id={`${idPrefix}-csec`}
        type='password'
        value={clientSecret}
        placeholder='stored in the OS keychain'
        onChange={(event) => {
          setClientSecret(event.target.value);
        }}
      />
      <div className='flex gap-2'>
        <Button
          size='sm'
          disabled={clientId === '' || clientSecret === ''}
          onClick={() => {
            onSubmit({ clientId, clientSecret });
          }}
        >
          {submitLabel}
        </Button>
        <Button size='sm' variant='ghost' onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------- Directory (click-to-connect catalog) ----------

interface CardState {
  state: 'idle' | 'token' | 'client-creds' | 'connecting' | 'added' | 'error';
  detail?: string;
}

/**
 * Browser authorization for a directory entry; throws on failure.
 * Preset entries with a provider-shared token set skip the consent when
 * a sibling connector already signed in.
 */
async function authorizeEntry(
  entry: CatalogEntry,
  secretReference: string,
  creds?: { clientId: string; clientSecret: string }
): Promise<void> {
  let preset: OAuthPreset | undefined;
  if (entry.auth === 'oauth-preset') {
    const hasToken = await invoke<boolean>('has_secret', { secretRef: secretReference }).catch(
      () => false
    );
    if (hasToken) {
      return;
    }
    preset = buildPresetPayload(entry, creds?.clientId, creds?.clientSecret);
  }
  const result = await startOAuth(entry.url ?? '', secretReference, entry.name, preset);
  if (!result.ok) {
    throw new Error(result.error ?? 'authorization failed');
  }
}

function DirectoryDialog() {
  const { connectors, add, setEnabled } = useConnectorsStore();
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [tokenDraft, setTokenDraft] = useState('');

  const setCard = (key: string, state: CardState['state'], detail?: string) => {
    setCards((previous) => ({ ...previous, [key]: { state, detail } }));
  };

  const isInstalled = (entry: CatalogEntry): boolean =>
    connectors.some((connector) =>
      entry.url === undefined
        ? connector.name.toLowerCase() === entry.name.toLowerCase()
        : connector.url === entry.url
    );

  const connect = async (
    entry: CatalogEntry,
    secret?: string,
    creds?: { clientId: string; clientSecret: string }
  ) => {
    setCard(entry.key, 'connecting');
    try {
      const id = `${entry.key}-${Date.now().toString(36)}`;
      const base: ConnectorConfig = {
        id,
        name: entry.name,
        transport: entry.transport,
        enabled: false,
        ...(entry.transport === 'stdio'
          ? { command: entry.command ?? '', args: entry.args ?? [] }
          : { url: entry.url ?? '' })
      };

      if (entry.auth === 'oauth' || entry.auth === 'oauth-preset') {
        // Sidecar runs the browser flow and stores the tokens in the
        // keychain before resolving; we only ever handle the reference.
        const secretReference = entry.sharedSecretRef ?? `connector_${id}`;
        await authorizeEntry(entry, secretReference, creds);
        await add({ ...base, secret_ref: secretReference });
        await setEnabled(id, true);
      } else {
        await add(base, secret);
        if (entry.transport === 'http') {
          await setEnabled(id, true);
        }
      }

      const note =
        entry.transport === 'stdio'
          ? 'Added — review the command in the list, then enable it.'
          : undefined;
      setCard(entry.key, 'added', note);
    } catch (error) {
      setCard(entry.key, 'error', error instanceof Error ? error.message : String(error));
    }
  };

  // Sibling connector may have signed in already — if the shared token
  // exists, connect without asking for anything.
  const beginClientCreds = async (entry: CatalogEntry) => {
    const reference = entry.sharedSecretRef ?? '';
    const hasToken =
      reference !== '' &&
      (await invoke<boolean>('has_secret', { secretRef: reference }).catch(() => false));
    if (hasToken) {
      await connect(entry);
    } else {
      setCard(entry.key, 'client-creds');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Browse directory</Button>
      </DialogTrigger>
      <DialogContent className='max-h-[80vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Directory</DialogTitle>
          <DialogDescription>
            Click connect and Vox does the rest — services that need sign-in open your browser to
            authorize. Tokens live in the OS keychain.
          </DialogDescription>
        </DialogHeader>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          {CONNECTOR_CATALOG.map((entry) => (
            <DirectoryCard
              key={entry.key}
              entry={entry}
              card={cards[entry.key] ?? { state: 'idle' }}
              installed={isInstalled(entry)}
              tokenDraft={tokenDraft}
              onTokenDraft={setTokenDraft}
              onBeginToken={() => {
                setTokenDraft('');
                setCard(entry.key, 'token');
              }}
              onBeginClientCreds={() => void beginClientCreds(entry)}
              onCancelToken={() => {
                setCard(entry.key, 'idle');
              }}
              onConnect={(secret, creds) => void connect(entry, secret, creds)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DirectoryCardProperties {
  entry: CatalogEntry;
  card: CardState;
  installed: boolean;
  tokenDraft: string;
  onTokenDraft: (value: string) => void;
  onBeginToken: () => void;
  onBeginClientCreds: () => void;
  onCancelToken: () => void;
  onConnect: (secret?: string, creds?: { clientId: string; clientSecret: string }) => void;
}

function DirectoryCard({
  entry,
  card,
  installed,
  tokenDraft,
  onTokenDraft,
  onBeginToken,
  onBeginClientCreds,
  onCancelToken,
  onConnect
}: Readonly<DirectoryCardProperties>) {
  const done = installed || card.state === 'added';
  const authBadge = describeAuth(entry.auth);

  return (
    <div className='flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3'>
      <div className='flex items-center gap-3'>
        <span className='bg-vox-50 text-vox-800 flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold'>
          {entry.name.slice(0, 2).toUpperCase()}
        </span>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <p className='text-ink truncate text-sm font-semibold'>{entry.name}</p>
            {entry.provider === 'google' ? <Badge variant='secondary'>shared sign-in</Badge> : null}
          </div>
          <p className='mono-label text-gray-400'>{authBadge}</p>
        </div>
        {done ? (
          <span className='mono-label text-success shrink-0'>connected</span>
        ) : (
          <Button
            size='sm'
            variant='outline'
            disabled={card.state === 'connecting'}
            onClick={() => {
              if (entry.auth === 'token') {
                onBeginToken();
              } else if (entry.auth === 'oauth-preset') {
                onBeginClientCreds();
              } else {
                onConnect();
              }
            }}
          >
            {card.state === 'connecting' ? 'Connecting…' : 'Connect'}
          </Button>
        )}
      </div>

      <p className='text-xs leading-relaxed text-gray-500'>{entry.description}</p>

      {card.state === 'connecting' && (entry.auth === 'oauth' || entry.auth === 'oauth-preset') ? (
        <p className='mono-label text-vox-700'>authorize in your browser, then come back…</p>
      ) : null}

      {card.state === 'client-creds' ? (
        <ClientCredsForm
          idPrefix={`dir-${entry.key}`}
          submitLabel='Connect'
          onSubmit={(creds) => {
            onConnect(undefined, creds);
          }}
          onCancel={onCancelToken}
        >
          <p className='rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-[11px] leading-relaxed text-gray-700'>
            One-time setup: in Google Cloud Console, enable the Gmail, Drive, Calendar and Chat MCP
            APIs, create an OAuth client of type “Desktop app”, and paste its ID and secret here.
            Add yourself as a test user (or publish the app to avoid weekly re-consent). One sign-in
            covers every Google connector.{' '}
            <button
              type='button'
              className='text-vox-700 underline'
              onClick={() => void invoke('open_path', { path: entry.oauthPreset?.setupUrl ?? '' })}
            >
              Open Google Cloud Console
            </button>
          </p>
        </ClientCredsForm>
      ) : null}

      {card.state === 'token' ? (
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor={`dir-token-${entry.key}`}>{entry.tokenLabel ?? 'Access token'}</Label>
          <Input
            id={`dir-token-${entry.key}`}
            type='password'
            value={tokenDraft}
            placeholder={entry.tokenHint ?? 'stored in the OS keychain'}
            onChange={(event) => {
              onTokenDraft(event.target.value);
            }}
          />
          <div className='flex gap-2'>
            <Button
              size='sm'
              disabled={tokenDraft === ''}
              onClick={() => {
                onConnect(tokenDraft);
              }}
            >
              Connect
            </Button>
            <Button size='sm' variant='ghost' onClick={onCancelToken}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {card.detail === undefined ? null : (
        <p
          className={cn(
            'rounded-md border px-3 py-1.5 font-mono text-[11px]',
            card.state === 'error'
              ? 'border-danger/30 bg-danger-bg text-danger'
              : 'border-success/30 bg-success-bg text-success'
          )}
        >
          {card.detail}
        </p>
      )}
    </div>
  );
}

function describeAuth(auth: CatalogEntry['auth']): string {
  if (auth === 'oauth') {
    return 'sign in with your browser';
  }
  if (auth === 'oauth-preset') {
    return 'sign in with Google (one-time setup)';
  }
  if (auth === 'token') {
    return 'needs an access token';
  }
  return 'no sign-in needed';
}

// ---------- Custom server form ----------

type Preset = 'filesystem' | 'github' | 'custom';

function AddConnectorDialog() {
  const { add } = useConnectorsStore();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>('filesystem');
  const [name, setName] = useState('');
  const [command, setCommand] = useState('npx');
  const [argumentsText, setArgumentsText] = useState(
    '-y @modelcontextprotocol/server-filesystem ~/'
  );
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [transport, setTransport] = useState<'stdio' | 'http'>('stdio');

  const applyPreset = (next: Preset) => {
    setPreset(next);
    if (next === 'filesystem') {
      setName('filesystem');
      setTransport('stdio');
      setCommand('npx');
      setArgumentsText('-y @modelcontextprotocol/server-filesystem ~/');
      setUrl('');
    } else if (next === 'github') {
      setName('github');
      setTransport('http');
      setUrl('https://api.githubcopilot.com/mcp/');
      setCommand('');
      setArgumentsText('');
    } else {
      setName('');
      setCommand('');
      setArgumentsText('');
      setUrl('');
    }
  };

  const submit = async () => {
    const connector: ConnectorConfig = {
      id: `${name.toLowerCase().replaceAll(/\s+/g, '-')}-${Date.now().toString(36)}`,
      name,
      transport,
      enabled: false,
      ...(transport === 'stdio'
        ? { command, args: argumentsText.split(/\s+/).filter(Boolean) }
        : { url })
    };
    await add(connector, secret === '' ? undefined : secret);
    setSecret('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline'>Add custom</Button>
      </DialogTrigger>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Add MCP server</DialogTitle>
          <DialogDescription>
            The server is added disabled. Review the exact command below, then enable it from the
            list.
          </DialogDescription>
        </DialogHeader>

        <div className='flex gap-2'>
          {(['filesystem', 'github', 'custom'] as const).map((p) => (
            <Button
              key={p}
              size='sm'
              variant={preset === p ? 'default' : 'outline'}
              onClick={() => {
                applyPreset(p);
              }}
            >
              {p}
            </Button>
          ))}
        </div>

        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='conn-name'>Name</Label>
            <Input
              id='conn-name'
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>

          {transport === 'stdio' ? (
            <>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='conn-cmd'>Command</Label>
                <Input
                  id='conn-cmd'
                  value={command}
                  onChange={(event) => {
                    setCommand(event.target.value);
                  }}
                />
              </div>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='conn-args'>Arguments</Label>
                <Input
                  id='conn-args'
                  value={argumentsText}
                  onChange={(event) => {
                    setArgumentsText(event.target.value);
                  }}
                />
              </div>
              <p className='rounded-md border border-gray-200 bg-gray-100 px-3 py-2 font-mono text-[11px] text-gray-700'>
                will run: {command} {argumentsText}
              </p>
            </>
          ) : (
            <>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='conn-url'>URL</Label>
                <Input
                  id='conn-url'
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                  }}
                />
              </div>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='conn-token'>
                  Access token{preset === 'github' ? ' (GitHub PAT)' : ''}
                </Label>
                <Input
                  id='conn-token'
                  type='password'
                  value={secret}
                  onChange={(event) => {
                    setSecret(event.target.value);
                  }}
                  placeholder='stored in the OS keychain'
                />
              </div>
            </>
          )}

          <Button disabled={name === ''} onClick={() => void submit()}>
            Add (disabled until you enable it)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
