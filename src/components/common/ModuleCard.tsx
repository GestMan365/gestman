import { useId } from "react";

interface ModuleCardProps {
  title: string;
  description: string;
  status?: string;
}

export function ModuleCard({ title, description, status = "Estrutura base" }: ModuleCardProps) {
  const titleId = useId();

  return (
    <section className="module-card" aria-labelledby={titleId}>
      <span>{status}</span>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
