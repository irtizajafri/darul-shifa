const { Dates, DatesTo } = { Dates: "2026/02/01", DatesTo: "2026/02/28" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const records = d.data || [];
  const uniqueFound = [...new Set(records.map(r => r.enrollid))];
  console.log("Found Enroll IDs in API:", uniqueFound.slice(0, 50).join(', '));
}).catch(console.error);
