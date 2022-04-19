/*
  Written by Adam Martin for the Craftsbury Outdoor Center May 2021.

  This class keeps track of aggregate information in the Report such as groups, guest counts, and dietary concerns.
*/

function ReportSummaryRow() {
  this.groups = [];
  this.nAdults = 0;
  this.nChildren = 0;
  this.dietaryConcerns = {};

  this.countRow = function(row) {
    if (!this.groups.includes(row[Constants.reportIndices.group])) {
      this.groups.push(row[Constants.reportIndices.group]);
    }
    this.nAdults += row[Constants.reportIndices.nAdults];
    this.nChildren += row[Constants.reportIndices.nChildren];
    let nWithoutDietaryConcerns = row[Constants.reportIndices.nAdults] + row[Constants.reportIndices.nChildren];
    let rowDietaryConcerns = row[Constants.reportIndices.dietaryConcerns];
    if (rowDietaryConcerns.length > 0) {
      initializeOrIncrementKey(this.dietaryConcerns, rowDietaryConcerns);
      --nWithoutDietaryConcerns; // For any row, the dietary concerns only apply to a single guest.
    }
    if (nWithoutDietaryConcerns > 0) {
      initializeOrIncrementKey(this.dietaryConcerns, Constants.noDietaryConcernLabel, nWithoutDietaryConcerns);
    }
  };

  this.getSummaryArray = function(title) {
    let groupSummary = this.groups.sort().join(', ');
    if (title.length > 0) {
      if (title.slice(0,1) === Constants.seatingTitlePostfixCharacter) { // The title is meant as a postfix (such as seating time).
        title = groupSummary + title;
      }
    } else {
      title = groupSummary;
    }
    title += ' (' + (this.nAdults + this.nChildren) + ')';
    /*
      I could change this to tot\nadults\nchildren
    */
    return [title, this.nAdults, this.nChildren, this.getDietaryConcernSummary()];
  };

  this.getDietaryConcernSummary = function() {
    let dietaryConcernKeys = Object.keys(this.dietaryConcerns).sort(compareDietaryConcernSummaries);
    return dietaryConcernKeys.map(key => key + ': ' + this.dietaryConcerns[key]).join('\n');
  };
}

function initializeOrIncrementKey(object, key, value = 1) {
  if (Object.keys(object).includes(key)) {
    object[key] += value;
  } else {
    object[key] = value;
  }
}

function compareDietaryConcernSummaries(a, b) {
  // Sort dietary concern summaries with single concerns first and concerns in the same order as Constants.dietaryConcernsLabels.
  // Reminder: < 0: a before b; 0: a and b sort the same; > 0: a after b
  a = a.split(Constants.dietaryConcernLabelJoiner);
  b = b.split(Constants.dietaryConcernLabelJoiner);
  if (a.length < b.length) {
    return -1;
  } else if (a.length > b.length) {
    return 1;
  }
  let dietaryConcernLabels = [Constants.noDietaryConcernLabel].concat(Constants.dietaryConcernLabels);
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) {
      if (dietaryConcernLabels.indexOf(a[i]) < dietaryConcernLabels.indexOf(b[i])) {
        return -1;
      } else {
        return 1;
      }
    }
  }
  return 0;
}
