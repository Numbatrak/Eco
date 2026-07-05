import { paginationQuerySchema } from "@platform/shared-types";

export default function HomePage(): React.ReactElement {
  const defaultPagination = paginationQuerySchema.parse({});

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">Storefront</h1>
      <p className="text-sm text-gray-500">
        Scaffold placeholder. Default page size: {defaultPagination.pageSize}
      </p>
    </main>
  );
}
