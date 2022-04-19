/*
  Written by Adam Martin for the Craftsbury Outdoor Center May 2021.

  This spreadsheet produces two reports for the kitchen staff: a detailed report for each meal, and a projection with expected guest numbers in the future.
  This script accomplishes three primary tasks:
  1. The reservation data exported from RMS has extra data and is also missing data at the same time. The script parses the export csv file into easily queryable reservation data.
  2. For a specific selected meal, the script combines the processed reservation data and manually entered diners (from the Recurring and Single additions tabs in the spreadsheet) into a grouped, sorted, and summarized report. The script builds a more detailed and nicer looking report than is possible with sheet functions such as query.
  3. Even with the use of protected ranges, mouse actions such as dragging can corrupt sheet functions. The script defines a function that resets data validation and formulas corresponding to user input ranges.
*/

// Values in Constants object will be treated like constants.
const Constants = {
  sheets: {
    report: 'Report',
    reservations: 'Reservations',
    recurringAdditions: 'RecurringAdditions',
    singleAdditions: 'SingleAdditions',
    setup: 'Setup',
    start: 'Start',
    test: 'Test'
  },
  ranges: {
    reservationsImport: 'ReservationsImportTable',
    earlyDepartureCriteria: 'EarlyDepartureCriteriaTable',
    reservationsReport: 'ReservationsReportTable',
    recurringAdditionsReport: 'RecurringAdditionsReportTable',
    singleAdditionsReport: 'SingleAdditionsReportTable',
    mealSeatings: 'MealSeatingsTable',
    meal: 'Meal',
    mealDate: 'MealDate',
    report: 'ReportTable',
    reportTitle: 'ReportTitle',
    reportTimeCreated: 'ReportTimeCreated',
    groupSeatings: 'GroupSeatingsTable',
    groups: 'ReservationTypesAndGroups',
    testExport: 'TestExportTable',
    testOutput: 'TestOutputTable',
    recurringAdditionsInput: 'RecurringAdditionsInputTable',
    recurringAdditionsFormulas: 'RecurringAdditionsFormulaTable',
    singleAdditionsInput: 'SingleAdditionsInputTable',
    singleAdditionsFormulas: 'SingleAdditionsFormulaTable'
  },
  folderId: '1eQ1nanGBCBKyqvePVp3EmGtwVDTV8QMy',
  fileName: 'Meals.csv',
  compositeReservationKeyword: 'composite', // case insensitive
  campRoomPhrases: ['scull', 'run', 'ski'],
  dietaryConcernLabels: ['Veg', 'V', 'LF', 'DF', 'GF'],
  noDietaryConcernLabel: 'Reg',
  dietaryConcernLabelJoiner: ', ',
  mealHours: {
    lunch: 12,
    dinner: 18
  },
  reportIndices: {
    firstName: 0,
    lastName: 1,
    nAdults: 2,
    nChildren: 3,
    dietaryConcerns: 4,
    notes: 5,
    showOnReport: 6,
    group: 7,
    seatingId: 8
  },
  nReportRowFields: 5,
  seatingTitlePostfixCharacter: ':',
  meals: ['Breakfast', 'Lunch', 'Dinner']
};

// Connect common functions to custom menu
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Custom Menu')
  .addItem('Build Report', 'importReservationsAndBuildReport')
  .addItem('Refresh Tables', 'resetInputTables')
  .addToUi();
}

function importReservationsAndBuildReport() {
  importRmsReservations();
  buildReport();
}

/*
  Parse reservations from RMS export file.
*/

function importRmsReservations() {
  table = parseReservationData(parseCsvString(getFileContentAsString(Constants.folderId, Constants.fileName)));
  // table.forEach(row => Logger.log(row.toString()))
  new SheetRange(Constants.sheets.reservations, Constants.ranges.reservationsImport).setValues(table);
}

/*
  This function is desinged to test the parseReservationData function with test data that requires common corrections.
  See the Test sheet in the spreadsheet
    - to see cases where the RMS export data requires corrections,
    - evaluate current code on the test data,
    - and update the test data when a new case is discovered.
  It is recommended to run this function after any script adjustments.
*/
function importTestReservations() {
  let testExportTable = new SheetRange(Constants.sheets.test, Constants.ranges.testExport).getValues();
  let table = parseReservationData(parseCsvString(getCsvString(testExportTable)));
  new SheetRange(Constants.sheets.test, Constants.ranges.testOutput).setValues(table);
}

