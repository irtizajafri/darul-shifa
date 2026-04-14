import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function TestAttendance() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [startDate, setStartDate] = useState('2026-02-01');
  const [endDate, setEndDate] = useState('2026-02-28');
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    fetch('http://localhost:5001/api/employees')
      .then(res => res.json())
      .then(json => {
        if (json.data) setEmployees(json.data);
      })
      .catch(err => console.error(err));
  }, []);

  const handleTestPairing = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/api/attendance/test-raw-punches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, employeeId })
      });
      const json = await res.json();
      console.log('--- API RESPONSE ---', json);
      
      if (!res.ok) throw new Error(json.message || 'Error occurred');
      
      console.log('Setting Data:', json.data);
      setData(json.data || []);
  toast.success("Raw machine punches fetched successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error fetching test data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
  <h1 className="text-2xl font-bold text-gray-800">Test Attendance (Raw Machine View)</h1>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            className="border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emp Machine ID</label>
          <input 
            type="text" 
            value={employeeId} 
            onChange={(e) => setEmployeeId(e.target.value)} 
            className="border rounded-lg px-3 py-2 min-w-[200px] outline-none"
            placeholder="Type ID (e.g. 94181) or DB ID"
          />
          <p className="text-xs text-gray-500 mt-1">Hint: Try 94181 for Night Shift (Mocked)</p>
        </div>
        <button 
          onClick={handleTestPairing}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {loading ? 'Processing...' : 'Fetch Raw Punches'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emp ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Punch Date</th>
              {Array.from({ length: 12 }, (_, i) => (
                <th key={`head-p${i + 1}`} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{`Punch${i + 1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan="15" className="px-6 py-4 text-center text-gray-500">No data to display</td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-4 whitespace-nowrap">{row.empCode}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{row.name || '-'}</td>
                  <td className="px-4 py-4 whitespace-nowrap font-medium">{row.punchDate}</td>
                  {Array.from({ length: 12 }, (_, i) => (
                    <td key={`cell-${idx}-${i + 1}`} className="px-4 py-4 whitespace-nowrap">{row[`Punch${i + 1}`] || '-'}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
