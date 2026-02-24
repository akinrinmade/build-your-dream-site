import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shouldShowQuestion, LogicRule, Answers } from '@/lib/logicEvaluator';
import { submitForm } from '@/lib/submission';
import { generateSessionId, validateNigerianPhone } from '@/lib/metadata';
import { QuestionRenderer } from './QuestionRenderer';
import { ProgressBar } from './ProgressBar';
import { SuccessScreen } from './SuccessScreen';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, Wifi } from 'lucide-react';
import { toast } from 'sonner';

interface Option {
  id: string;
  option_text: string;
  option_value: string;
  icon_emoji: string | null;
  display_order: number;
}

interface Question {
  id: string;
  question_text: string;
  helper_text: string | null;
  question_type: string;
  category_tag: string | null;
  path_tag: string | null;
  is_required: boolean;
  is_active: boolean;
  display_order: number;
  placeholder_text: string | null;
  validation_rule: Record<string, unknown> | null;
  question_options?: Option[];
}

interface Form {
  id: string;
  name: string;
  description: string | null;
  estate_id: string;
}

const SESSION_ID = generateSessionId();

// Question types that auto-advance on selection
const AUTO_ADVANCE_TYPES = ['single_choice', 'dropdown'];

export function FormEngine() {
  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [rules, setRules] = useState<LogicRule[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [pathTaken, setPathTaken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [animating, setAnimating] = useState(false);
  const [displayStep, setDisplayStep] = useState(0);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadForm();
  }, []);

  async function loadForm() {
    setLoading(true);
    setError(null);
    try {
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('*')
        .eq('is_active', true)
        .eq('slug', 'feedback')
        .single();

      if (formError || !formData) {
        setError('Error: ' + (formError?.message || formError?.code || 'No form found'));
        return;
      }
      setForm(formData as Form);

      const { data: questionsData, error: qError } = await supabase
        .from('questions')
        .select('*, question_options(*)')
        .eq('form_id', formData.id)
        .eq('is_active', true)
        .order('display_order');

      if (qError || !questionsData) {
        setError('Failed to load form questions.');
        return;
      }

      const sortedQuestions = (questionsData as Question[]).map(q => ({
        ...q,
        question_options: (q.question_options || []).sort(
          (a: Option, b: Option) => a.display_order - b.display_order
        ),
      }));

      setQuestions(sortedQuestions);

      const { data: rulesData } = await supabase
        .from('logic_rules')
        .select('*');

      setRules((rulesData as LogicRule[]) || []);
    } catch {
      setError('Failed to load form. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }

  const visibleQuestions = useCallback(() => {
    return questions.filter(q => shouldShowQuestion(q.id, rules, answers));
  }, [questions, rules, answers]);

  const visible = visibleQuestions();
  const currentQuestion = visible[displayStep];

  // Smooth step transition
  function goToStep(nextStep: number, dir: 'forward' | 'back') {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setDisplayStep(nextStep);
      setCurrentStep(nextStep);
      setAnimating(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 220);
  }

  const handleAnswer = (questionId: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setShowValidation(false);

    const entryQ = questions.find(q => q.category_tag === 'entry');
    if (entryQ && questionId === entryQ.id) {
      setPathTaken(value as string);
    }

    // Auto-advance for single choice / dropdown
    if (currentQuestion && AUTO_ADVANCE_TYPES.includes(currentQuestion.question_type)) {
      const vis = questions.filter(q => shouldShowQuestion(q.id, rules, { ...answers, [questionId]: value }));
      const isLast = displayStep === vis.length - 1;
      if (!isLast) {
        if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = setTimeout(() => {
          goToStep(displayStep + 1, 'forward');
        }, 300);
      }
    }
  };

  function validateCurrentQuestion(): boolean {
    if (!currentQuestion) return true;
    const value = answers[currentQuestion.id];

    if (currentQuestion.is_required) {
      if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
        return false;
      }
    }

    if (currentQuestion.question_type === 'phone' && value) {
      if (!validateNigerianPhone(value as string)) return false;
    }

    return true;
  }

  function handleNext() {
    if (!validateCurrentQuestion()) {
      setShowValidation(true);
      toast.error(
        currentQuestion?.question_type === 'phone'
          ? 'Please enter a valid Nigerian phone number'
          : 'Please answer this question before continuing'
      );
      return;
    }
    setShowValidation(false);
    if (displayStep < visible.length - 1) {
      goToStep(displayStep + 1, 'forward');
    }
  }

  function handleBack() {
    if (displayStep > 0) {
      setShowValidation(false);
      goToStep(displayStep - 1, 'back');
    }
  }

  async function handleSubmit() {
    if (!validateCurrentQuestion()) {
      setShowValidation(true);
      toast.error('Please answer this question before submitting');
      return;
    }

    if (!form) return;
    setSubmitting(true);

    const result = await submitForm({
      formId: form.id,
      estateId: form.estate_id,
      answers,
      questions,
      rules,
      sessionId: SESSION_ID,
    });

    setSubmitting(false);

    if (result.success) {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      toast.error(result.error || 'Submission failed. Please try again.');
    }
  }

  function handleReset() {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    setAnswers({});
    setCurrentStep(0);
    setDisplayStep(0);
    setSubmitted(false);
    setPathTaken('');
    setShowValidation(false);
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Wifi className="w-8 h-8 text-primary animate-pulse" />
        </div>
        <p className="text-muted-foreground text-sm">Loading your form...</p>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <p className="text-destructive font-medium">{error}</p>
        <Button onClick={loadForm} variant="outline">Try Again</Button>
      </div>
    );
  }

  // ── Success state ──
  if (submitted) {
    return <SuccessScreen pathTaken={pathTaken} onReset={handleReset} />;
  }

  if (!currentQuestion) return null;

  const isLastStep = displayStep === visible.length - 1;
  const currentValue = answers[currentQuestion.id];
  const isRequired = currentQuestion.is_required;
  const hasValue = currentValue && (Array.isArray(currentValue) ? currentValue.length > 0 : currentValue !== '');
  const canProceed = !isRequired || hasValue;
  const isAutoAdvance = AUTO_ADVANCE_TYPES.includes(currentQuestion.question_type);

  // Animation classes
  const slideClass = animating
    ? direction === 'forward'
      ? 'opacity-0 translate-x-6'
      : 'opacity-0 -translate-x-6'
    : 'opacity-100 translate-x-0';

  return (
    <div className="space-y-6">
      {/* Progress */}
      <ProgressBar current={displayStep + 1} total={visible.length} />

      {/* Animated question area */}
      <div
        className={`space-y-5 transition-all duration-200 ease-out ${slideClass}`}
        style={{ willChange: 'transform, opacity' }}
      >
        {/* Question header */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug flex-1">
              {currentQuestion.question_text}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </h2>
          </div>
          {currentQuestion.helper_text && (
            <p className="text-sm text-muted-foreground">{currentQuestion.helper_text}</p>
          )}
        </div>

        {/* Answer area */}
        <div>
          <QuestionRenderer
            question={currentQuestion}
            value={currentValue || (currentQuestion.question_type === 'multiple_choice' ? [] : '')}
            onChange={(val) => handleAnswer(currentQuestion.id, val)}
            showValidation={showValidation}
          />
        </div>

        {/* Validation message */}
        {showValidation && !hasValue && isRequired && (
          <p className="text-sm text-destructive animate-in fade-in">
            This question is required
          </p>
        )}

        {/* Auto-advance hint */}
        {isAutoAdvance && !hasValue && (
          <p className="text-xs text-muted-foreground text-center">
            Select an option to continue automatically
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        {/* Back button — always show if not first step */}
        {displayStep > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            disabled={submitting || animating}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground text-sm font-medium hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Go back"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          // Invisible placeholder to keep layout stable on first step
          <div className="w-[88px] flex-shrink-0" />
        )}

        {/* Next / Submit */}
        {isLastStep ? (
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl"
            disabled={submitting || animating}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Feedback'
            )}
          </Button>
        ) : (
          !isAutoAdvance || hasValue ? (
            <Button
              onClick={handleNext}
              className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl"
              disabled={!canProceed || animating}
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            // For auto-advance questions with no answer yet, show a dimmed Continue
            <Button
              onClick={handleNext}
              className="flex-1 py-3 rounded-xl font-semibold"
              variant="outline"
              disabled={!canProceed || animating}
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )
        )}
      </div>
    </div>
  );
}
