'use client';

import { CheckCircle, Circle, Clock, X } from 'lucide-react';

interface TaskStatus {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'active' | 'upcoming' | 'dormant' | 'skipped';
}

interface TaskStatusCardsProps {
  tasks: TaskStatus[];
}

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'completed':
      return {
        bg: 'bg-gradient-to-br from-cyan-500/20 to-blue-600/20',
        border: 'border-cyan-400/50',
        badgeBg: 'bg-cyan-500',
        text: 'text-cyan-300',
        icon: CheckCircle,
      };
    case 'active':
      return {
        bg: 'bg-gradient-to-br from-purple-600/20 to-pink-600/20',
        border: 'border-purple-500/50',
        badgeBg: 'bg-purple-500',
        text: 'text-purple-300',
        icon: Circle,
      };
    case 'upcoming':
      return {
        bg: 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20',
        border: 'border-yellow-400/50',
        badgeBg: 'bg-yellow-500',
        text: 'text-yellow-300',
        icon: Clock,
      };
    case 'skipped':
      return {
        bg: 'bg-gradient-to-br from-gray-700/20 to-gray-800/20',
        border: 'border-gray-600/50',
        badgeBg: 'bg-gray-600',
        text: 'text-gray-400',
        icon: X,
      };
    default:
      return {
        bg: 'bg-gradient-to-br from-slate-700/20 to-slate-800/20',
        border: 'border-slate-600/50',
        badgeBg: 'bg-slate-600',
        text: 'text-slate-400',
        icon: Circle,
      };
  }
};

export default function TaskStatusCards({ tasks }: TaskStatusCardsProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {tasks.map((task) => {
        const style = getStatusStyle(task.status);
        const Icon = style.icon;

        return (
          <div
            key={task.id}
            className={`${style.bg} ${style.border} border-2 rounded-xl p-4 card-shadow transition-all duration-300 hover:scale-105`}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-bold text-white">{task.name}</h3>
              <Icon className={`w-5 h-5 ${style.text}`} />
            </div>
            <p className="text-xs text-gray-300 mb-3 leading-relaxed">
              {task.description}
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`${style.badgeBg} text-white text-xs font-medium px-3 py-1 rounded-full capitalize`}
              >
                {task.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

