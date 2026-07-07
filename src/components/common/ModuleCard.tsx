interface ModuleCardProps {
  title: string;
  description: string;
  status?: string;
}

export function ModuleCard({ title, description, status = "Estrutura base" }: ModuleCardProps) {
  return (
    <section className="module-card">
      <span>{status}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
