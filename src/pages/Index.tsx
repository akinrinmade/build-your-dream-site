import { FormEngine } from '@/components/form/FormEngine';
import { Wifi } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-[hsl(var(--navy))] text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Wifi className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">HouseConnect</h1>
            <p className="text-[10px] text-white/60 leading-tight">Smart Feedback System</p>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(216,60%,20%)] text-white px-4 py-8">
        <div className="max-w-lg mx-auto text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 text-xs font-medium mb-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Your feedback shapes our service
          </div>
          <h2 className="text-2xl font-bold leading-tight">
            Help Us Improve Your{' '}
            <span className="text-[hsl(var(--cyan-glow))]">Internet Experience</span>
          </h2>
          <p className="text-white/70 text-sm leading-relaxed">
            Takes 2–3 minutes. Your answers help us improve speed, fix issues, and build better plans for your estate.
          </p>
        </div>
      </div>

      {/* Form card */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-card rounded-2xl border border-border shadow-xl shadow-black/5 p-5 sm:p-7">
            <FormEngine />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-5 text-center">
        <p className="text-xs text-muted-foreground">
          © 2025 HouseConnect ISP · Your data is secure and never shared
        </p>
      </footer>
    </div>
  );
};

export default Index;
