export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-brand-500" style={{ borderColor: 'var(--border)', borderTopColor: '#6366f1' }} />
    </div>
  );
}
