import { useState } from 'react';
import { PlugZap, Building2, Flame, Phone, ChevronRight } from 'lucide-react';
import MeterList from './MeterList';
import PtclLineList from './PtclLineList';

export default function UtilitiesBillDashboard() {
  const [section, setSection] = useState(null); // null | 'billing' | 'department' | 'gas' | 'ptcl'

  if (section === 'billing') return <MeterList type="billing" utility="electricity" onBack={() => setSection(null)} />;
  if (section === 'department') return <MeterList type="department" utility="electricity" onBack={() => setSection(null)} />;
  if (section === 'gas') return <MeterList type="billing" utility="gas" onBack={() => setSection(null)} />;
  if (section === 'ptcl') return <PtclLineList onBack={() => setSection(null)} />;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Utilities Bill</h1>
        <p className="text-slate-500 text-sm mt-1">Electricity aur Gas meters — daily readings, expected bill aur actual bill comparison</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => setSection('billing')}
          className="group flex items-center justify-between p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-amber-400 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <PlugZap className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Billing Meter</h2>
              <p className="text-sm text-slate-500 mt-0.5">Meters jinpe electricity company bill bhejti hai</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
        </button>

        <button
          onClick={() => setSection('department')}
          className="group flex items-center justify-between p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-400 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Building2 className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Department Wise Meter</h2>
              <p className="text-sm text-slate-500 mt-0.5">ICU, OT waghera ke internal sub-meters</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
        </button>

        <button
          onClick={() => setSection('gas')}
          className="group flex items-center justify-between p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-orange-400 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
              <Flame className="w-7 h-7 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Sui Southern Gas</h2>
              <p className="text-sm text-slate-500 mt-0.5">Gas meters — readings, rate history, actual bill & difference</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
        </button>

        <button
          onClick={() => setSection('ptcl')}
          className="group flex items-center justify-between p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-teal-400 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
              <Phone className="w-7 h-7 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">PTCL</h2>
              <p className="text-sm text-slate-500 mt-0.5">5-6 phone lines — sirf monthly bill post karein</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-500 transition-colors" />
        </button>
      </div>
    </div>
  );
}
