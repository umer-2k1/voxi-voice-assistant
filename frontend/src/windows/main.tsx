/**
 * Main window (route "/") — sidebar shell lands in M3.
 * For M0 this only proves the Tauri window renders the themed app.
 */
export default function MainWindow() {
  return (
    <div className='flex min-h-dvh flex-col items-center justify-center gap-3 bg-gray-100'>
      <div className='flex items-end gap-1' aria-hidden>
        <span className='bg-vox-500 h-4 w-2 rounded-full' />
        <span className='bg-vox-500 h-7 w-2 rounded-full' />
        <span className='bg-vox-500 h-3 w-2 rounded-full' />
      </div>
      <h1 className='text-ink text-[25px] font-extrabold tracking-[-0.02em]'>Vox</h1>
      <p className='text-sm text-gray-500'>Hold the hotkey and speak. Setup continues in M1–M3.</p>
      <span className='mono-label text-gray-400'>prototype · m0</span>
    </div>
  );
}