/*
  This function transforms the RMS export data into an easily queryable table.
*/
function parseReservationData(table) {
  table = table.slice(1); // remove header row
  table = table.map(row => new ReservationRow(row)); // Translate each row into a Reservations object that will be easier to work with.
  table.sort(getComparisonByKeys(['groupReservationId', 'isGroupMaster', 'singleReservationId', 'isPrimaryGuest', 'lastName', 'firstName'], ['isGroupMaster', 'isPrimaryGuest'])); // Sort reservations so that group reservations are together with the group master first and individual reservations are together with the primary guest first
  // Find single and group reservations
  let singleReservations = [];
  let groupReservations = [];
  table.forEach(function(row) {
    // Construct single reservation objects.
    if (singleReservations.length > 0 && singleReservations[singleReservations.length - 1].primaryRow.singleReservationId == row.singleReservationId) { 
      singleReservations[singleReservations.length - 1].addSecondaryRow(row);
    } else if (!row.isGroupMaster) {
      singleReservations.push(new SingleReservation(row));
    }
    // Construct group reservation objects.
    if (row.isGroupMaster) {
      groupReservations.push(new GroupReservation(row));
    } else if (groupReservations.length > 0 && groupReservations[groupReservations.length - 1].masterRow.groupReservationId == row.groupReservationId) {
      groupReservations[groupReservations.length - 1].addSubReservationRow(row);
    }
  });
  // Make single and group reservation adjustments.
  singleReservations.forEach(singleReservation => singleReservation.calculateFromExportRows());
  groupReservations.forEach(group => group.calculateFromExportRows());
  
  table = table.filter(row => !row.markedForRemoval);
  // table.forEach(row => Logger.log(row.toString()));
  
  // sort reservations by arrival date
  table.sort(getComparisonByKeys(['arrivalTime', 'groupReservationId', 'isGroupMaster', 'singleReservationId', 'isPrimaryGuest', 'lastName', 'firstName'], ['isGroupMaster', 'isPrimaryGuest']))
  return table.map(row => row.toTableRow()); // Map each row object to the specific fields required in the spreadsheet.
}

/*
  Create Report
*/

function buildReport() {
  // Collect all reservation and manual additions data.
  let reservationRows = new SheetRange(Constants.sheets.reservations, Constants.ranges.reservationsReport).getValues();
  let recurringAdditionRows = new SheetRange(Constants.sheets.recurringAdditions, Constants.ranges.recurringAdditionsReport).getValues();
  let singleAdditionRows = new SheetRange(Constants.sheets.singleAdditions, Constants.ranges.singleAdditionsReport).getValues();
  let table = reservationRows.concat(recurringAdditionRows).concat(singleAdditionRows);

  table = table.filter(row => row[Constants.reportIndices.showOnReport]);
  table.sort(getComparisonByKeys([Constants.reportIndices.seatingId, Constants.reportIndices.lastName, Constants.reportIndices.firstName]));
  let meal = new SheetRange(Constants.sheets.start, Constants.ranges.meal).range.getValue();
  addSummaryRows(table, meal);
  let summaryRowIndices = formatTableAndGetSummaryRowIndices(table);
  writeReport(meal, table, summaryRowIndices);
}

function addSummaryRows(table, meal) {
  let seatingsTable = new SheetRange(Constants.sheets.setup, Constants.ranges.mealSeatings).getValuesAsObject();
  let mealIndex = Constants.meals.indexOf(meal);
  let seating = null;
  let grandSummaryRow = new ReportSummaryRow();
  let seatingSummaryRow = null;
  for (let i = table.length - 1; i >= -1; --i) {
    if (seating === null || i == -1 || table[i][Constants.reportIndices.seatingId] !== seating) { 
      if (seating !== null && seating != '') { // Add the summary row for the last seating.
        let seatingTitle = seatingsTable[seating][mealIndex];
        table.splice(i + 1, 0, seatingSummaryRow.getSummaryArray(seatingTitle));
      }
      if (i > -1) { // Create a summary row for the next seating.
        seating = table[i][Constants.reportIndices.seatingId];
        seatingSummaryRow = new ReportSummaryRow();
      }
    } 
    if (i > -1) {
      seatingSummaryRow.countRow(table[i]);
      grandSummaryRow.countRow(table[i]);
    }
  }
  table.splice(0, 0, grandSummaryRow.getSummaryArray('Total'));
}

