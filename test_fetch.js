async function run() {
  const req = await fetch('http://localhost:5001/api/attendance/external', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Dates: "2026/04/01", DatesTo: "2026/04/02" })
  });
  const data = await req.json();
  const empData = (data.data || []).filter(r => r.enrollid == 7777 || String(r.enrollId) === "7777");
  console.log(empData);
}
run();
