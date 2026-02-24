import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Users, TrendingDown, Gift, Star, Activity, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface Stats {
  total: number;
  today: number;
  urgent: number;
  churnRisk: number;
  highReferrer: number;
  upsell: number;
  avgSpeedRating: string;
}

interface RecentResponse {
  id: string;
  submission_timestamp: string;
  priority_flag: boolean;
  churn_risk_flag: boolean;
  high_referrer_flag: boolean;
  upsell_candidate: boolean;
  customer_tier: string | null;
  answers: { answer_value: string; question: { category_tag: string | null } | null }[];
}

const FLAG_CONFIG = [
  { key: 'priority_flag', label: '🚨 Urgent', color: 'bg-destructive/10 text-destructive border-destructive/30' },
  { key: 'churn_risk_flag', label: '⚠️ Churn Risk', color: 'bg-warning/10 text-warning border-warning/30' },
  { key: 'high_referrer_flag', label: '🎁 Referrer', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  { key: 'upsell_candidate', label: '💎 Upsell', color: 'bg-primary/10 text-primary border-primary/30' },
];

function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color || 'bg-primary/10'}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    // Realtime subscription for new responses
    const channel = supabase
      .channel('responses-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'responses' }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    setLoading(true);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [totalRes, todayRes, urgentRes, churnRes, referrerRes, upsellRes, recentRes, speedRes] = await Promise.all([
      supabase.from('responses').select('id', { count: 'exact', head: true }).eq('is_duplicate', false),
      supabase.from('responses').select('id', { count: 'exact', head: true }).gte('submission_timestamp', todayStart),
      supabase.from('responses').select('id', { count: 'exact', head: true }).eq('priority_flag', true),
      supabase.from('responses').select('id', { count: 'exact', head: true }).eq('churn_risk_flag', true),
      supabase.from('responses').select('id', { count: 'exact', head: true }).eq('high_referrer_flag', true),
      supabase.from('responses').select('id', { count: 'exact', head: true }).eq('upsell_candidate', true),
      supabase.from('responses')
        .select('id, submission_timestamp, priority_flag, churn_risk_flag, high_referrer_flag, upsell_candidate, customer_tier')
        .order('submission_timestamp', { ascending: false })
        .limit(10),
      supabase.from('answers')
        .select('answer_value, question:questions!inner(category_tag)')
        .eq('question.category_tag', 'speed_rating'),
    ]);

    const speeds = (speedRes.data || []).map(r => parseFloat(r.answer_value)).filter(n => !isNaN(n));
    const avg = speeds.length > 0 ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1) : 'N/A';

    setStats({
      total: totalRes.count || 0,
      today: todayRes.count || 0,
      urgent: urgentRes.count || 0,
      churnRisk: churnRes.count || 0,
      highReferrer: referrerRes.count || 0,
      upsell: upsellRes.count || 0,
      avgSpeedRating: avg,
    });

    setRecent((recentRes.data || []) as RecentResponse[]);
    setLoading(false);
  }

  const urgentPct = stats && stats.total > 0 ? Math.round((stats.urgent / stats.total) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time customer intelligence</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          icon={<Users className="w-4 h-4 text-primary" />}
          label="Total Submissions"
          value={stats?.total ?? '—'}
          sub={`${stats?.today ?? 0} today`}
          color="bg-primary/10"
        />
        <KPICard
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
          label="Urgent Issues"
          value={stats?.urgent ?? '—'}
          sub={`${urgentPct}% of total`}
          color="bg-destructive/10"
        />
        <KPICard
          icon={<TrendingDown className="w-4 h-4 text-orange-500" />}
          label="Churn Risk"
          value={stats?.churnRisk ?? '—'}
          sub="Need attention"
          color="bg-orange-500/10"
        />
        <KPICard
          icon={<Gift className="w-4 h-4 text-green-600" />}
          label="High Referrers"
          value={stats?.highReferrer ?? '—'}
          sub="5+ friends"
          color="bg-green-500/10"
        />
        <KPICard
          icon={<TrendingUp className="w-4 h-4 text-violet-600" />}
          label="Upsell Candidates"
          value={stats?.upsell ?? '—'}
          sub="Ready to upgrade"
          color="bg-violet-500/10"
        />
        <KPICard
          icon={<Star className="w-4 h-4 text-yellow-500" />}
          label="Avg Speed Rating"
          value={stats?.avgSpeedRating ?? '—'}
          sub="out of 5"
          color="bg-yellow-500/10"
        />
      </div>

      {/* Activity Feed */}
      <div className="bg-card rounded-xl border border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Live Activity Feed</h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </div>
        </div>

        <div className="divide-y divide-border">
          {recent.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No submissions yet. Waiting for responses...
            </div>
          )}
          {recent.map((r) => {
            const flags = FLAG_CONFIG.filter(f => (r as unknown as Record<string, boolean>)[f.key]);
            const rowBg = r.priority_flag ? 'bg-destructive/5' :
              r.churn_risk_flag ? 'bg-warning/5' :
              r.high_referrer_flag ? 'bg-green-500/5' : '';

            return (
              <div key={r.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${rowBg}`}>
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                  {r.customer_tier === 'high_value' ? '💎' : r.customer_tier === 'budget' ? '📦' : '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.submission_timestamp), { addSuffix: true })}
                    </p>
                    {r.customer_tier && (
                      <span className="text-xs text-muted-foreground capitalize">
                        · {r.customer_tier.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  {flags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {flags.map(f => (
                        <span key={f.key} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${f.color}`}>
                          {f.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
