/*
  Written by Adam Martin for the Craftsbury Outdoor Center May 2021.

  This wrapper class for the Apps Script class sheet which simplifies common use cases.
*/

function SheetRange(sheetName, rangeName) {
  this.sheetName = sheetName;
  this.rangeName = rangeName; // e.g. 'Table1' or 'A1:B5'

  this.range = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName).getRange(this.rangeName);
  this.getValues = function() { // Returns a 2d array of nonempty rows.
    return this.range.getValues().filter(row => !isEmptyRow(row));
  };
  this.getValuesAsObject = function() {
    // key = first column; value = second column (empty = null) OR if columns > 2, value = [second column, third column, etc]
    let object = {};
    this.getValues().forEach(function(row) {
      let value = null;
      if (row.length == 2) {
        value = row[1].length === 0 ? null : row[1];
      } else {
        value = row.slice(1);
      }
      object[row[0]] = value;
    });
    return object;
  }
  this.setValues = function(table) { // Clears this.range and copies the 2d array table to a subset of this.range. 
    this.range.clear();
    if (table.length > 0) {
      let exactRange = this.getRangeSubset(table.length, table[0].length);
      exactRange.setValues(table);
    }
  }
  this.getRangeSubset = function(nRows, nCols) { // Returns a range with nRows and nCols from the top left corner of this.range. 
    return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName).getRange(this.range.getRow(), this.range.getColumn(), nRows, nCols); // row, column, nRows, nColumns
  }

  this.templateRange = null;
  this.getRowRangeFromOffset = function(rowOffset) { // Returns a range for a row with the same width as this.range rowOffset rows below the first row in this.range.
    return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName).getRange(this.range.getRow() + rowOffset, this.range.getColumn(), 1, this.range.getWidth());
  };
  this.copyFromTemplateRange = function(copyTypes, nRows = null) {
    // this.templateRange must be defined before calling this function!
    // CopyPastTypes can be found here: https://developers.google.com/apps-script/reference/spreadsheet/copy-paste-type
    let targetRange = null;
    if (nRows === null) {
      targetRange = this.range;
    } else {
      targetRange = this.getRangeSubset(nRows, this.templateRange.getWidth());
    }
    copyTypes.forEach(function(copyType) {
      this.templateRange.copyTo(targetRange, copyType, false);
    }, this);
  };
  
  // White out empty rows, reset data row format, and highlight summary rows.
  this.formatAsTable = function(nRows, summaryRowIndices) {
    // Reset format for the entire range.
    let white = '#FFF', black = '#000';
    this.range.setBorder(null, true, true, true, true, true, white, SpreadsheetApp.BorderStyle.SOLID); // top, left, bottom, right, vertical, horizontal, color, style
    this.range.setFontWeight('normal');
    this.templateRange = this.getRowRangeFromOffset(-1);
    this.copyFromTemplateRange([SpreadsheetApp.CopyPasteType.PASTE_FORMAT], nRows);
    // Add bold text, white background, and a thick black lower border to summary rows.
    summaryRowIndices.forEach(function(rowIndex) {
      this.getRowRangeFromOffset(rowIndex)
        .setBorder(null, null, true, null, null, null, black, SpreadsheetApp.BorderStyle.SOLID_MEDIUM)
        .setFontWeight('bold');
    }, this);
  };
}

function isEmptyRow(row) {
  return row.every(cell => cell.length === 0);
}
