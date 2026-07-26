interface AbandonedCart {
  id: string;
  customer: string;
  email: string;
  items: number;
  value: string;
  timeAgo: string;
}

interface PendingRemittance {
  id: string;
  agent: string;
  amount: string;
  dueDate: string;
  daysOverdue: number;
  status: 'warning' | 'critical';
}

interface Waybill {
  id: string;
  orderId: string;
  destination: string;
  eta: string;
  timeLeft: string;
  status: 'on-time' | 'at-risk' | 'delayed';
}

interface CRSPerformance {
  agent: string;
  region: string;
  strikes: number;
  followUpRate: string;
  compliance: 'good' | 'warning' | 'poor';
}

const abandonedCarts: AbandonedCart[] = [
  { id: 'C001', customer: 'Adebayo Johnson', email: 'adebayo@email.com', items: 3, value: '₦45,000', timeAgo: '2h ago' },
  { id: 'C002', customer: 'Chiamaka Obi', email: 'chiamaka@email.com', items: 5, value: '₦78,500', timeAgo: '5h ago' },
  { id: 'C003', customer: 'Ibrahim Musa', email: 'ibrahim@email.com', items: 2, value: '₦32,000', timeAgo: '8h ago' },
  { id: 'C004', customer: 'Funke Adeyemi', email: 'funke@email.com', items: 4, value: '₦56,200', timeAgo: '1d ago' },
];

const pendingRemittances: PendingRemittance[] = [
  { id: 'R001', agent: 'Lagos-3', amount: '₦245,000', dueDate: 'Dec 1', daysOverdue: 2, status: 'warning' },
  { id: 'R002', agent: 'Abuja-1', amount: '₦180,000', dueDate: 'Nov 28', daysOverdue: 5, status: 'critical' },
  { id: 'R003', agent: 'PH-2', amount: '₦320,000', dueDate: 'Dec 2', daysOverdue: 1, status: 'warning' },
  { id: 'R004', agent: 'Ibadan-1', amount: '₦195,000', dueDate: 'Nov 25', daysOverdue: 8, status: 'critical' },
];

const waybills: Waybill[] = [
  { id: 'WB12845', orderId: '#12845', destination: 'Lekki, Lagos', eta: 'Dec 3, 4PM', timeLeft: '6h left', status: 'on-time' },
  { id: 'WB12846', orderId: '#12846', destination: 'Garki, Abuja', eta: 'Dec 3, 2PM', timeLeft: '4h left', status: 'at-risk' },
  { id: 'WB12847', orderId: '#12847', destination: 'GRA, PH', eta: 'Dec 3, 12PM', timeLeft: 'Overdue', status: 'delayed' },
  { id: 'WB12848', orderId: '#12848', destination: 'Bodija, Ibadan', eta: 'Dec 3, 6PM', timeLeft: '8h left', status: 'on-time' },
];

const crsPerformance: CRSPerformance[] = [
  { agent: 'Lagos-1', region: 'Lagos', strikes: 0, followUpRate: '98%', compliance: 'good' },
  { agent: 'Lagos-3', region: 'Lagos', strikes: 2, followUpRate: '85%', compliance: 'warning' },
  { agent: 'Abuja-1', region: 'Abuja', strikes: 3, followUpRate: '72%', compliance: 'poor' },
  { agent: 'PH-2', region: 'Port Harcourt', strikes: 1, followUpRate: '92%', compliance: 'good' },
];

export function DataTables() {
  return (
    <div className="space-y-6">
      {/* Abandoned Carts */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-foreground">Abandoned Carts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-foreground text-sm">ID</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Customer</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Email</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Items</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Value</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {abandonedCarts.map((cart) => (
                <tr key={cart.id} className="hover:bg-accent">
                  <td className="px-6 py-4 text-sm text-foreground">{cart.id}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{cart.customer}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{cart.email}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{cart.items}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{cart.value}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{cart.timeAgo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Remittances */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-foreground">Pending Remittances</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-foreground text-sm">ID</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Agent</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Amount</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Due Date</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Days Overdue</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pendingRemittances.map((remittance) => (
                <tr key={remittance.id} className="hover:bg-accent">
                  <td className="px-6 py-4 text-sm text-foreground">{remittance.id}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{remittance.agent}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{remittance.amount}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{remittance.dueDate}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{remittance.daysOverdue}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${
                      remittance.status === 'warning' 
                        ? 'bg-amber-500/20 text-amber-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {remittance.status === 'warning' ? 'Warning' : 'Critical'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Waybill Countdown */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-foreground">Waybill Countdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-foreground text-sm">Waybill</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Order ID</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Destination</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">ETA</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Time Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {waybills.map((waybill) => (
                <tr key={waybill.id} className="hover:bg-accent">
                  <td className="px-6 py-4 text-sm text-foreground">{waybill.id}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{waybill.orderId}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{waybill.destination}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{waybill.eta}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{waybill.timeLeft}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRS Performance */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-foreground">CRS Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-foreground text-sm">Agent</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Region</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Strikes</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Follow-up Rate</th>
                <th className="px-6 py-3 text-left text-foreground text-sm">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {crsPerformance.map((agent, index) => (
                <tr key={index} className="hover:bg-accent">
                  <td className="px-6 py-4 text-sm text-foreground">{agent.agent}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{agent.region}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{agent.strikes}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{agent.followUpRate}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${
                      agent.compliance === 'good' ? 'bg-green-500/20 text-green-400' :
                      agent.compliance === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {agent.compliance === 'good' ? 'Good' : 
                       agent.compliance === 'warning' ? 'Warning' : 'Poor'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
