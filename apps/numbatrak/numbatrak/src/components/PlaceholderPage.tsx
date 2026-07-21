import { PageLayout } from "./layout/PageLayout";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <PageLayout>
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-muted-foreground mt-2">
          {description ??
            "This section is planned and will be available in a future release."}
        </p>
      </div>
    </PageLayout>
  );
}