/*
  This function underlines summary rows and sets a solid white background.
  (Conditional sheet formatting doesn't allow border changes.)
*/
function formatTableAndGetSummaryRowIndices(table) {
  let summaryIndices = [];
  for (let i = 0; i < table.length; ++i) {
    if (table[i].length < Constants.nReportRowFields) { // At this step, summary rows have fewer columns than other rows.
      summaryIndices.push(i);
      table[i][0] = '\n' + table[i][0];
      table[i].push('');
    } else {
      table[i][Constants.reportIndices.firstName] += ' ' + table[i][Constants.reportIndices.lastName];
      table[i].splice(Constants.reportIndices.lastName, 1);
      [Constants.reportIndices.nAdults, Constants.reportIndices.nChildren].forEach(function(countIndex) { // Change 0 adult and child counts to empty strings.
        if (table[i][countIndex] === 0) {
          table[i][countIndex] = '';
        }
      });
      table[i].splice(Constants.nReportRowFields);
    }
  }
  return summaryIndices;
}

function writeReport(meal, table, summaryRowIndices) {
  let reportSheetRange = new SheetRange(Constants.sheets.report, Constants.ranges.report);
  reportSheetRange.setValues(table);
  reportSheetRange.formatAsTable(table.length, summaryRowIndices);
  // Add report title and time created text.
  let mealDate = new SheetRange(Constants.sheets.start, Constants.ranges.mealDate).range.getValue();
  let mealTitle = getUsEasternDateString(mealDate, 'EEEE') + ' ' + meal + ' ' + getUsEasternDateString(mealDate, 'MMMM d, YYYY');
  new SheetRange(Constants.sheets.report, Constants.ranges.reportTitle).range.setValue(mealTitle);
  let timeCreated = 'Created ' + getUsEasternDateString(new Date(), 'M/dd h:mm a');
  new SheetRange(Constants.sheets.report, Constants.ranges.reportTimeCreated).range.setValue(timeCreated);
}

/*
  Reset user input fields.
*/
function resetInputTables() {
  let additionTableSheets = [Constants.sheets.recurringAdditions, Constants.sheets.singleAdditions];
  let additionInputTableRanges = [Constants.ranges.recurringAdditionsInput, Constants.ranges.singleAdditionsInput];
  let additionFormulaTableRanges = [Constants.ranges.recurringAdditionsFormulas, Constants.ranges.singleAdditionsFormulas];
  for (let i = 0; i < additionTableSheets.length; ++i) {
    inputTable = new SheetRange(additionTableSheets[i], additionInputTableRanges[i]);
    inputTable.templateRange = inputTable.getRowRangeFromOffset(-1);
    inputTable.copyFromTemplateRange([SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, SpreadsheetApp.CopyPasteType.PASTE_FORMAT]);
    formulaTable = new SheetRange(additionTableSheets[i], additionFormulaTableRanges[i]);
    formulaTable.templateRange = formulaTable.getRowRangeFromOffset(-1);
    formulaTable.copyFromTemplateRange([SpreadsheetApp.CopyPasteType.PASTE_FORMULA]);
  }
  let setupTableRangeNames = [Constants.ranges.mealSeatings, Constants.ranges.groupSeatings, Constants.ranges.earlyDepartureCriteria, Constants.ranges.groups];
  setupTableRangeNames.forEach(function(rangeName) {
    let table = new SheetRange(Constants.sheets.setup, rangeName);
    table.templateRange = table.getRowRangeFromOffset(-1);
    table.copyFromTemplateRange([SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, SpreadsheetApp.CopyPasteType.PASTE_FORMAT]);
  });
}
