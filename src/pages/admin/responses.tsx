import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { exportToCSV } from '@/lib/export';
import { Download, Eye, CheckCircle, Trash2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Response {
  id: string;
  submission_timestamp: string;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  customer_tier: string | null;
  source: string;
  priority_flag: boolean;
  churn_risk_flag: boolean;
  high_referrer_flag: boolean;
  upsell_candidate: boolean;
  is_duplicate: boolean;
  reviewed_by_admin: boolean;
  admin_notes: string | null;
}

interface Answer {
  id: string;
  answer_value: string;
  question: { question_text: string; category_tag: string | null } | null;
}

const FLAG_BADGES = [
  { key: 'priority_flag', label: '🚨 Urgent', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  { key: 'churn_risk_flag', label: '⚠️ Churn', color: 'bg-warning/10 text-warning border-warning/20' },
  { key: 'high_referrer_flag', label: '🎁 Referrer', color: 'bg-green-500/10 text-green-700 border-green-500/20' },
  { key: 'upsell_candidate', label: '💎 Upsell', color: 'bg-primary/10 text-primary border-primary/20' },
];

const PAGE_SIZE = 20;

const AdminResponses = () => {
  const [responses, setResponses] = useState<Response[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterFlag, setFilterFlag] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Response | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Answer[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    loadResponses();
  }, [page, filterFlag, search]);

  async function loadResponses() {
    setLoading(true);

    // If searching, find response IDs matching the WhatsApp answer
    let searchResponseIds: string[] | null = null;
    if (search.trim()) {
      const { data: matchingAnswers } = await supabase
        .from('answers')
        .select('response_id')
        .ilike('answer_value', `%${search.trim()}%`);
      searchResponseIds = (matchingAnswers || []).map(a => a.response_id);
      if (searchResponseIds.length === 0) {
        setResponses([]);
        setTotal(0);
        setLoading(false);
        return;
      }
    }

    let query = supabase
      .from('responses')
      .select('*', { count: 'exact' })
      .order('submission_timestamp', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (searchResponseIds) query = query.in('id', searchResponseIds);
    if (filterFlag === 'urgent') query = query.eq('priority_flag', true);
    else if (filterFlag === 'churn') query = query.eq('churn_risk_flag', true);
    else if (filterFlag === 'referrer') query = query.eq('high_referrer_flag', true);
    else if (filterFlag === 'upsell') query = query.eq('upsell_candidate', true);
    else if (filterFlag === 'unreviewed') query = query.eq('reviewed_by_admin', false);

    const { data, count, error } = await query;
    if (!error) {
      setResponses((data || []) as Response[]);
      setTotal(count || 0);
    }
    setLoading(false);
  }

  async function openResponse(r: Response) {
    setSelected(r);
    setAdminNotes(r.admin_notes || '');
    setLoadingAnswers(true);

    const { data } = await supabase
      .from('answers')
      .select('id, answer_value, question:questions(question_text, category_tag)')
      .eq('response_id', r.id)
      .order('question(display_order)');

    setSelectedAnswers((data || []) as unknown as Answer[]);
    setLoadingAnswers(false);
  }

  async function markReviewed(id: string) {
    await supabase.from('responses').update({ reviewed_by_admin: true }).eq('id', id);
    toast.success('Marked as reviewed');
    loadResponses();
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, reviewed_by_admin: true } : null);
  }

  async function saveNotes() {
    if (!selected) return;
    await supabase.from('responses').update({ admin_notes: adminNotes }).eq('id', selected.id);
    toast.success('Notes saved');
    setSelected(prev => prev ? { ...prev, admin_notes: adminNotes } : null);
  }

  async function deleteResponse(id: string) {
    if (!confirm('Delete this response? This cannot be undone.')) return;
    await supabase.from('responses').delete().eq('id', id);
    toast.success('Response deleted');
    setSelected(null);
    loadResponses();
  }

  async function handleExport() {
    const { data } = await supabase
      .from('responses')
      .select('*, answers(answer_value, question:questions(question_text))')
      .order('submission_timestamp', { ascending: false });

    if (!data) return;

    const rows = data.map((r: unknown) => {
      const row: Record<string, unknown> = { ...(r as object) };
      delete row.answers;
      const answers = ((r as Record<string, unknown>).answers || []) as Array<{ answer_value: string; question: { question_text: string } | null }>;
      answers.forEach(a => {
        if (a.question) {
          row[a.question.question_text] = a.answer_value;
        }
      });
      return row as Record<string, string>;
    });

    exportToCSV(rows, 'houseconnect-responses');
    toast.success('CSV exported successfully');
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const FILTERS = [
    { key: '', label: 'All' },
    { key: 'urgent', label: '🚨 Urgent' },
    { key: 'churn', label: '⚠️ Churn' },
    { key: 'referrer', label: '🎁 Referrer' },
    { key: 'upsell', label: '💎 Upsell' },
    { key: 'unreviewed', label: 'Unreviewed' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Responses</h1>
          <p className="text-sm text-muted-foreground">{total} total submissions</p>
        </div>
        <Button size="sm" onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(0); } }}
            placeholder="Search by WhatsApp, name..."
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => { setSearch(searchInput); setPage(0); }}>Search</Button>
        {search && <Button variant="ghost" onClick={() => { setSearch(''); setSearchInput(''); setPage(0); }}>Clear</Button>}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilterFlag(f.key); setPage(0); }}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
              ${filterFlag === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border hover:border-primary/50 text-foreground'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Time</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Device</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Tier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Flags</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</td></tr>
              )}
              {!loading && responses.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No responses found</td></tr>
              )}
              {responses.map(r => {
                const flags = FLAG_BADGES.filter(f => (r as unknown as Record<string, boolean>)[f.key]);
                return (
                  <tr key={r.id} className={`hover:bg-muted/20 transition-colors ${r.priority_flag ? 'bg-destructive/5' : ''}`}>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(r.submission_timestamp), 'MMM d, HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize">{r.device_type || '—'}</td>
                    <td className="px-4 py-3">
                      {r.customer_tier ? (
                        <span className="text-xs capitalize font-medium">{r.customer_tier.replace('_', ' ')}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {flags.map(f => (
                          <span key={f.key} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${f.color}`}>
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.reviewed_by_admin ? (
                        <span className="text-xs text-green-600 font-medium">✓ Reviewed</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openResponse(r)} className="h-7 px-2">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Response Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Response Detail</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Flags */}
              {FLAG_BADGES.filter(f => (selected as unknown as Record<string, boolean>)[f.key]).length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {FLAG_BADGES.filter(f => (selected as unknown as Record<string, boolean>)[f.key]).map(f => (
                    <span key={f.key} className={`text-xs px-2 py-1 rounded border font-medium ${f.color}`}>{f.label}</span>
                  ))}
                </div>
              )}

              {/* Metadata */}
              <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1 text-muted-foreground">
                <p><span className="font-medium text-foreground">Submitted:</span> {format(new Date(selected.submission_timestamp), 'MMM d, yyyy HH:mm:ss')}</p>
                <p><span className="font-medium text-foreground">Device:</span> {selected.device_type} · {selected.browser} · {selected.os}</p>
                <p><span className="font-medium text-foreground">Tier:</span> {selected.customer_tier || 'N/A'}</p>
                <p><span className="font-medium text-foreground">Source:</span> {selected.source}</p>
              </div>

              {/* Answers */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Answers</h3>
                {loadingAnswers ? (
                  <p className="text-sm text-muted-foreground">Loading answers...</p>
                ) : (
                  <div className="space-y-2">
                    {selectedAnswers.map(a => {
                      let displayValue = a.answer_value;
                      try { displayValue = JSON.parse(a.answer_value).join(', '); } catch {}
                      return (
                        <div key={a.id} className="border border-border rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">{a.question?.question_text || 'Question'}</p>
                          <p className="text-sm font-medium">{displayValue}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Admin notes */}
              <div>
                <label className="text-sm font-semibold block mb-1.5">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full border border-border rounded-lg p-2 text-sm resize-none bg-card"
                  rows={3}
                  placeholder="Add notes..."
                />
                <Button size="sm" variant="outline" onClick={saveNotes} className="mt-1.5">
                  Save Notes
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {!selected.reviewed_by_admin && (
                  <Button size="sm" onClick={() => markReviewed(selected.id)} className="flex-1">
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Mark Reviewed
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => deleteResponse(selected.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminResponses;
