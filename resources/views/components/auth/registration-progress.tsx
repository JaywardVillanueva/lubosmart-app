import { Check } from 'lucide-react';

export default function RegistrationProgress({
    steps,
    current,
    busy,
    onSelect,
}: {
    steps: string[];
    current: number;
    busy: boolean;
    onSelect: (step: number) => void;
}) {
    return (
        <ol aria-label="Registration progress" className="auth-stepper grid grid-cols-3 gap-2 border-b pb-4">
            {steps.map((label, index) => (
                <li key={label} className="min-w-0 text-center">
                    <button
                        type="button"
                        disabled={busy || index > current}
                        aria-current={index === current ? 'step' : undefined}
                        onClick={() => onSelect(index)}
                        className="flex min-h-11 w-full flex-col items-center gap-1 text-xs sm:text-sm"
                    >
                        <span
                            className={`auth-step-indicator flex size-8 items-center justify-center rounded-full border font-semibold ${index <= current ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}
                        >
                            {index < current ? (
                                <>
                                    <Check className="size-4" aria-hidden="true" />
                                    <span className="sr-only">Completed:</span>
                                </>
                            ) : (
                                index + 1
                            )}
                        </span>
                        <span>{label}</span>
                    </button>
                </li>
            ))}
        </ol>
    );
}
