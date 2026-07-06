import { useEffect, useState } from 'react';

import type { ConnectorTestResult } from '@/lib/agent-socket';
import type { ConnectorConfig } from '@vox/protocol';

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
import { testConnector } from '@/lib/agent-socket';
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
        <AddConnectorDialog />
      </div>

      {loaded && connectors.length === 0 ? (
        <div className='flex flex-1 flex-col items-center justify-center gap-1'>
          <p className='text-sm text-gray-500'>No connectors yet.</p>
          <p className='mono-label text-gray-400'>add filesystem or github to get started</p>
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
  const [testing, setTesting] = useState(false);

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
          <p className='text-ink truncate text-sm font-semibold'>{connector.name}</p>
          <p className='truncate font-mono text-[11px] text-gray-500' title={detail}>
            {detail}
          </p>
        </div>
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            connector.enabled ? 'bg-success' : 'bg-gray-300'
          )}
          aria-hidden
        />
        <Button
          variant='outline'
          size='sm'
          disabled={testing}
          onClick={() => {
            setTesting(true);
            setTest(null);
            void testConnector(connector).then((result) => {
              setTest(result);
              setTesting(false);
            });
          }}
        >
          {testing ? 'Testing…' : 'Test'}
        </Button>
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

function formatToolList(tools: string[]): string {
  const preview = tools.slice(0, 8).join(', ');
  const suffix = tools.length > 8 ? '…' : '';
  return `connected · ${tools.length} tools: ${preview}${suffix}`;
}

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
        <Button>Add server</Button>
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
