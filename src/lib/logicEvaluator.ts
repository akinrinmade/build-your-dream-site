export interface LogicRule {
  id: string;
  source_question_id: string;
  depends_on_question_id: string;
  operator: string;
  value_to_match: string;
  action: string;
  flag_type: string | null;
}

export type Answers = Record<string, string | string[]>;

export function evaluateRule(rule: LogicRule, answers: Answers): boolean {
  const answer = answers[rule.depends_on_question_id];
  if (answer === undefined || answer === null) return false;

  const answerStr = Array.isArray(answer) ? answer : [answer];
  const match = rule.value_to_match;

  switch (rule.operator) {
    case '=':
      return answerStr.includes(match);
    case '!=':
      return !answerStr.includes(match);
    case 'includes':
      return answerStr.some((a) => a === match || a.includes(match));
    case 'excludes':
      return !answerStr.some((a) => a === match || a.includes(match));
    case 'greater_than':
      return Number(answerStr[0]) > Number(match);
    case 'less_than':
      return Number(answerStr[0]) < Number(match);
    default:
      return false;
  }
}

export function shouldShowQuestion(
  questionId: string,
  rules: LogicRule[],
  answers: Answers
): boolean {
  const showRules = rules.filter(
    (r) => r.source_question_id === questionId && r.action === 'show'
  );
  const hideRules = rules.filter(
    (r) => r.source_question_id === questionId && r.action === 'hide'
  );

  // No rules = always show
  if (showRules.length === 0 && hideRules.length === 0) return true;

  // If hide rules exist and any match, hide
  if (hideRules.some((r) => evaluateRule(r, answers))) return false;

  // If show rules exist, at least one must match
  if (showRules.length > 0) {
    return showRules.some((r) => evaluateRule(r, answers));
  }

  return true;
}

export function computeFlags(
  rules: LogicRule[],
  answers: Answers
): Record<string, boolean> {
  const flags: Record<string, boolean> = {
    priority_flag: false,
    churn_risk_flag: false,
    high_referrer_flag: false,
    upsell_candidate: false,
  };

  const flagRules = rules.filter((r) => r.action === 'flag' && r.flag_type);
  for (const rule of flagRules) {
    if (evaluateRule(rule, answers) && rule.flag_type) {
      flags[rule.flag_type] = true;
    }
  }

  return flags;
}
