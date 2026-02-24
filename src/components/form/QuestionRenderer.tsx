import { SingleChoice } from './question-types/SingleChoice';
import { MultipleChoice } from './question-types/MultipleChoice';
import { RatingScale, TextInput, TextArea, NumberInput, PhoneInput } from './question-types/Inputs';

interface Option {
  id: string;
  option_text: string;
  option_value: string;
  icon_emoji: string | null;
}

interface Question {
  id: string;
  question_text: string;
  helper_text: string | null;
  question_type: string;
  is_required: boolean;
  placeholder_text: string | null;
  question_options?: Option[];
}

interface QuestionRendererProps {
  question: Question;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  showValidation?: boolean;
}

export function QuestionRenderer({ question, value, onChange, showValidation }: QuestionRendererProps) {
  const options = (question.question_options || []).sort((a, b) => 0);
  const strValue = (value as string) || '';
  const arrValue = (value as string[]) || [];

  switch (question.question_type) {
    case 'single_choice':
      return (
        <SingleChoice
          options={options}
          value={strValue}
          onChange={onChange as (v: string) => void}
        />
      );

    case 'dropdown':
      return (
        <select
          value={strValue}
          onChange={(e) => (onChange as (v: string) => void)(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
        >
          <option value="">Select an option...</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.option_value}>
              {opt.icon_emoji ? `${opt.icon_emoji} ` : ''}{opt.option_text}
            </option>
          ))}
        </select>
      );

    case 'multiple_choice':
      return (
        <MultipleChoice
          options={options}
          value={Array.isArray(value) ? value : value ? [value as string] : []}
          onChange={onChange as (v: string[]) => void}
        />
      );

    case 'rating_scale':
      return (
        <RatingScale
          value={strValue}
          onChange={onChange as (v: string) => void}
        />
      );

    case 'text':
    case 'email':
      return (
        <TextInput
          value={strValue}
          onChange={onChange as (v: string) => void}
          placeholder={question.placeholder_text || undefined}
          required={question.is_required}
        />
      );

    case 'textarea':
      return (
        <TextArea
          value={strValue}
          onChange={onChange as (v: string) => void}
          placeholder={question.placeholder_text || undefined}
          required={question.is_required}
        />
      );

    case 'number':
      return (
        <NumberInput
          value={strValue}
          onChange={onChange as (v: string) => void}
          placeholder={question.placeholder_text || undefined}
          required={question.is_required}
        />
      );

    case 'phone':
      return (
        <PhoneInput
          value={strValue}
          onChange={onChange as (v: string) => void}
          placeholder={question.placeholder_text || undefined}
          required={question.is_required}
          showValidation={showValidation}
        />
      );

    default:
      return (
        <TextInput
          value={strValue}
          onChange={onChange as (v: string) => void}
          placeholder={question.placeholder_text || undefined}
        />
      );
  }
}
