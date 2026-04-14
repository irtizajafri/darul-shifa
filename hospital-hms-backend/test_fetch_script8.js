const { Dates, DatesTo } = { Dates: "2026/04/10", DatesTo: "2026/04/15" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const records = d.data || [];
  const emp104 = records.filter(r => r.enrollid == "104");
  console.log("Punches for 104 on 04/10 - 04/15:", emp104.length);
}).catch(console.error);
