// Wordmark: bold rounded sans with an orange spark over the "u".
export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`logo ${inverse ? "logo--inverse" : ""}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3c-3.5 2-6 5.5-6 9.5 0 3.6 2.7 6.5 6 8.5 3.3-2 6-4.9 6-8.5C18 8.5 15.5 5 12 3Z" fill="currentColor" opacity="0.18" />
        <path d="M12 21V8M12 12l-3-2M12 15l3-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="18.5" cy="5.5" r="2.5" fill="var(--color-spark)" />
      </svg>
      tabush
    </span>
  );
}
