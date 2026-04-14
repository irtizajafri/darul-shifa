const { Dates, DatesTo } = { Dates: "2026/04/11", DatesTo: "2026/04/13" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const records = d.data || [];
  const uniqueFound = [...new Set(records.map(r => r.enrollid))];
  console.log("Found Enroll IDs on 4/11 - 4/13:", uniqueFound.length);
}).catch(console.error);
