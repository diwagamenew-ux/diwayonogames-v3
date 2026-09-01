export function AdSlot({ slot, className = "" }: {
  slot: { enabled: boolean; code: string } | undefined;
  className?: string;
}) {
  if (!slot?.enabled || !slot.code) return null;
  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-panel ${className}`}>
      <p className="text-[0.6rem] uppercase tracking-[0.2em] text-mute text-center pt-1.5">
        Advertisement
      </p>
      <div dangerouslySetInnerHTML={{ __html: slot.code }} />
    </div>
  );
}
