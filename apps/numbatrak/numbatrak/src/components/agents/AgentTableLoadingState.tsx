import { LoadingState } from "../ui/LoadingState";

export function AgentTableLoadingState() {
  return (
    <tr>
      <td colSpan={5} className="px-6 py-12 text-center">
        <LoadingState label="Loading agents…" size="md" className="py-6" />
      </td>
    </tr>
  );
}
