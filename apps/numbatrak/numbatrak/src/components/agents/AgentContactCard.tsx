import { Mail, Phone, User } from "lucide-react";
import type { Agent } from "../../types/agent";

interface AgentContactCardProps {
  agent: Agent | null;
  loading?: boolean;
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Phone;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  const display = value?.trim();
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        {display ? (
          href ? (
            <a
              href={href}
              className="text-sm text-primary hover:underline break-all"
            >
              {display}
            </a>
          ) : (
            <p className="text-sm text-foreground break-all">{display}</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Not provided</p>
        )}
      </div>
    </div>
  );
}

export function AgentContactCard({ agent, loading }: AgentContactCardProps) {
  const phone = agent?.contact_phone?.trim();
  const telHref = phone ? `tel:${phone.replace(/\s/g, "")}` : undefined;

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Contact</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ContactRow
            icon={User}
            label="Contact person"
            value={agent?.contact_person}
          />
          <ContactRow
            icon={Phone}
            label="Phone / WhatsApp"
            value={agent?.contact_phone}
            href={telHref}
          />
          <ContactRow
            icon={Mail}
            label="Email"
            value={agent?.contact_email}
            href={
              agent?.contact_email?.trim()
                ? `mailto:${agent.contact_email.trim()}`
                : undefined
            }
          />
        </div>
      )}
    </section>
  );
}
