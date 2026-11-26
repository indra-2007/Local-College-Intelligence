export default function HodPage() {
  return (
    <div className="max-w-7xl mx-auto w-full px-space-base md:px-space-xl py-space-xl space-y-space-xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="space-y-space-2xs">
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">HOD Dashboard</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Department overview and analytics.</p>
        </div>
      </div>
      <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-variant h-[400px] flex flex-col items-center justify-center">
        <span className="material-symbols-outlined text-[48px] text-primary-container mb-4">monitoring</span>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Department Analytics</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md text-center mt-2">
          View aggregated student performance, attendance risks, and curriculum coverage.
        </p>
      </div>
    </div>
  );
}
