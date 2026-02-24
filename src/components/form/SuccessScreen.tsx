import { CheckCircle, AlertTriangle, Gift, UserPlus, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessScreenProps {
  pathTaken: string;
  onReset?: () => void;
}

const PATH_MESSAGES: Record<string, { icon: React.ReactNode; title: string; message: string; color: string }> = {
  PATH_A: {
    icon: <Wifi className="w-8 h-8" />,
    title: 'Feedback Received!',
    message: "Got it. We'll use your feedback to investigate and improve speeds in your area. Keep an eye on your WhatsApp for updates.",
    color: 'text-primary',
  },
  PATH_B: {
    icon: <CheckCircle className="w-8 h-8" />,
    title: "Great Suggestions!",
    message: "Thanks! Your plan preferences have been noted. We'll factor them into our next update and reach out if we launch something that fits.",
    color: 'text-primary',
  },
  PATH_C: {
    icon: <Wifi className="w-8 h-8" />,
    title: 'Signal Issue Logged',
    message: "Signal issue noted. Our technical team will investigate your area. We'll reach out if we need more details.",
    color: 'text-primary',
  },
  PATH_D: {
    icon: <AlertTriangle className="w-8 h-8" />,
    title: '🚨 Urgent Issue Flagged',
    message: "Your urgent issue has been escalated to our team. We'll contact you within the hour. Thank you for your patience.",
    color: 'text-destructive',
  },
  PATH_E: {
    icon: <Gift className="w-8 h-8" />,
    title: 'Referral Recorded!',
    message: "Awesome! Your referral has been logged. Watch your WhatsApp — we'll send your personal referral link shortly.",
    color: 'text-primary',
  },
  PATH_F: {
    icon: <UserPlus className="w-8 h-8" />,
    title: 'Welcome to HouseConnect!',
    message: "Your profile is all set up. We've noted your preferences and will be in touch with the best plan for your needs.",
    color: 'text-primary',
  },
};

const DEFAULT_MESSAGE = {
  icon: <CheckCircle className="w-8 h-8" />,
  title: 'Thank You!',
  message: "Your feedback helps us improve your connection. We appreciate you taking the time.",
  color: 'text-primary',
};

export function SuccessScreen({ pathTaken, onReset }: SuccessScreenProps) {
  const msg = PATH_MESSAGES[pathTaken] || DEFAULT_MESSAGE;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Animated circle */}
      <div className={`w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center ${msg.color} animate-in zoom-in duration-500`}>
        {msg.icon}
      </div>

      <div className="space-y-3 max-w-sm">
        <h2 className="text-2xl font-bold text-foreground">{msg.title}</h2>
        <p className="text-muted-foreground leading-relaxed">{msg.message}</p>
      </div>

      {/* Decorative dots */}
      <div className="flex gap-2 py-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary/40"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>

      <div className="space-y-3 w-full max-w-xs">
        <p className="text-xs text-muted-foreground">
          HouseConnect ISP — Keeping you connected
        </p>
        {onReset && (
          <Button
            variant="outline"
            onClick={onReset}
            className="w-full"
          >
            Submit Another Response
          </Button>
        )}
      </div>
    </div>
  );
}
