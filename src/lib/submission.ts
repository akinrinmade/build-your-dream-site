import { supabase } from '@/integrations/supabase/client';
import { computeFlags, LogicRule, Answers } from './logicEvaluator';
import { detectDeviceType, detectBrowser, detectOS, getUTMParams } from './metadata';

interface Question {
  id: string;
  question_type: string;
  category_tag: string | null;
}

interface SubmitParams {
  formId: string;
  estateId: string;
  answers: Answers;
  questions: Question[];
  rules: LogicRule[];
  sessionId: string;
}

export async function submitForm(params: SubmitParams): Promise<{ success: boolean; error?: string }> {
  const { formId, estateId, answers, questions, rules, sessionId } = params;
  const utmParams = getUTMParams();
  const flags = computeFlags(rules, answers);

  // Compute customer tier from PATH_F answers
  const wtpQuestion = questions.find(q => q.category_tag === 'willingness_to_pay');
  const usageQuestion = questions.find(q => q.category_tag === 'usage_volume');
  let customerTier: 'high_value' | 'standard' | 'budget' = 'standard';

  if (wtpQuestion && usageQuestion) {
    const wtp = answers[wtpQuestion.id] as string;
    const usage = answers[usageQuestion.id] as string;
    if ((wtp === '10000_15000' || wtp === 'gt_15000') && (usage === '25_50gb' || usage === 'gt_50gb')) {
      customerTier = 'high_value';
    } else if (wtp === 'lt_5000') {
      customerTier = 'budget';
    }
  }

  // Get phone number from universal questions
  const phoneQuestion = questions.find(q => q.category_tag === 'identity' && q.question_type === 'phone');
  const phoneNumber = phoneQuestion ? (answers[phoneQuestion.id] as string) || null : null;

  // PATH_D always sets priority flag
  const entryQuestion = questions.find(q => q.category_tag === 'entry');
  if (entryQuestion && answers[entryQuestion.id] === 'PATH_D') {
    flags.priority_flag = true;
  }

  // 1. Generate the response ID right here instead of waiting for the database
  const responseId = crypto.randomUUID();

  try {
    const { error: responseError } = await supabase
      .from('responses')
      .insert({
        id: responseId, // 2. Insert the generated ID
        form_id: formId,
        estate_id: estateId,
        user_agent: navigator.userAgent,
        device_type: detectDeviceType(),
        browser: detectBrowser(),
        os: detectOS(),
        session_id: sessionId,
        phone_number: phoneNumber,
        customer_tier: customerTier,
        source: 'live_form',
        ...flags,
        ...utmParams,
      });
      // 3. REMOVED `.select('id').single()` here!

    if (responseError) {
      return { success: false, error: responseError?.message || 'Failed to save response' };
    }

    // Build answers array - only answered questions
    const answerRows: Array<{ response_id: string; question_id: string; answer_value: string }> = [];

    for (const question of questions) {
      const answer = answers[question.id];
      if (answer === undefined || answer === null || answer === '') continue;

      if (Array.isArray(answer)) {
        answerRows.push({
          response_id: responseId, // 4. Use the generated ID
          question_id: question.id,
          answer_value: JSON.stringify(answer),
        });
      } else {
        answerRows.push({
          response_id: responseId, // 4. Use the generated ID
          question_id: question.id,
          answer_value: answer,
        });
      }
    }

    if (answerRows.length > 0) {
      // The answers insert doesn't use .select(), so it won't hit the RLS read error
      const { error: answersError } = await supabase.from('answers').insert(answerRows);
      if (answersError) {
        return { success: false, error: answersError.message };
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: 'Unexpected error submitting form' };
  }
}
