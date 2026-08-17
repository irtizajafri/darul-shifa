import { Fuel } from 'lucide-react';

export default function FuelBalanceCard({ balance }) {
  const total = balance?.balance ?? 0;
  const totalVehicle = balance?.totalVehicle ?? 0;
  const totalGenerator = balance?.totalGenerator ?? 0;
  const totalTank = balance?.totalTank ?? 0;

  const fmtNum = (n) =>
    Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-4 mb-5">
      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <Fuel className="w-5 h-5 text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Fuel Balance</p>
        <p className="text-2xl font-bold text-emerald-700 leading-tight">{fmtNum(total)} L</p>
        <p className="text-xs text-emerald-600 mt-0.5">
          Tanks: {fmtNum(totalTank)} L &nbsp;|&nbsp; Generators: {fmtNum(totalGenerator)} L &nbsp;|&nbsp; Vans: {fmtNum(totalVehicle)} L
        </p>
      </div>
    </div>
  );
}
