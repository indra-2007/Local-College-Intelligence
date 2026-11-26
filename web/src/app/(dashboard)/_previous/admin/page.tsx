export default function AdminPage() {
  return (
    <div className="max-w-7xl mx-auto w-full px-space-base md:px-space-xl py-space-xl space-y-space-xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="space-y-space-2xs">
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Institutional Admin Panel</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Global telemetry and node management.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-variant">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Node Status</span>
          <div className="mt-2 text-3xl font-headline-md text-secondary">Online</div>
          <p className="mt-1 font-body-sm text-on-surface-variant">Ping: 12ms</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-variant">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Active Queries</span>
          <div className="mt-2 text-3xl font-headline-md text-on-surface">1,402</div>
          <p className="mt-1 font-body-sm text-on-surface-variant">Past 24 hours</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-variant">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Storage</span>
          <div className="mt-2 text-3xl font-headline-md text-on-surface">42%</div>
          <p className="mt-1 font-body-sm text-on-surface-variant">Of 50TB Used</p>
        </div>
      </div>
    </div>
  );
}
