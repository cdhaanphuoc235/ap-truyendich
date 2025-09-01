import React from "react";

export default function SectionCard({
  title,
  children,
  trailing,
}: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="section-title">{title}</h2>
        {trailing}
      </div>
      {children}
    </section>
  );
}
