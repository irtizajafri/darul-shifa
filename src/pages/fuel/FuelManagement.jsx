import { useState } from 'react';
import { Fuel, Zap, ChevronRight, ArrowLeft, Container, CalendarDays } from 'lucide-react';
import VehicleList from './VehicleList';
import GeneratorList from './GeneratorList';
import FuelTankList from './FuelTankList';
import FuelDailyReport from './FuelDailyReport';

export default function FuelManagement() {
  const [section, setSection] = useState(null); // null | 'vehicles' | 'generators' | 'tanks' | 'daily-report'

  if (section === 'vehicles') {
    return <VehicleList onBack={() => setSection(null)} />;
  }
  if (section === 'generators') {
    return <GeneratorList onBack={() => setSection(null)} />;
  }
  if (section === 'tanks') {
    return <FuelTankList onBack={() => setSection(null)} />;
  }
  if (section === 'daily-report') {
    return <FuelDailyReport onBack={() => setSection(null)} />;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Fuel Management</h1>
        <p className="text-slate-500 text-sm mt-1">Track fuel, oil, and maintenance for vehicles and generator</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => setSection('tanks')}
          className="group flex items-center justify-between p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-emerald-400 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <Container className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Fuel Tanks</h2>
              <p className="text-sm text-slate-500 mt-0.5">Stock fuel into a tank, then transfer it to a generator</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
        </button>

        <button
          onClick={() => setSection('vehicles')}
          className="group flex items-center justify-between p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-400 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Fuel className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Vans / Vehicles</h2>
              <p className="text-sm text-slate-500 mt-0.5">Ambulance, Van — Fuel & Oil tracking</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
        </button>

        <button
          onClick={() => setSection('generators')}
          className="group flex items-center justify-between p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-amber-400 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <Zap className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Generators</h2>
              <p className="text-sm text-slate-500 mt-0.5">Multiple generators — Fuel, Oil & Daily Sheets</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
        </button>

        <button
          onClick={() => setSection('daily-report')}
          className="group flex items-center justify-between p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-teal-400 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
              <CalendarDays className="w-7 h-7 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Daily Report</h2>
              <p className="text-sm text-slate-500 mt-0.5">Tanks, Vehicles & Generators — din-wise activity</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-500 transition-colors" />
        </button>
      </div>
    </div>
  );
}
