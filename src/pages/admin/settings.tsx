import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Building2, Users, Bell, Trash2, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface AdminUserRow { id: string; email: string; full_name: string | null; role: string; estate_id: string | null; }
interface Estate { id: string; name: string; city: string | null; state: string | null; is_active: boolean; }

// Maps legacy Google Forms CSV header → our question category_tag
const LEGACY_FIELD_MAP: Record<string, string> = {
  'How many devices': 'device_count',
  'How much do you currently spend': 'current_spend',
  'How much data': 'usage_volume',
  'Would you prefer an unlimited': 'plan_preference',
  'How much would you pay': 'willingness_to_pay',
  'What times do you use': 'usage_time',
  'What do you mostly use': 'usage_type',
  'Do you experience network': 'existing_pain',
  'should heavy downloaders': 'policy_preference',
  'Phone Number': 'identity',
  'comments': 'open_feedback',
  'Timestamp': '__timestamp',
  'Email Address': '__email',
};

const SectionCard = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="bg-card rounded-xl border border-border">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
      {icon}<h2 className="font-semibold text-sm">{title}</h2>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const AdminSettings = () => {
  const { adminUser } = useAdminAuth();
  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [estates, setEstates] = useState<Estate[]>([]);
  const [newEstateOpen, setNewEstateOpen] = useState(false);
  const [estateName, setEstateName] = useState('');
  const [estateCity, setEstateCity] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [loading, setLoading] = useState(true);

  // Legacy import state
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importDone, setImportDone] = useState<{ count: number; skipped: number } | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [estateId, setEstateId] = useState<string | null>(null);

  const isSuperAdmin = adminUser?.role === 'super_admin';

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [adminsRes, estatesRes, formRes] = await Promise.all([
      supabase.from('admin_users').select('*'),
      supabase.from('estates').select('*').order('created_at'),
      supabase.from('forms').select('id, estate_id').eq('slug', 'feedback').single(),
    ]);
    setAdmins((adminsRes.data || []) as AdminUserRow[]);
    setEstates((estatesRes.data || []) as Estate[]);
    if (formRes.data) { setFormId(formRes.data.id); setEstateId(formRes.data.estate_id); }
    setLoading(false);
  }

  async function addEstate() {
    if (!estateName.trim()) { toast.error('Estate name required'); return; }
    await supabase.from('estates').insert({ name: estateName, city: estateCity || null });
    toast.success('Estate added');
    setEstateName(''); setEstateCity(''); setNewEstateOpen(false);
    loadData();
  }

  async function toggleEstate(e: Estate) {
    await supabase.from('estates').update({ is_active: !e.is_active }).eq('id', e.id);
    toast.success(e.is_active ? 'Estate deactivated' : 'Estate activated');
    loadData();
  }

  // ── CSV Import Logic ──
  function handleFileSelect(file: File) {
    setCsvFile(file);
    setImportDone(null);
    setImportProgress(0);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n');
      const headers = parseCSVLine(lines[0]);
      setCsvHeaders(headers);
      // Auto-map headers
      const autoMap: Record<string, string> = {};
      headers.forEach(h => {
        const match = Object.entries(LEGACY_FIELD_MAP).find(([key]) => h.toLowerCase().includes(key.toLowerCase()));
        if (match) autoMap[h] = match[1];
      });
      setFieldMap(autoMap);
      // Preview first 5 rows
      const preview = lines.slice(1, 6).map(l => parseCSVLine(l));
      setCsvPreview(preview);
    };
    reader.readAsText(file);
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; }
      else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += line[i]; }
    }
    result.push(current.trim());
    return result;
  }

  async function runImport() {
    if (!csvFile || !formId || !estateId) return;
    setImporting(true);
    setImportProgress(0);
    setImportDone(null);

    // Load questions to map category_tag → question id
    const { data: qs } = await supabase.from('questions').select('id, category_tag').eq('form_id', formId);
    const tagToId: Record<string, string> = {};
    (qs || []).forEach(q => { if (q.category_tag) tagToId[q.category_tag] = q.id; });

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n');
      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1).map(l => parseCSVLine(l));

      let count = 0;
      let skipped = 0;

      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (row.every(c => !c.trim())) { skipped++; continue; }

        // Insert response
        const { data: resp, error: respErr } = await supabase.from('responses').insert({
          form_id: formId, estate_id: estateId,
          source: 'google_forms_import', legacy_import: true,
          submission_timestamp: new Date().toISOString(),
        }).select('id').single();

        if (respErr || !resp) { skipped++; continue; }

        // Insert answers for mapped fields
        const answerRows: Array<{ response_id: string; question_id: string; answer_value: string }> = [];
        headers.forEach((header, colIdx) => {
          const tag = fieldMap[header];
          if (!tag || tag.startsWith('__')) return;
          const qId = tagToId[tag];
          if (!qId) return;
          const val = row[colIdx]?.trim();
          if (val) answerRows.push({ response_id: resp.id, question_id: qId, answer_value: val });
        });

        if (answerRows.length > 0) {
          await supabase.from('answers').insert(answerRows);
        }

        count++;
        setImportProgress(Math.round(((rowIdx + 1) / rows.length) * 100));
        // Small delay to not overwhelm DB
        if (rowIdx % 10 === 9) await new Promise(r => setTimeout(r, 50));
      }

      setImportDone({ count, skipped });
      setImporting(false);
      toast.success(`Imported ${count} responses from Google Forms`);
    };
    reader.readAsText(csvFile);
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Estates, admin users, legacy import, notifications</p>
      </div>

      {/* Estates */}
      <SectionCard icon={<Building2 className="w-4 h-4 text-primary" />} title="Estate Management">
        <div className="space-y-3">
          {estates.map(e => (
            <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{e.name}</p>
                <p className="text-xs text-muted-foreground">{[e.city, e.state].filter(Boolean).join(', ') || 'No location'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.is_active ? 'bg-green-500/10 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                  {e.is_active ? 'Active' : 'Inactive'}
                </span>
                {isSuperAdmin && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleEstate(e)}>
                    {e.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {isSuperAdmin && (
            <Button variant="outline" size="sm" onClick={() => setNewEstateOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Estate
            </Button>
          )}
        </div>
      </SectionCard>

      {/* Admin Users */}
      <SectionCard icon={<Users className="w-4 h-4 text-primary" />} title="Admin Users">
        <div className="space-y-3">
          {admins.map(a => (
            <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{a.full_name || a.email}</p>
                <p className="text-xs text-muted-foreground">{a.email}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium capitalize">{a.role.replace('_', ' ')}</span>
            </div>
          ))}
          {isSuperAdmin && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Invite New Admin</p>
              <div className="flex gap-2 mb-2">
                <Input placeholder="admin@email.com" className="flex-1" />
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                Create the user in Supabase Auth → Users → Invite User, then add a row to admin_users with their UUID and role above.
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Google Forms Legacy Import */}
      <SectionCard icon={<Upload className="w-4 h-4 text-primary" />} title="Google Forms Legacy CSV Import">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Import pre-launch survey data from Google Forms. Rows are tagged as <code className="bg-muted px-1 rounded text-xs">google_forms_import</code> and won't affect live analytics.</p>

          {/* File drop zone */}
          <div
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.csv')) handleFileSelect(f); }}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            {csvFile ? (
              <div>
                <p className="text-sm font-medium text-primary">{csvFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{csvHeaders.length} columns detected · Click to change</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">Drop CSV file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Export your Google Form responses as CSV</p>
              </div>
            )}
          </div>

          {/* Field mapping */}
          {csvHeaders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Column Mapping</h3>
              <p className="text-xs text-muted-foreground">Map CSV columns to form question categories. Columns marked "Skip" will be ignored.</p>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {csvHeaders.map(h => (
                  <div key={h} className="flex items-center gap-2">
                    <p className="text-xs flex-1 truncate text-foreground font-mono bg-muted px-2 py-1 rounded" title={h}>{h}</p>
                    <Select value={fieldMap[h] || 'skip'} onValueChange={v => setFieldMap(m => ({ ...m, [h]: v === 'skip' ? '' : v }))}>
                      <SelectTrigger className="w-40 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">— Skip —</SelectItem>
                        <SelectItem value="device_count">device_count</SelectItem>
                        <SelectItem value="current_spend">current_spend</SelectItem>
                        <SelectItem value="usage_volume">usage_volume</SelectItem>
                        <SelectItem value="plan_preference">plan_preference</SelectItem>
                        <SelectItem value="willingness_to_pay">willingness_to_pay</SelectItem>
                        <SelectItem value="usage_time">usage_time</SelectItem>
                        <SelectItem value="usage_type">usage_type</SelectItem>
                        <SelectItem value="existing_pain">existing_pain</SelectItem>
                        <SelectItem value="policy_preference">policy_preference</SelectItem>
                        <SelectItem value="identity">identity (phone)</SelectItem>
                        <SelectItem value="open_feedback">open_feedback</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              {csvPreview.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Preview (first 5 rows)</p>
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="text-xs w-full">
                      <thead className="bg-muted/50">
                        <tr>{csvHeaders.map(h => <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap max-w-24 truncate">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {csvPreview.map((row, i) => (
                          <tr key={i}>{row.map((cell, j) => <td key={j} className="px-2 py-1 text-foreground whitespace-nowrap max-w-24 truncate">{cell}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import button */}
              {!importing && !importDone && (
                <Button onClick={runImport} disabled={!formId} className="w-full">
                  <Upload className="w-4 h-4 mr-2" />
                  Import {csvFile?.name}
                </Button>
              )}
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Importing...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="h-2" />
            </div>
          )}

          {/* Done state */}
          {importDone && (
            <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-xl border border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">Import complete</p>
                <p className="text-xs text-green-600">{importDone.count} rows imported · {importDone.skipped} skipped</p>
              </div>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setCsvFile(null); setCsvHeaders([]); setImportDone(null); setFieldMap({}); }}>
                Import Another
              </Button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Notifications */}
      <SectionCard icon={<Bell className="w-4 h-4 text-primary" />} title="Notifications (Phase 2 Ready)">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>WhatsApp Alert Number</Label>
            <Input placeholder="+234 XXX XXX XXXX" disabled />
            <p className="text-xs text-muted-foreground">Receives alerts for urgent issues when Phase 2 is activated.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Daily Email Digest</Label>
            <Input placeholder="admin@houseconnect.ng" disabled />
          </div>
          <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Notification fields activate once the WhatsApp Business API and email service are connected in Phase 2. The edge function hooks are already in place.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Add Estate Dialog */}
      <Dialog open={newEstateOpen} onOpenChange={setNewEstateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Estate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Estate Name *</Label>
              <Input value={estateName} onChange={e => setEstateName(e.target.value)} placeholder="e.g. Sunrise Gardens" />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={estateCity} onChange={e => setEstateCity(e.target.value)} placeholder="e.g. Lagos" />
            </div>
            <div className="flex gap-2">
              <Button onClick={addEstate} className="flex-1">Add Estate</Button>
              <Button variant="outline" onClick={() => setNewEstateOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSettings;
