type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
};

export function PageHeader({ title, eyebrow, description }: PageHeaderProps) {
  return (
    <div className="mb-3 min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-display text-xl font-semibold leading-7 text-ink">{title}</h2>
        {eyebrow ? <span className="rounded bg-[#e4efe9] px-2 py-1 text-[10px] font-bold uppercase text-moss">{eyebrow}</span> : null}
      </div>
      {description ? <p className="sr-only">{description}</p> : null}
    </div>
  );
}
