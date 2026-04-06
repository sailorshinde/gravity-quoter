/**
 * Script to generate pricing database from chemical supplier price list
 * Processes the price list data and creates a JSON database
 */

const fs = require('fs');
const path = require('path');

// Price list data - parsed from the PDF
const pricingData = [
  { sr: 1, name: "Accacia Powder", hsn: "13012000", gst: "5%", packing: "500 gm", price: 300 },
  { sr: 2, name: "Acetamide", hsn: "29241900", gst: "18%", packing: "500 gm", price: 1200 },
  { sr: 3, name: "Acetanilide White", hsn: "29242910", gst: "18%", packing: "500 gm", price: 1050 },
  { sr: 4, name: "Aceto Acetanilide", hsn: "29242920", gst: "18%", packing: "500 gm", price: 1200 },
  { sr: 5, name: "Acetyl Salicylic Acid", hsn: "29182200", gst: "18%", packing: "500 gm", price: 1000 },
  { sr: 6, name: "Acrylamide", hsn: "29241900", gst: "18%", packing: "500 gm", price: 600 },
  { sr: 7, name: "Activated Allumina", hsn: "28182010", gst: "18%", packing: "500 gm", price: 300 },
  { sr: 8, name: "Activated Charcol Granular", hsn: "38021000", gst: "18%", packing: "500 gm", price: 500 },
  { sr: 9, name: "Activated Charcol Powder", hsn: "38021000", gst: "18%", packing: "500 gm", price: 400 },
  { sr: 10, name: "Adipic Acid", hsn: "29171200", gst: "18%", packing: "500 gm", price: 500 },
  // Note: Full database should include all 694 items from the price list
  // This is a template showing the structure
];

// Create the pricing database structure
const pricingDatabase = {
  version: "1.0",
  lastUpdated: new Date().toISOString(),
  companies: [
    {
      id: "gravity-lab-chem",
      name: "Gravity Lab Chemicals",
      description: "Accredited ISO 9001:2008 Certified Chemical Supplier",
      address: "Shop No. 2, Bldg. No. 36/38, 3rd Lane, S.P. Road, Mumbai Central, Mumbai - 8",
      contact: {
        phone: ["9821198397", "9892256737", "8108474704", "23010130"]
      },
      bankDetails: {
        bankName: "Canara Bank",
        branch: "Lamington Road",
        accountName: "Gravity Lab",
        accountNumber: "0238201007769",
        ifscCode: "CNRB0015013",
        swiftCode: "CNRBINBBBFD"
      },
      terms: {
        gstApplied: "Extra as Applicable",
        payment: "50% with PO / 50% before dispatch",
        delivery: "Ready Stock / 10-15 Days",
        installation: "Free within Mumbai",
        packagingCharges: "Extra at actual",
        freight: "Extra As Applicable",
        validity: "30 Days"
      },
      items: pricingData.map(item => ({
        id: item.sr,
        name: item.name,
        hsnCode: item.hsn,
        gst: item.gst,
        packing: item.packing,
        price: item.price
      }))
    }
  ],
  categories: {
    "Powders": ["Accacia Powder", "Acetamide", "Benzoic Acid"],
    "Acids": ["Acetyl Salicylic Acid", "Benzoic Acid", "Citric Acid"],
    "Salts": ["Ammonium Acetate", "Calcium Acetate", "Sodium Acetate"],
    "Metals": ["Aluminium Metal", "Copper Metal", "Zinc Metal"],
    "Organic Compounds": ["Acetamide", "Benzamide", "Phenol"]
  }
};

// Write to file
const outputPath = path.join(__dirname, '../src/data/pricingDatabase.json');
fs.writeFileSync(outputPath, JSON.stringify(pricingDatabase, null, 2));

console.log(`✓ Pricing database generated at: ${outputPath}`);
console.log(`✓ Total items: ${pricingDatabase.companies[0].items.length}`);
console.log(`✓ Companies: ${pricingDatabase.companies.length}`);
