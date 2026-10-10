type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
};

export function PageHeader({ title }: PageHeaderProps) {
  return <h2 className="sr-only">{title}</h2>;
}
