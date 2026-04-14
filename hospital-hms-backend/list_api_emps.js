const { Dates, DatesTo } = { Dates: "2026/01/01", DatesTo: "2026/03/12" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const records = d.data || [];
  const uniqueFound = [...new Set(records.map(r => r.staff_id))];
  console.log("Found Staff IDs in API:", uniqueFound.join(', '));
}).catch(console.error);
