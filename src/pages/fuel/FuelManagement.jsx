import { useState } from 'react';
import { Fuel, Zap, ChevronRight, ArrowLeft } from 'lucide-react';
import VehicleList from './VehicleList';
import GeneratorList from './GeneratorList';

export default function FuelManagement() {
  const [section, setSection] = useState(null); // null | 'vehicles' | 'generators'

  if (section === 'vehicles') {
    return <VehicleList onBack={() => setSection(null)} />;
  }
  if (section === 'generators') {
    return <GeneratorList onBack={() => setSection(null)} />;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Fuel Management</h1>
        <p className="text-slate-500 text-sm mt-1">Track fuel, oil, and maintenance for vehicles and generator</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      </div>
    </div>
  );
}
