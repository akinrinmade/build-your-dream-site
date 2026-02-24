interface Option {
  id: string;
  option_text: string;
  option_value: string;
  icon_emoji: string | null;
}

interface MultipleChoiceProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function MultipleChoice({ options, value, onChange }: MultipleChoiceProps) {
  const toggle = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground mb-1">Select all that apply</p>
      {options.map((opt) => {
        const selected = value.includes(opt.option_value);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.option_value)}
            className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3
              ${selected
                ? 'border-primary bg-primary/10 text-primary font-semibold shadow-md shadow-primary/20'
                : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5 text-foreground'
              }`}
          >
            <span className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
              ${selected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
              {selected && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            {opt.icon_emoji && <span className="text-xl flex-shrink-0">{opt.icon_emoji}</span>}
            <span className="text-sm sm:text-base leading-snug">{opt.option_text}</span>
          </button>
        );
      })}
    </div>
  );
}
