import { LucideIcon } from 'lucide-react';

interface AutomationCardProps {
  title: string;
  status: 'active' | 'idle' | 'error';
  lastRun: string;
  icon: LucideIcon;
  executions?: number;
}

export function AutomationCard({ title, status, lastRun, icon: Icon, executions }: AutomationCardProps) {
  const statusConfig = {
    active: { color: 'bg-green-100 text-green-700 border-green-200', label: 'Active' },
    idle: { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Idle' },
    error: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Error' },
  };

  const config = statusConfig[status];

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-gray-900 mb-1">{title}</h3>
          <p className="text-gray-500 text-sm mb-3">Last run: {lastRun}</p>
          
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full border ${config.color}`}>
              {config.label}
            </span>
            {executions !== undefined && (
              <span className="text-xs text-gray-500">{executions} runs today</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
