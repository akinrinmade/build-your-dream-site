import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Zap, X, Play } from 'lucide-react';
import { toast } from 'sonner';

interface Option { id: string; option_text: string; option_value: string; display_order: number; icon_emoji: string | null; }
interface Question {
  id: string; form_id: string; question_text: string; helper_text: string | null;
  question_type: string; category_tag: string | null; path_tag: string | null;
  is_required: boolean; is_active: boolean; display_order: number;
  placeholder_text: string | null; question_options?: Option[];
}
interface LogicRule {
  id?: string; source_question_id: string; depends_on_question_id: string;
  operator: string; value_to_match: string; action: string; flag_type: string | null;
}

const QUESTION_TYPES = ['single_choice','multiple_choice','text','textarea','rating_scale','number','phone','email','dropdown'];
const PATH_TAGS = ['ENTRY','PATH_A','PATH_B','PATH_C','PATH_D','PATH_E','PATH_F','UNIVERSAL'];
const OPERATORS = ['=','!=','includes','excludes','greater_than','less_than'];
const ACTIONS = ['show','hide','require','flag'];
const FLAG_TYPES = ['priority_flag','churn_risk_flag','high_referrer_flag','upsell_candidate'];

const AdminForms = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [formId, setFormId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editQ, setEditQ] = useState<Partial<Question> | null>(null);
  const [editOptions, setEditOptions] = useState<Partial<Option>[]>([]);
  const [rules, setRules] = useState<LogicRule[]>([]);
  const [editRules, setEditRules] = useState<Partial<LogicRule>[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});

  useEffect(() => { loadQuestions(); }, []);

  async function loadQuestions() {
    setLoading(true);
    const { data: form } = await supabase.from('forms').select('id').eq('slug', 'feedback').single();
    if (!form) { setLoading(false); return; }
    setFormId(form.id);

    const [{ data: qData }, { data: rData }] = await Promise.all([
      supabase.from('questions').select('*, question_options(*)').eq('form_id', form.id).order('display_order'),
      supabase.from('logic_rules').select('*'),
    ]);

    const qs = (qData || []).map((q: Question) => ({
      ...q,
      question_options: (q.question_options || []).sort((a: Option, b: Option) => a.display_order - b.display_order)
    }));
    setQuestions(qs);
    setRules((rData || []) as LogicRule[]);
    setLoading(false);
  }

  function openNewQuestion() {
    if (!formId) return;
    setEditQ({ form_id: formId, question_text: '', question_type: 'single_choice', is_required: false, is_active: true,
      display_order: questions.length > 0 ? Math.max(...questions.map(q => q.display_order)) + 1 : 1, path_tag: 'UNIVERSAL' });
    setEditOptions([]);
    setEditRules([]);
  }

  function openEditQuestion(q: Question) {
    setEditQ({ ...q });
    setEditOptions((q.question_options || []).map(o => ({ ...o })));
    setEditRules(rules.filter(r => r.source_question_id === q.id).map(r => ({ ...r })));
  }

  async function saveQuestion() {
    if (!editQ?.question_text?.trim()) { toast.error('Question text is required'); return; }
    setSaving(true);

    const payload = {
      form_id: editQ.form_id || formId,
      question_text: editQ.question_text,
      helper_text: editQ.helper_text || null,
      question_type: editQ.question_type || 'text',
      category_tag: editQ.category_tag || null,
      path_tag: editQ.path_tag || null,
      is_required: editQ.is_required || false,
      is_active: editQ.is_active !== false,
      display_order: editQ.display_order || 99,
      placeholder_text: editQ.placeholder_text || null,
    };

    let qId = editQ.id;
    if (editQ.id) {
      await supabase.from('questions').update(payload).eq('id', editQ.id);
    } else {
      const { data } = await supabase.from('questions').insert(payload).select('id').single();
      qId = data?.id;
    }

    if (qId) {
      // Save options
      if (needsOptions(editQ.question_type || '')) {
        await supabase.from('question_options').delete().eq('question_id', qId);
        const optRows = editOptions.filter(o => o.option_text?.trim()).map((o, i) => ({
          question_id: qId!, option_text: o.option_text!, display_order: i + 1,
          option_value: o.option_value || (o.option_text || '').toLowerCase().replace(/\s+/g,'_').replace(/[^\w_]/g,''),
          icon_emoji: o.icon_emoji || null,
        }));
        if (optRows.length > 0) await supabase.from('question_options').insert(optRows);
      }

      // Save logic rules
      await supabase.from('logic_rules').delete().eq('source_question_id', qId);
      const validRules = editRules.filter(r => r.depends_on_question_id && r.operator && r.value_to_match && r.action);
      if (validRules.length > 0) {
        await supabase.from('logic_rules').insert(validRules.map(r => ({
          source_question_id: qId!, depends_on_question_id: r.depends_on_question_id!,
          operator: r.operator!, value_to_match: r.value_to_match!, action: r.action!,
          flag_type: r.action === 'flag' ? r.flag_type : null,
        })));
      }
    }

    setSaving(false);
    setEditQ(null);
    toast.success('Question saved');
    loadQuestions();
  }

  async function toggleActive(q: Question) {
    await supabase.from('questions').update({ is_active: !q.is_active }).eq('id', q.id);
    loadQuestions();
  }

  async function deleteQuestion(id: string) {
    if (!confirm('Delete this question and all its rules?')) return;
    await supabase.from('questions').delete().eq('id', id);
    toast.success('Question deleted');
    loadQuestions();
  }

  async function moveQuestion(q: Question, dir: 'up' | 'down') {
    const sorted = [...questions].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex(x => x.id === q.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx];
    await Promise.all([
      supabase.from('questions').update({ display_order: swap.display_order }).eq('id', q.id),
      supabase.from('questions').update({ display_order: q.display_order }).eq('id', swap.id),
    ]);
    loadQuestions();
  }

  const needsOptions = (type: string) => ['single_choice','multiple_choice','dropdown'].includes(type);

  // Simple preview: shows visible questions based on preview answers
  function getPreviewVisible() {
    return questions.filter(q => {
      if (!q.is_active) return false;
      const showRules = rules.filter(r => r.source_question_id === q.id && r.action === 'show');
      if (showRules.length === 0) return true;
      return showRules.some(r => previewAnswers[r.depends_on_question_id] === r.value_to_match);
    }).sort((a, b) => a.display_order - b.display_order);
  }

  const sorted = [...questions].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Form Builder</h1>
          <p className="text-sm text-muted-foreground">{questions.length} questions · HouseConnect Smart Feedback</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Play className="w-3.5 h-3.5 mr-1.5" />Preview
          </Button>
          <Button size="sm" onClick={openNewQuestion}>
            <Plus className="w-4 h-4 mr-1.5" />Add Question
          </Button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <div className="space-y-2">
          {sorted.map((q, idx) => {
            const qRules = rules.filter(r => r.source_question_id === q.id);
            return (
              <div key={q.id} className={`bg-card rounded-xl border p-4 flex gap-3 transition-colors ${q.is_active ? 'border-border' : 'border-dashed border-muted-foreground/30 opacity-60'}`}>
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button onClick={() => moveQuestion(q, 'up')} disabled={idx === 0} className="p-1 rounded hover:bg-muted disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                  <span className="text-[10px] text-muted-foreground text-center w-6">{q.display_order}</span>
                  <button onClick={() => moveQuestion(q, 'down')} disabled={idx === sorted.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1.5 flex-wrap mb-1">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">{q.question_type}</span>
                    {q.path_tag && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{q.path_tag}</span>}
                    {q.is_required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Required</span>}
                    {qRules.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-700 flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />{qRules.length} rule{qRules.length > 1 ? 's' : ''}</span>}
                  </div>
                  <p className="text-sm font-medium leading-snug">{q.question_text}</p>
                  {q.question_options && q.question_options.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">{q.question_options.length} options</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleActive(q)}>
                    {q.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditQuestion(q)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteQuestion(q.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit/Add Question Modal ── */}
      <Dialog open={!!editQ} onOpenChange={(o) => !o && setEditQ(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editQ?.id ? 'Edit Question' : 'New Question'}</DialogTitle>
          </DialogHeader>
          {editQ && (
            <Tabs defaultValue="question">
              <TabsList className="mb-4">
                <TabsTrigger value="question">Question</TabsTrigger>
                {needsOptions(editQ.question_type || '') && <TabsTrigger value="options">Options ({editOptions.length})</TabsTrigger>}
                <TabsTrigger value="logic">Logic Rules ({editRules.length})</TabsTrigger>
              </TabsList>

              {/* ── Question tab ── */}
              <TabsContent value="question" className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Question Text *</Label>
                  <Input value={editQ.question_text || ''} onChange={e => setEditQ(q => ({ ...q!, question_text: e.target.value }))} placeholder="Type your question..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Helper Text</Label>
                  <Input value={editQ.helper_text || ''} onChange={e => setEditQ(q => ({ ...q!, helper_text: e.target.value }))} placeholder="Optional sub-label..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Question Type</Label>
                    <Select value={editQ.question_type || 'text'} onValueChange={v => setEditQ(q => ({ ...q!, question_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Path Tag</Label>
                    <Select value={editQ.path_tag || ''} onValueChange={v => setEditQ(q => ({ ...q!, path_tag: v }))}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{PATH_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category Tag</Label>
                    <Input value={editQ.category_tag || ''} onChange={e => setEditQ(q => ({ ...q!, category_tag: e.target.value }))} placeholder="e.g. identity" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Display Order</Label>
                    <Input type="number" value={editQ.display_order || ''} onChange={e => setEditQ(q => ({ ...q!, display_order: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Placeholder Text</Label>
                  <Input value={editQ.placeholder_text || ''} onChange={e => setEditQ(q => ({ ...q!, placeholder_text: e.target.value }))} />
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={editQ.is_required || false} onCheckedChange={v => setEditQ(q => ({ ...q!, is_required: v }))} id="req" />
                    <Label htmlFor="req">Required</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editQ.is_active !== false} onCheckedChange={v => setEditQ(q => ({ ...q!, is_active: v }))} id="act" />
                    <Label htmlFor="act">Active</Label>
                  </div>
                </div>
              </TabsContent>

              {/* ── Options tab ── */}
              {needsOptions(editQ.question_type || '') && (
                <TabsContent value="options" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Add answer options in display order</p>
                    <Button size="sm" variant="outline" onClick={() => setEditOptions(o => [...o, { option_text: '', option_value: '', icon_emoji: '' }])}>
                      <Plus className="w-3.5 h-3.5 mr-1" />Add Option
                    </Button>
                  </div>
                  {editOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input className="w-12 text-center" value={opt.icon_emoji || ''} onChange={e => setEditOptions(opts => opts.map((o, j) => j === i ? { ...o, icon_emoji: e.target.value } : o))} placeholder="🎯" title="Emoji" />
                      <Input className="flex-1" value={opt.option_text || ''} onChange={e => setEditOptions(opts => opts.map((o, j) => j === i ? { ...o, option_text: e.target.value, option_value: e.target.value.toLowerCase().replace(/\s+/g,'_').replace(/[^\w_]/g,'') } : o))} placeholder="Option label" />
                      <Input className="w-32" value={opt.option_value || ''} onChange={e => setEditOptions(opts => opts.map((o, j) => j === i ? { ...o, option_value: e.target.value } : o))} placeholder="value_key" title="Option value (stored in DB)" />
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive flex-shrink-0" onClick={() => setEditOptions(opts => opts.filter((_, j) => j !== i))}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {editOptions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No options yet. Click "Add Option" to start.</p>}
                </TabsContent>
              )}

              {/* ── Logic Rules tab ── */}
              <TabsContent value="logic" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Define when this question shows, hides, or flags</p>
                  <Button size="sm" variant="outline" onClick={() => setEditRules(r => [...r, { source_question_id: editQ.id || '', depends_on_question_id: '', operator: '=', value_to_match: '', action: 'show', flag_type: null }])}>
                    <Plus className="w-3.5 h-3.5 mr-1" />Add Rule
                  </Button>
                </div>

                {editRules.map((rule, i) => (
                  <div key={i} className="border border-border rounded-xl p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                      <Zap className="w-3 h-3 text-yellow-500" />
                      Rule {i + 1}
                      <button className="ml-auto text-destructive hover:text-destructive" onClick={() => setEditRules(r => r.filter((_, j) => j !== i))}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Visual sentence: [Action] this question when [question] [operator] [value] */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Action</Label>
                        <Select value={rule.action} onValueChange={v => setEditRules(r => r.map((x, j) => j === i ? { ...x, action: v } : x))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      {rule.action === 'flag' && (
                        <div className="space-y-1">
                          <Label className="text-xs">Flag Type</Label>
                          <Select value={rule.flag_type || ''} onValueChange={v => setEditRules(r => r.map((x, j) => j === i ? { ...x, flag_type: v } : x))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose flag..." /></SelectTrigger>
                            <SelectContent>{FLAG_TYPES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1 col-span-3">
                        <Label className="text-xs">When question answer...</Label>
                        <Select value={rule.depends_on_question_id} onValueChange={v => setEditRules(r => r.map((x, j) => j === i ? { ...x, depends_on_question_id: v } : x))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select trigger question..." /></SelectTrigger>
                          <SelectContent className="max-h-56">
                            {questions.map(q => (
                              <SelectItem key={q.id} value={q.id}>
                                <span className="text-xs">[{q.display_order}] {q.question_text.slice(0, 50)}{q.question_text.length > 50 ? '…' : ''}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Operator</Label>
                        <Select value={rule.operator} onValueChange={v => setEditRules(r => r.map((x, j) => j === i ? { ...x, operator: v } : x))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{OPERATORS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Value to match</Label>
                        <Input className="h-8 text-xs" value={rule.value_to_match} onChange={e => setEditRules(r => r.map((x, j) => j === i ? { ...x, value_to_match: e.target.value } : x))} placeholder="e.g. PATH_A" />
                      </div>
                    </div>
                    {/* Human-readable preview */}
                    {rule.depends_on_question_id && rule.value_to_match && (
                      <p className="text-[10px] bg-primary/5 text-primary rounded px-2 py-1 font-mono">
                        {rule.action.toUpperCase()} this question when [{questions.find(q => q.id === rule.depends_on_question_id)?.display_order}] {rule.operator} "{rule.value_to_match}"
                        {rule.action === 'flag' && rule.flag_type ? ` → ${rule.flag_type}` : ''}
                      </p>
                    )}
                  </div>
                ))}
                {editRules.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                    No rules yet. This question always shows.<br/>
                    <span className="text-xs">Add a rule to control visibility or trigger flags.</span>
                  </div>
                )}
              </TabsContent>

              <div className="flex gap-2 pt-4 border-t border-border mt-4">
                <Button onClick={saveQuestion} className="flex-1" disabled={saving}>{saving ? 'Saving...' : 'Save Question'}</Button>
                <Button variant="outline" onClick={() => setEditQ(null)}>Cancel</Button>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Preview Modal ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" />
              Form Preview
              <span className="text-xs font-normal text-muted-foreground ml-1">— no data saved</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Click answers to see branching logic live</p>
              <Button size="sm" variant="ghost" onClick={() => setPreviewAnswers({})}>Reset</Button>
            </div>
            {getPreviewVisible().map(q => (
              <div key={q.id} className="border border-border rounded-xl p-3 space-y-2">
                <p className="text-sm font-medium">{q.question_text}{q.is_required && <span className="text-destructive ml-1">*</span>}</p>
                {q.helper_text && <p className="text-xs text-muted-foreground">{q.helper_text}</p>}
                {(q.question_options || []).length > 0 && (
                  <div className="grid gap-1.5">
                    {(q.question_options || []).map(opt => (
                      <button key={opt.id} onClick={() => setPreviewAnswers(a => ({ ...a, [q.id]: opt.option_value }))}
                        className={`text-left text-xs px-3 py-2 rounded-lg border transition-colors ${previewAnswers[q.id] === opt.option_value ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:border-primary/50'}`}>
                        {opt.icon_emoji && <span className="mr-1.5">{opt.icon_emoji}</span>}{opt.option_text}
                      </button>
                    ))}
                  </div>
                )}
                {(q.question_options || []).length === 0 && (
                  <div className={`h-8 rounded-lg border border-dashed border-border bg-muted/30 flex items-center px-3 text-xs text-muted-foreground`}>
                    {q.question_type} input
                  </div>
                )}
              </div>
            ))}
            {getPreviewVisible().length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">No questions visible yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminForms;
