// Tabush core UI components. Use these before writing new markup; see
// docs/design-system.md for when to use which.
import { useEffect, useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, Info, OctagonX, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/* Button ----------------------------------------------------------------- */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";
interface BtnOwn { variant?: Variant; size?: Size; icon?: LucideIcon; iconOnly?: boolean }
const btnClass = ({ variant = "secondary", size = "md", iconOnly }: BtnOwn, extra?: string) =>
  cx("ui-button", `ui-button--${variant}`, size === "sm" && "ui-button--sm", iconOnly && "ui-button--icon", extra);

export function Button({ variant, size, icon: Icon, iconOnly, className, children, ...rest }: BtnOwn & ComponentProps<"button">) {
  return (
    <button type="button" className={btnClass({ variant, size, iconOnly }, className)} {...rest}>
      {Icon && <Icon size={size === "sm" ? 14 : 16} aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, icon: Icon, iconOnly, className, children, ...rest }: BtnOwn & LinkProps) {
  return (
    <Link className={btnClass({ variant, size, iconOnly }, className)} {...rest}>
      {Icon && <Icon size={size === "sm" ? 14 : 16} aria-hidden />}
      {children}
    </Link>
  );
}

/* Status ------------------------------------------------------------------ */
// Status is never shown by colour alone: every tone has an icon and a word.
export type Tone = "danger" | "warning" | "success" | "info";
export const toneIcon: Record<Tone, LucideIcon> = { danger: OctagonX, warning: AlertTriangle, success: CheckCircle2, info: Info };

export function Badge({ tone = "neutral", icon: Icon, children }: { tone?: Tone | "neutral" | "accent" | "mock"; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={`ui-badge ui-badge--${tone}`}>
      {Icon && <Icon size={12} aria-hidden strokeWidth={2.5} />}
      {children}
    </span>
  );
}

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <Badge tone={tone} icon={toneIcon[tone]}>{children}</Badge>;
}

export function Callout({ tone, title, children }: { tone: Tone; title: ReactNode; children?: ReactNode }) {
  const Icon = toneIcon[tone];
  return (
    <div className={`ui-callout ui-callout--${tone}`} role={tone === "danger" ? "alert" : undefined}>
      <Icon size={18} className="ui-callout__icon" aria-hidden />
      <div className="stack-1">
        <div className="ui-callout__title">{title}</div>
        {children && <div className="text-sm">{children}</div>}
      </div>
    </div>
  );
}

/* Card ---------------------------------------------------------------------- */
export function Card({ title, description, actions, children, className }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("ui-card", className)}>
      {(title || actions) && (
        <header className="ui-card__header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p className="ui-card__description">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="ui-card__body">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone, icon: Icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "danger" | "warning"; icon?: LucideIcon }) {
  return (
    <div className={cx("ui-card ui-stat", tone && `ui-stat--${tone}`)}>
      <div className="ui-stat__label">{Icon && <Icon size={16} aria-hidden />}{label}</div>
      <div className="ui-stat__value">{value}</div>
      {hint && <div className="ui-stat__hint">{hint}</div>}
    </div>
  );
}

/* Meter: a 0..1 score with a plain-language level ----------------------------- */
export function riskLevel(v: number): { label: string; color: string } {
  if (v >= 0.75) return { label: "Very high", color: "var(--risk-5)" };
  if (v >= 0.6) return { label: "High", color: "var(--risk-4)" };
  if (v >= 0.35) return { label: "Medium", color: "var(--risk-3)" };
  if (v >= 0.15) return { label: "Low", color: "var(--risk-2)" };
  return { label: "Very low", color: "var(--risk-2)" };
}

export function Meter({ label, value }: { label: string; value: number }) {
  const lvl = riskLevel(value);
  return (
    <div className="ui-meter">
      <span className="ui-meter__label">{label}</span>
      <span className="ui-meter__track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} aria-valuetext={`${lvl.label} (${value.toFixed(2)})`}>
        <span className="ui-meter__fill" style={{ width: `${Math.max(3, value * 100)}%`, background: lvl.color }} />
      </span>
      <span className="ui-meter__value">
        <span className="ui-meter__level">{lvl.label}</span>
        <span className="num">{value.toFixed(2)}</span>
      </span>
    </div>
  );
}

/* Segmented control: a radiogroup with arrow-key support ----------------------- */
export function SegmentedControl<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; icon?: LucideIcon }[]; onChange: (v: T) => void }) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
    onChange(next.value);
    e.preventDefault();
  };
  return (
    <div className="ui-segmented" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map(({ value: v, label: l, icon: Icon }) => (
        <button key={v} role="radio" aria-checked={v === value} tabIndex={v === value ? 0 : -1} onClick={() => onChange(v)}>
          {Icon && <Icon size={14} aria-hidden />}{l}
        </button>
      ))}
    </div>
  );
}

/* Switch ------------------------------------------------------------------ */
// On/off for a single setting, such as showing a map layer. A real checkbox
// with role="switch", so it works with keyboard (Space) and screen readers.
export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx("ui-switch", disabled && "ui-switch--disabled")}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="ui-switch__track" aria-hidden><span className="ui-switch__thumb" /></span>
      <span className="ui-switch__text">
        <span className="ui-switch__label">{label}</span>
        {hint && <span className="ui-switch__hint">{hint}</span>}
      </span>
    </label>
  );
}

/* Disclosure: show summary first, details on demand -------------------------- */
export function Disclosure({ title, meta, defaultOpen, children }: { title: ReactNode; meta?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="ui-disclosure" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {meta && <span className="ui-disclosure__meta">{meta}</span>}
        <ChevronDown size={16} className="ui-disclosure__chevron" aria-hidden />
      </summary>
      <div className="ui-disclosure__body">{children}</div>
    </details>
  );
}

/* Search with a "/" keyboard shortcut ----------------------------------------- */
export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <label className="ui-search">
      <span className="visually-hidden">{label}</span>
      <Search size={16} aria-hidden />
      <input ref={ref} type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onChange("")} />
      {!value && <Kbd>/</Kbd>}
    </label>
  );
}

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="ui-kbd">{children}</kbd>;

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cx("ui-select", className)} {...rest} />;
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="ui-empty">
      <div className="ui-empty__icon"><Icon size={22} aria-hidden /></div>
      <div className="ui-empty__title">{title}</div>
      {children && <div>{children}</div>}
    </div>
  );
}

export const Skeleton = ({ width = "100%", height = 14 }: { width?: number | string; height?: number }) => (
  <div className="ui-skeleton" style={{ width, height }} aria-hidden />
);

export const Eyebrow = ({ children }: { children: ReactNode }) => <div className="ui-eyebrow">{children}</div>;
