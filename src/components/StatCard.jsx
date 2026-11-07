import React from 'react';

export function StatCard({ title, value, trend, icon }) {
  return (
    <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 hover:border-zinc-600 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-bold text-white mt-1">{value}</h3>
        </div>
        <div className="p-2 bg-zinc-800 rounded-lg">{icon}</div>
      </div>
      <p className="text-xs text-zinc-500 mt-3 flex items-center gap-1">
        <span className="text-green-500">▲</span> {trend}
      </p>
    </div>
  );
}