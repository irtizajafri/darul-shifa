import { useState } from "react";

const API_URL = "http://localhost:5001/api/attendance/external";

export default function TempAttendanceApi() {
  const [dates, setDates] = useState("2026/03/01");
  const [datesTo, setDatesTo] = useState("2026/03/12");
  const [staffId, setStaffId] = useState("");
  const [month, setMonth] = useState("02");
  const [year, setYear] = useState("2026");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Dates: dates, DatesTo: datesTo }),
      });
      const json = await res.json();

      if (json.status === 200 && Array.isArray(json.data)) {
        setRows(json.data);
        setHeaders(json.data[0] ? Object.keys(json.data[0]) : []);
      } else {
        setRows([]);
        setHeaders([]);
        setError(json.message || "No data found");
      }
    } catch (err) {
      setError("API error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = rows.filter((row) => {
    const staffMatch = !staffId || String(row.staff_id) === String(staffId);
    return staffMatch;
  });

  const monthPrefix = `${year}-${month}`;
  const monthlyRows = filteredRows.filter((row) =>
    String(row.arrive_date || "").startsWith(monthPrefix)
  );

  const perDayRate = monthlySalary ? Number(monthlySalary) / 30 : 0;
  const monthlySalaryCalculated = Math.round(monthlyRows.length * perDayRate);

  return (
    <div style={{ padding: 20 }}>
      <h2>Temporary Attendance API</h2>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>Dates</label>
          <input value={dates} onChange={(e) => setDates(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>DatesTo</label>
          <input value={datesTo} onChange={(e) => setDatesTo(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>Staff ID</label>
          <input value={staffId} onChange={(e) => setStaffId(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>Month</label>
          <input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="02" />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>Year</label>
          <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026" />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>Monthly Salary (PKR)</label>
          <input value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} placeholder="60000" />
        </div>
        <button onClick={fetchData} disabled={loading}>
          {loading ? "Loading..." : "Fetch"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ marginBottom: 10 }}>
        <p>Total Records: {rows.length}</p>
        <p>Filtered Records: {filteredRows.length}</p>
        <p>Monthly Records ({month}/{year}): {monthlyRows.length}</p>
        <p>Estimated Monthly Salary: PKR {monthlySalary ? monthlySalaryCalculated.toLocaleString() : 0}</p>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#f8f9fb",
                    borderBottom: "1px solid #ddd",
                    textAlign: "left",
                    padding: "8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => (
              <tr key={row.id ?? i}>
                {headers.map((h) => (
                  <td
                    key={h}
                    style={{
                      padding: "6px 8px",
                      borderBottom: "1px solid #eee",
                      maxWidth: 180,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={String(row[h] ?? "")}
                  >
                    {String(row[h] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
