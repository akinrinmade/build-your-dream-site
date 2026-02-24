import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { format, subDays } from 'date-fns';
import { RefreshCw } from 'lucide-react';

const COLORS = ['#0066FF', '#00C2FF', '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
const TIP = { contentStyle: { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 } };

const ChartCard = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
  <div className="bg-card rounded-xl border border-border p-4">
    <div className="mb-3">
      <h3 className="font-semibold text-sm">{title}</h3>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
    {children}
  </div>
);

const NoData = () => <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No data yet</div>;

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [totalResponses, setTotalResponses] = useState(0);
  const [thisWeek, setThisWeek] = useState(0);

  // Chart data states
  const [chart1, setChart1] = useState<{ date: string; count: number }[]>([]);
  const [chart2, setChart2] = useState<{ name: string; value: number }[]>([]);
  const [chart3, setChart3] = useState<{ name: string; value: number }[]>([]);
  const [chart4, setChart4] = useState<{ name: string; value: number }[]>([]);
  const [chart5, setChart5] = useState<{ name: string; value: number }[]>([]);
  const [chart6, setChart6] = useState<{ name: string; value: number }[]>([]);
  const [chart7, setChart7] = useState<{ rating: string; count: number }[]>([]);
  const [chart8, setChart8] = useState<{ name: string; value: number }[]>([]);
  const [chart9, setChart9] = useState<{ name: string; value: number }[]>([]);
  const [chart10, setChart10] = useState<{ name: string; value: number }[]>([]);
  const [chart11, setChart11] = useState<{ name: string; value: number }[]>([]);
  const [chart12, setChart12] = useState<{ name: string; value: number }[]>([]);
  const [chart13, setChart13] = useState<{ name: string; value: number }[]>([]);
  const [chart14, setChart14] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => { load(); }, []);

  async function getQ(tag: string): Promise<string | null> {
    const { data } = await supabase.from('questions').select('id').eq('category_tag', tag).single();
    return data?.id || null;
  }

  async function getAnswerCounts(tag: string): Promise<Record<string, number>> {
    const qId = await getQ(tag);
    if (!qId) return {};
    const { data } = await supabase.from('answers').select('answer_value').eq('question_id', qId);
    const counts: Record<string, number> = {};
    (data || []).forEach(a => {
      try {
        const arr = JSON.parse(a.answer_value);
        if (Array.isArray(arr)) { arr.forEach((v: string) => { counts[v] = (counts[v] || 0) + 1; }); return; }
      } catch {}
      counts[a.answer_value] = (counts[a.answer_value] || 0) + 1;
    });
    return counts;
  }

  function toDist(counts: Record<string, number>, labels: Record<string, string>, order?: string[]): { name: string; value: number }[] {
    const keys = order || Object.keys(counts);
    return keys.map(k => ({ name: labels[k] || k, value: counts[k] || 0 })).filter(d => d.value > 0);
  }

  async function load() {
    setLoading(true);

    // ── CHART 1: Submissions over 14 days ──
    const days = Array.from({ length: 14 }, (_, i) => format(subDays(new Date(), 13 - i), 'yyyy-MM-dd'));
    const { data: respData, count: total } = await supabase
      .from('responses')
      .select('submission_timestamp, device_type, customer_tier, source', { count: 'exact' })
      .eq('is_duplicate', false)
      .gte('submission_timestamp', subDays(new Date(), 14).toISOString());

    const { count: wkCount } = await supabase.from('responses').select('id', { count: 'exact', head: true })
      .gte('submission_timestamp', subDays(new Date(), 7).toISOString());

    setTotalResponses(total || 0);
    setThisWeek(wkCount || 0);

    const byDay: Record<string, number> = {};
    days.forEach(d => { byDay[d] = 0; });
    (respData || []).forEach(r => { const d = r.submission_timestamp.split('T')[0]; if (d in byDay) byDay[d]++; });
    setChart1(days.map(d => ({ date: format(new Date(d + 'T12:00:00'), 'MMM d'), count: byDay[d] })));

    // ── CHART 2: Intent distribution ──
    const intentC = await getAnswerCounts('entry');
    setChart2(toDist(intentC, { PATH_A: '🚀 Speed', PATH_B: '💳 Plans', PATH_C: '📶 Signal', PATH_D: '🚨 Urgent', PATH_E: '🎁 Refer', PATH_F: '🏠 Profile' }));

    // ── CHART 3: Churn signal (if shutdown tomorrow) ──
    const churnC = await getAnswerCounts('churn_signal');
    setChart3(toDist(churnC, { not_bothered: 'Not Bothered', slightly: 'Slightly', very: 'Very', devastated: 'Devastated' },
      ['not_bothered', 'slightly', 'very', 'devastated']));

    // ── CHART 4: Device type ──
    const devC: Record<string, number> = {};
    (respData || []).forEach(r => { const d = r.device_type || 'unknown'; devC[d] = (devC[d] || 0) + 1; });
    setChart4(Object.entries(devC).map(([n, v]) => ({ name: n.charAt(0).toUpperCase() + n.slice(1), value: v })));

    // ── CHART 5: Signal strength ──
    const sigC = await getAnswerCounts('signal_strength');
    setChart5([{ name: 'Full', value: sigC['4'] || 0 }, { name: '3 Bars', value: sigC['3'] || 0 },
      { name: '2 Bars', value: sigC['2'] || 0 }, { name: '1 Bar', value: sigC['1'] || 0 }, { name: 'None', value: sigC['0'] || 0 }]);

    // ── CHART 6: Payment preference ──
    const payC = await getAnswerCounts('payment');
    setChart6(toDist(payC, { bank_transfer: 'Bank', ussd: 'USSD', card: 'Card', whatsapp_pay: 'WhatsApp', auto_sub: 'Auto-Sub' }));

    // ── CHART 7: Speed rating ──
    const speedC = await getAnswerCounts('speed_rating');
    setChart7([1,2,3,4,5].map(n => ({ rating: String(n), count: speedC[String(n)] || 0 })));

    // ── CHART 8: Referral readiness ──
    const refC = await getAnswerCounts('referral_readiness');
    setChart8([{ name: '✅ Yes', value: refC['yes'] || 0 }, { name: '🤔 Maybe', value: refC['maybe'] || 0 }, { name: '❓ Need Info', value: refC['need_info'] || 0 }]);

    // ── CHART 9: Overall sentiment ──
    const sentC = await getAnswerCounts('sentiment');
    setChart9(toDist(sentC, { poor: '😞 Poor', average: '😐 Average', good: '🙂 Good', excellent: '😍 Excellent' },
      ['poor', 'average', 'good', 'excellent']));

    // ── CHART 10: Willingness to pay ──
    const wtpC = await getAnswerCounts('willingness_to_pay');
    setChart10(toDist(wtpC, { lt_5000: '<₦5k', '5000_10000': '₦5-10k', '10000_15000': '₦10-15k', gt_15000: '>₦15k', need_details: 'Need Info' },
      ['lt_5000', '5000_10000', '10000_15000', 'gt_15000', 'need_details']));

    // ── CHART 11: Usage type heatmap ──
    const usageC = await getAnswerCounts('usage_type');
    setChart11(toDist(usageC, { social: 'Social', streaming: 'Streaming', work: 'Work', gaming: 'Gaming', browsing: 'Browsing', business: 'Business', other: 'Other' }));

    // ── CHART 12: Device count ──
    const dcC = await getAnswerCounts('device_count');
    setChart12(toDist(dcC, { '1': '1 Device', '2': '2 Devices', '3': '3 Devices', '4+': '4+' }, ['1', '2', '3', '4+']));

    // ── CHART 13: Customer tier over time ──
    const tierC: Record<string, number> = {};
    (respData || []).forEach(r => { if (r.customer_tier) tierC[r.customer_tier] = (tierC[r.customer_tier] || 0) + 1; });
    setChart13(Object.entries(tierC).map(([n, v]) => ({ name: n.replace('_', ' '), value: v })));

    // ── CHART 14: Pre-launch vs post-launch (source breakdown) ──
    const srcC: Record<string, number> = {};
    (respData || []).forEach(r => { srcC[r.source] = (srcC[r.source] || 0) + 1; });
    setChart14(toDist(srcC, { live_form: 'Live Form', google_forms_import: 'Legacy Import', manual_entry: 'Manual' }));

    setLoading(false);
  }

  if (loading) return (
    <div className="p-6 flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Building analytics...</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">{totalResponses} total · {thisWeek} this week · 14 charts</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Chart 1 - Full width */}
      <ChartCard title="📈 Submissions Over Time (14 Days)" sub="Daily volume including sources">
        {chart1.every(d => d.count === 0) ? <NoData /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chart1}>
              <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0066FF" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0066FF" stopOpacity={0}/>
              </linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip {...TIP} />
              <Area type="monotone" dataKey="count" stroke="#0066FF" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 2-column grid for all other charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Chart 2 - Intent */}
        <ChartCard title="🎯 Intent Distribution" sub="Which path customers chose">
          {chart2.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={chart2} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                  {chart2.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...TIP} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 3 - Churn Signal */}
        <ChartCard title="⚠️ Churn Signal Tracker" sub="How customers would feel if service stopped">
          {chart3.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chart3}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...TIP} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {chart3.map((_, i) => <Cell key={i} fill={['#ef4444','#f59e0b','#10b981','#0066FF'][i] || '#0066FF'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 4 - Device Type */}
        <ChartCard title="📱 Device Type Breakdown">
          {chart4.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={chart4} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {chart4.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...TIP} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 5 - Signal Strength */}
        <ChartCard title="📶 Signal Strength Distribution" sub="PATH_C signal reports">
          {chart5.every(d => d.value === 0) ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chart5}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...TIP} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {chart5.map((_, i) => <Cell key={i} fill={['#10b981','#10b981','#f59e0b','#ef4444','#ef4444'][i] || '#0066FF'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 6 - Payment Preference */}
        <ChartCard title="💳 Payment Preference Breakdown">
          {chart6.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chart6} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip {...TIP} />
                <Bar dataKey="value" fill="#0066FF" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 7 - Speed Rating */}
        <ChartCard title="⭐ Speed Rating Distribution (1–5)" sub="Self-reported speed in PATH_A">
          {chart7.every(d => d.count === 0) ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chart7}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="rating" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...TIP} />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {chart7.map((d, i) => <Cell key={i} fill={Number(d.rating) <= 2 ? '#ef4444' : Number(d.rating) === 3 ? '#f59e0b' : '#10b981'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 8 - Referral Potential */}
        <ChartCard title="🎁 Referral Potential Score" sub="Would they share a referral link? (PATH_E)">
          {chart8.every(d => d.value === 0) ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chart8}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...TIP} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  <Cell fill="#10b981" /><Cell fill="#f59e0b" /><Cell fill="#6366f1" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 9 - Sentiment */}
        <ChartCard title="😊 Overall Experience Sentiment">
          {chart9.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={chart9} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                  {chart9.map((_, i) => <Cell key={i} fill={['#ef4444','#f59e0b','#10b981','#0066FF'][i] || '#0066FF'} />)}
                </Pie>
                <Tooltip {...TIP} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 10 - Willingness to Pay */}
        <ChartCard title="💰 Willingness to Pay Distribution" sub="Monthly budget for unlimited internet (PATH_F)">
          {chart10.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chart10}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...TIP} />
                <Bar dataKey="value" fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 11 - Usage Type */}
        <ChartCard title="🌐 Usage Type Heatmap" sub="What customers use internet for (multi-select)">
          {chart11.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chart11} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
                <Tooltip {...TIP} />
                <Bar dataKey="value" fill="#00C2FF" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 12 - Device Count */}
        <ChartCard title="📟 Device Count Distribution" sub="How many devices per household (PATH_F)">
          {chart12.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={chart12} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {chart12.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...TIP} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 13 - Customer Tier */}
        <ChartCard title="💎 Customer Tier Breakdown" sub="High value / Standard / Budget auto-classified">
          {chart13.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={chart13} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  <Cell fill="#0066FF" /><Cell fill="#10b981" /><Cell fill="#f59e0b" />
                </Pie>
                <Tooltip {...TIP} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 14 - Pre-launch vs Post-launch (source) */}
        <ChartCard title="📋 Pre-Launch vs Post-Launch" sub="Legacy Google Forms import vs live submissions">
          {chart14.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chart14}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...TIP} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {chart14.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>
    </div>
  );
};

export default AdminAnalytics;
