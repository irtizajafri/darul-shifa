const { Dates, DatesTo } = { Dates: "2026/04/12", DatesTo: "2026/04/13" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const records = d.data || [];
  console.log(records.find(r => String(r.enrollid) === "251" || String(r.enrollId) === "251"));
}).catch(console.error);
