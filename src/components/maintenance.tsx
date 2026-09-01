import { IconCrown } from "./icons";

export function MaintenanceScreen({ message, siteName }: { message: string; siteName: string }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 noise-bg flex-1">
      <div className="card-gold max-w-md w-full p-10 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl btn-gold flex items-center justify-center animate-glow">
          <IconCrown className="w-8 h-8" />
        </div>
        <h1 className="font-display text-4xl mt-6 gold-text">UNDER MAINTENANCE</h1>
        <p className="text-mute mt-3 text-sm leading-relaxed">{message}</p>
        <p className="text-xs text-mute mt-6 uppercase tracking-widest">{siteName}</p>
      </div>
    </div>
  );
}
