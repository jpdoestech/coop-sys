type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
};

export function PageHeader({ title, eyebrow, description }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 font-display text-3xl font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm text-ink/70">{description}</p> : null}
    </div>
  );
}
