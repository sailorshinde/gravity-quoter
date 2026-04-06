const XLSX = require('xlsx');
const path = require('path');

// Create a new workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([]);

// Add header information
const headerData = [
  ['Gravity Lab - An Accredited ISO 9001:2008 Certified Company'],
  ['Manufacturers, Suppliers & Exporters of Quality Lab Equipments, Glassware & Chemicals'],
  ['Shop No. 2, Bldg. No. 36/38, 3rd Lane, S.P. Road, Mumbai Central, Mumbai - 8'],
  ['Tel: 9821198397/ 9892256737/ 8108474704/ 23010130'],
  [],
  ['QUOTATION'],
  [],
  ['Customer:', 'ABC Lab Services', '', 'Date:', new Date().toLocaleDateString('en-IN')],
  [],
];

let rowIndex = 0;

// Add header rows
headerData.forEach((row) => {
  XLSX.utils.sheet_add_aoa(ws, [row], { origin: rowIndex });
  rowIndex++;
});

// Add table headers
const tableHeaders = ['Sr. No.', 'Item', 'Rate', 'Disc. %', 'Disc. Amt', 'Price Each', 'Qty.', 'Total', 'GST %', 'GST Amount'];
XLSX.utils.sheet_add_aoa(ws, [tableHeaders], { origin: rowIndex });
rowIndex++;

// Add sample data rows
const sampleItems = [
  [1, 'DNA Sequencing Kit', 5000, 10, 500, 4500, 2, 9000, 18, 1620],
  [2, 'Protein Analysis Buffer', 2500, 5, 125, 2375, 5, 11875, 18, 2137.5],
  [3, 'Centrifuge Tubes (Box of 100)', 1200, 0, 0, 1200, 10, 12000, 18, 2160],
  [4, 'PCR Master Mix', 8000, 15, 1200, 6800, 3, 20400, 18, 3672],
  [5, 'Electrophoresis Buffer (1L)', 1500, 5, 75, 1425, 8, 11400, 18, 2052],
];

sampleItems.forEach((item) => {
  XLSX.utils.sheet_add_aoa(ws, [item], { origin: rowIndex });
  rowIndex++;
});

// Add empty rows for additional items
for (let i = 6; i <= 25; i++) {
  XLSX.utils.sheet_add_aoa(ws, [[i, '', '', 0, 0, '', 0, 0, 0, 0]], { origin: rowIndex });
  rowIndex++;
}

// Add totals section
rowIndex += 1;
XLSX.utils.sheet_add_aoa(ws, [['', 'TOTAL', '', '', '', '', '', 64675, '', 11641.5]], { origin: rowIndex });
rowIndex++;
XLSX.utils.sheet_add_aoa(ws, [['', 'GST AMOUNT', '', '', '', '', '', '', '', 11641.5]], { origin: rowIndex });
rowIndex++;
XLSX.utils.sheet_add_aoa(ws, [['', 'GRAND TOTAL', '', '', '', '', '', '', '', 76316.5]], { origin: rowIndex });
rowIndex++;

// Add commercial terms
rowIndex += 2;
XLSX.utils.sheet_add_aoa(ws, [['COMMERCIAL TERMS AND CONDITIONS']], { origin: rowIndex });
rowIndex++;

const terms = [
  ['GST', 'Extra as Applicable'],
  ['Payment', '50% with a formal purchase order / 50% before dispatch'],
  ['Delivery', 'Ready Stock / 10 to 15 Days on receiving the purchase order and advance payment'],
  ['Installation', 'Installation will be free within Mumbai'],
  ['Packaging Charges', 'Extra at actual'],
  ['Freight', 'Freight Extra As Applicable'],
  ['Validity', '30 Days'],
  ['A/C Details', 'A/c Details: Canara Bank, Branch: Lamington Road, A/c Name: Gravity Lab, Current A/c No.: 0238201007769, IFSC Code: CNRB0015013, Swift Code: CNRBINBBBFD'],
];

terms.forEach((term) => {
  XLSX.utils.sheet_add_aoa(ws, [term], { origin: rowIndex });
  rowIndex++;
});

// Set column widths
ws['!cols'] = [
  { wch: 8 },  // Sr. No.
  { wch: 30 }, // Item
  { wch: 12 }, // Rate
  { wch: 10 }, // Disc. %
  { wch: 12 }, // Disc. Amt
  { wch: 12 }, // Price Each
  { wch: 8 },  // Qty.
  { wch: 12 }, // Total
  { wch: 10 }, // GST %
  { wch: 12 }, // GST Amount
];

XLSX.utils.book_append_sheet(wb, ws, 'Quotation');

// Save the file
const outputPath = path.join(__dirname, '../samples/sample-quotation.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`Sample quotation Excel file created at: ${outputPath}`);
