/*
  Written by Adam Martin for the Craftsbury Outdoor Center May 2021.
*/

function getFileContentAsString(folderId, fileName) {
  let fileIterator = DriveApp.getFolderById(folderId).getFilesByName(fileName);
  if (fileIterator.hasNext()) {
    let file = fileIterator.next();
    var content = file.getBlob().getDataAsString();
  } else {
    throw new Error('No file found named ' + fileName);
  }
  if (fileIterator.hasNext()) {
    throw new Error('Multiple files found named ' + fileName);
  }
  return content;
}

function parseCsvString(csvString) {
  // Escaping characters code drawn from: https://stackoverflow.com/questions/36658793/apps-script-utilities-parsecsv-assumes-new-row-on-line-breaks-within-double-quot)
  let newlineSequence = '::newline::', commaSequence = '::comma::'; // I don't understand why Utilities.parseCsv sometimes has trouble with the first cell with commas inside quotes.
  let sanitizedString = csvString.replaceAll(/"([^"]*)"/g, function(_, p1, _, _) {
    p1 = p1.replaceAll('\n', newlineSequence);
    return p1.replaceAll(',', commaSequence);
  });
  let table = Utilities.parseCsv(sanitizedString, ',');
  return table.map(row => row.map(function(cell) {
    cell = cell.replace(newlineSequence, '\n');
    return cell.replace(commaSequence, ',');
  }));
}

function getCsvString(table) {
  let csv = '';
  for (let i = 0; i < table.length; ++i) {
    for (let j = 0; j < table[i].length; ++j) {
      let cellString = table[i][j].toString();
      if (cellString.includes(',') || cellString.includes('\n')) {
        cellString = '"' + cellString + '"';
      }
      csv += cellString;
      if (j != table[i].length - 1) {
        csv += ',';
      }
    }
    if (i != table.length - 1) {
      csv += '\n';
    }
  }
  return csv;
}

function getComparisonByKeys(keys, reverseKeys = []) {
  return function(a, b) {
    // < 0: a before b; 0: a and b sort the same; > 0: a after b
    for (let i = 0; i < keys.length; ++i) {
      if (a[keys[i]] !== b[keys[i]]) {
        let orderMultiplier = 1;
        if (reverseKeys.includes(keys[i])) {
          orderMultiplier = -1;
        }
        return orderMultiplier * (a[keys[i]] < b[keys[i]] ? -1 : 1);
      }
    }
    return 0;
  };
}

function getUsEasternDateString(date, format) {
  // formatting symbols: https://docs.oracle.com/javase/7/docs/api/java/text/SimpleDateFormat.html
  return Utilities.formatDate(date, 'America/New_York', format);
}
