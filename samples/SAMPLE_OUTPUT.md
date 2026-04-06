# Gravity Lab Quoter - Sample Output

This directory contains sample outputs from the Gravity Lab Quoter application.

## Quote Structure

A generated quote includes:

- **Client Name**: The name of the client requesting the quote
- **Items**: Line items with description, quantity, and unit price
- **Calculations**: Automatic subtotal, tax (9%), and grand total

## Sample Quote: ABC Lab Services

### Items

| Description | Qty | Unit Price | Total |
|---|---:|---:|---:|
| DNA Sequencing Analysis | 5 | $450.00 | $2,250.00 |
| Protein Mass Spectrometry | 3 | $350.00 | $1,050.00 |
| Data Analysis & Interpretation | 1 | $800.00 | $800.00 |
| Bioinformatics Consultation | 10 | $150.00 | $1,500.00 |

### Totals

- **Subtotal**: $6,500.00
- **Tax (9%)**: $585.00
- **Grand Total**: $7,085.00

## File Formats

The application supports exporting quotes in the following formats:

1. **JSON** (`sample-quote.json`): Machine-readable format with all quote data
2. **Excel** (`.xlsx`): Professional spreadsheet with formatting
3. **PDF** (`.pdf`): Print-ready format

## Usage

These sample files demonstrate:
- The structure of generated quotes
- Expected output formats
- Calculation of totals and tax
- Professional quote layout

