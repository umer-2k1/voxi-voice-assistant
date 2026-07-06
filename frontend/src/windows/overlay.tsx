/**
 * Overlay window (route "/overlay") — frameless, transparent, always-on-top.
 * Mic pill states (idle / listening / thinking) land in M1–M2;
 * the confirm-before-acting card lands in M6.
 */
export default function OverlayWindow() {
  return (
    <div className='flex h-dvh items-end justify-center bg-transparent pb-2'>
      <div className='flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-md'>
        <span className='size-2 rounded-full bg-gray-300' aria-hidden />
        <span className='mono-label text-gray-500'>idle</span>
      </div>
    </div>
  );
}
