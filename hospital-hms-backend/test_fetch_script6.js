const { Dates, DatesTo } = { Dates: "2026/04/11", DatesTo: "2026/04/13" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const records = d.data || [];
  const uniqueFound = [...new Set(records.map(r => r.enrollid))];
  console.log(uniqueFound.join(', '));
  console.log("Includes 251?", uniqueFound.includes('251'));
  console.log("Includes 104?", uniqueFound.includes('104'));
}).catch(console.error);
