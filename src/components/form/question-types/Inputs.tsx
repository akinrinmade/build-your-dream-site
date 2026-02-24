import { validateNigerianPhone } from '@/lib/metadata';

interface RatingScaleProps {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
}

export function RatingScale({ value, onChange, min = 1, max = 5 }: RatingScaleProps) {
  const labels: Record<number, string> = {
    1: 'Very Poor',
    2: 'Poor',
    3: 'Average',
    4: 'Good',
    5: 'Excellent',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 justify-between">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(String(n))}
            className={`flex-1 aspect-square rounded-xl border-2 text-lg font-bold transition-all duration-200
              ${value === String(n)
                ? 'border-primary bg-primary text-white shadow-lg shadow-primary/30 scale-110'
                : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5 text-foreground'
              }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Very Poor</span>
        <span>Excellent</span>
      </div>
      {value && (
        <p className="text-center text-sm font-medium text-primary">
          {labels[Number(value)] || value}
        </p>
      )}
    </div>
  );
}

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function TextInput({ value, onChange, placeholder, required }: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || 'Type your answer...'}
      required={required}
      className="w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
    />
  );
}

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function TextArea({ value, onChange, placeholder, required }: TextAreaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || 'Type your answer...'}
      required={required}
      rows={5}
      className="w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
    />
  );
}

interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function NumberInput({ value, onChange, placeholder, required }: NumberInputProps) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || '0'}
      required={required}
      className="w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
    />
  );
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  showValidation?: boolean;
}

export function PhoneInput({ value, onChange, placeholder, required, showValidation = false }: PhoneInputProps) {
  const isValid = value.length === 0 || validateNigerianPhone(value);

  return (
    <div className="space-y-1">
      <input
        type="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '+234 XXX XXX XXXX'}
        required={required}
        className={`w-full px-4 py-3 rounded-xl border-2 bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 outline-none transition-all
          ${showValidation && value.length > 0 && !isValid
            ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
            : 'border-border focus:border-primary focus:ring-primary/20'
          }`}
      />
      {showValidation && value.length > 0 && !isValid && (
        <p className="text-xs text-destructive px-1">Please enter a valid Nigerian number (e.g. +234 810 000 0000)</p>
      )}
    </div>
  );
}
