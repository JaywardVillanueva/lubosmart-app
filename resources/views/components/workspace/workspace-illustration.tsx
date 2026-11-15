import { assets } from '@/config/assets';

/** Decorative delivery scene. Semantic colors follow the selected theme. */
export function WorkspaceIllustration() {
    return (
        <svg aria-hidden="true" focusable="false" viewBox="0 0 480 200" className="text-primary h-auto w-full">
            <ellipse cx="265" cy="190" rx="205" ry="5" fill="currentColor" opacity=".12" />
            <path d="M0 190C20 90 95 20 210 35S390 0 480 15V190Z" fill="currentColor" opacity=".06" />
            <path d="M170 190C215 80 370 75 480 105V190Z" fill="currentColor" opacity=".05" />
            <rect x="170" y="66" width="162" height="108" rx="13" className="fill-accent stroke-primary/25" strokeWidth="2" />
            <path d="M94 88H158V174H65V139L82 101Q86 88 94 88Z" className="fill-card stroke-primary/30" strokeWidth="2" />
            <path d="M96 96H142V125H83Z" fill="currentColor" opacity=".8" />
            <rect x="71" y="139" width="23" height="10" rx="3" className="fill-accent" />
            <rect x="130" y="139" width="16" height="10" rx="3" className="fill-accent" />
            <path d="M64 164H333V178H64Z" fill="currentColor" opacity=".7" />
            <circle cx="108" cy="177" r="17" className="fill-foreground" />
            <circle cx="108" cy="177" r="8" className="fill-accent" />
            <circle cx="290" cy="177" r="17" className="fill-foreground" />
            <circle cx="290" cy="177" r="8" className="fill-accent" />
            <image href={assets.brand.logo} x="217" y="88" width="65" height="65" />
            <g className="fill-brand-orange stroke-brand-orange" strokeWidth="1">
                <rect x="340" y="134" width="54" height="54" rx="4" fillOpacity=".55" strokeOpacity=".2" />
                <rect x="398" y="148" width="49" height="40" rx="4" fillOpacity=".35" strokeOpacity=".2" />
                <rect x="354" y="93" width="59" height="39" rx="4" fillOpacity=".4" strokeOpacity=".2" />
            </g>
            <path d="M365 134V151M421 148V161M383 94V107" className="stroke-card" strokeWidth="8" opacity=".65" />
            <path d="M386 19C371 19 363 29 363 40C363 55 386 74 386 74S409 55 409 40C409 29 401 19 386 19Z" fill="currentColor" opacity=".8" />
            <circle cx="386" cy="39" r="8" className="fill-card" />
        </svg>
    );
}
