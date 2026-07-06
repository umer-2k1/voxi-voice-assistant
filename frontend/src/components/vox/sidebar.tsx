import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/connectors', label: 'Connectors' },
  { to: '/settings', label: 'Settings' }
];

/** 244px sidebar per the design system: nav items + connection status. */
export default function Sidebar() {
  const status = useSessionStore((s) => s.status);

  return (
    <aside className='border-sidebar-border bg-sidebar flex w-[244px] shrink-0 flex-col border-r'>
      <div className='flex items-center gap-2 px-5 pt-5 pb-6'>
        <span className='flex items-end gap-[3px]' aria-hidden>
          <span className='bg-vox-500 h-2.5 w-1 rounded-full' />
          <span className='bg-vox-500 h-4 w-1 rounded-full' />
          <span className='bg-vox-500 h-2 w-1 rounded-full' />
        </span>
        <span className='text-ink text-[15px] font-extrabold tracking-tight'>Vox</span>
      </div>

      <nav className='flex flex-col gap-0.5 px-3'>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors duration-120',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-gray-150 text-gray-500 hover:text-gray-700'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className='mt-auto flex items-center gap-2 px-5 py-4'>
        <span
          className={cn(
            'size-2 rounded-full',
            status === 'ready' && 'bg-success',
            status === 'connecting' && 'bg-caution',
            (status === 'stopped' || status === 'failed') && 'bg-danger'
          )}
          aria-hidden
        />
        <span className='mono-label text-gray-400'>
          {status === 'ready' ? 'agent online' : `agent ${status}`}
        </span>
      </div>
    </aside>
  );
}
