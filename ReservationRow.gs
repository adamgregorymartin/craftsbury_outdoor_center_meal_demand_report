/*
  Written by Adam Martin for the Craftsbury Outdoor Center May 2021.

  This class represents a single row from the RMS export file.
  Every reservation row is attached to a guest profile, and reservations and guest spaces in RMS without a guest profile are not available in the export.
  Most of the time the missing information can be deduced, and front office guidelines ensure enough information is available to avoid ambiguous export data.
  This class and the SingleReservation and GroupReservtion classes fill in and adjust the missing data.

  Example from RMS:
  - Test Reservation 3, 13: Certain reservations leave before lunch on the departure day.
*/

class ReservationRow {
  constructor(rmsExportRow) {
    this.groupReservationId = parseInt(rmsExportRow[0]);
    this.isGroupMaster = rmsExportRow[1] == '1';
    this.singleReservationId = parseInt(rmsExportRow[3]); // Change export order and switch to 2?
    
    this.arrivalTime = new Date(rmsExportRow[4]); // All reservations arrive at the same time, so a second arrival attribute isn't neccessary for comparison.
    this.departureDay = new Date(rmsExportRow[5]);
    this.stayDurationDays = (this.departureDay.getTime() - this.arrivalTime.getTime()) / (24 * 60 * 60 * 1000);
  
    this.rateType = rmsExportRow[6];
    this.reservationType = rmsExportRow[7];

    this.arrivalTime.setHours(Constants.mealHours.dinner - 1); // All reservations include dinner on the arrival day.
    this.departureTime = new Date(this.departureDay.getTime());
    if (willDepartEarly(this.reservationType, this.stayDurationDays)) { // Reservations leave either before or after lunch on the departure day.
      this.departureTime.setHours(Constants.mealHours.lunch - 1);
    } else {
      this.departureTime.setHours(Constants.mealHours.lunch + 1);
    }

    this.room = rmsExportRow[8];
    this.isCampRoom = isCampRoom(this.room);
    this.firstName = rmsExportRow[9];
    this.lastName = rmsExportRow[10];
    this.fullName = this.firstName + ' ' + this.lastName; // This will be used as a guest ID, because a list of the names is the only data available for secondary guests.
    this.isPrimaryGuest = !nameIsInSecondaryGuestList(this.fullName, rmsExportRow[2]); // Change export order and switch to 3?

    this.markedForRemoval = false;
    this.hasBeenCounted = false; // This flag is used by the GroupReservation class to keep track of the ReservationRows that have been searched.
    this.guestCounts = {
      adults: parseInt(rmsExportRow[11]),
      children: parseInt(rmsExportRow[12]),
      infants: parseInt(rmsExportRow[13]),
    };

    this.dietaryConcerns = rmsExportRow.slice(14, 19).map(x => x.length > 0);
    this.dietaryAndMealNotes = rmsExportRow[19] + (rmsExportRow[19].length > 0 && rmsExportRow[20].length > 0 ? '\n' : '') + rmsExportRow[20];
    this.reservationNote = rmsExportRow[21];
  }

  getGuestCount() {
    return this.guestCounts.adults + this.guestCounts.children + this.guestCounts.infants;
  }
  balanceGuestCounts() { // Assuming every guest profile is an adult can throw off of the adult and children totals on master and primary guest rows.
    let guestCountsWithPossibleSurplus = ['children', 'infants'];
    for (let i = 0; this.guestCounts.adults < 1 && i < guestCountsWithPossibleSurplus.length; ++i) {
      if (this.guestCounts[guestCountsWithPossibleSurplus[i]] > 0) {
        let difference = Math.min(1 - this.guestCounts.adults, this.guestCounts[guestCountsWithPossibleSurplus[i]]);
        this.guestCounts.adults += difference;
        this.guestCounts[guestCountsWithPossibleSurplus[i]] -= difference;
      }
    }
  };
  subtractGuestCounts(row) {
    this.guestCounts.adults -= row.guestCounts.adults;
    this.guestCounts.children -= row.guestCounts.children;
    this.guestCounts.infants -= row.guestCounts.infants;
  };
  addGuestCounts(row) {
    this.guestCounts.adults += row.guestCounts.adults;
    this.guestCounts.children += row.guestCounts.children;
    this.guestCounts.infants += row.guestCounts.infants;
  };
  markAsRedundantGuest() { // This guest is already accounted for in another reservation.
    if (this.isCampRoom) {
      this.markedForRemoval = true;
    } else {
      this.clearDietaryConcerns();
      this.hasBeenCounted = true;
    }
  }
  clearGuestCounts() {
    this.guestCounts.adults = 0;
    this.guestCounts.children = 0;
    this.guestCounts.infants = 0;
  };
  decrementGuestCount() {
    if (this.getGuestCount() <= 1) {
      this.markedForRemoval = true; // It's not possible to remove more secondary guests from this reservation. This person must have made the reservation for other people.
    } else {
      if (this.guestCounts.adults > 1) {
        --this.guestCounts.adults;
      } else if (this.guestCounts.children > 0) {
        --this.guestCounts.children;
      } else {
        --this.guestCounts.infants;
      }
    }
  };

  hasDifferentArrivalOrDepartureDay(row) {
    return this.arrivalTime.getTime() != row.arrivalTime.getTime() || // different arrival time
      this.departureDay.getTime() != row.departureDay.getTime(); // or different departure time
  };

  includesStayPeriod(row) {
    return !(this.arrivalTime > row.arrivalTime) && // row does not arrive earlier
      !(this.departureDay < row.departureDay); // and row does not depart later 
  };

  clearDietaryConcerns() {
    this.dietaryConcerns = this.dietaryConcerns.map(x => false);
    this.dietaryConcernsDescription = '';
  };

  toTableRow() {
    let row = [this.groupReservationId, this.singleReservationId, this.arrivalTime, this.departureTime, this.rateType, this.reservationType, this.room, this.firstName, this.lastName, this.guestCounts.adults, this.guestCounts.children, this.guestCounts.infants];
    row = row.concat(this.dietaryConcerns);
    row.splice(row.length, 0, this.dietaryAndMealNotes, this.reservationNote);
    return row;
  }

  toString() {
    let ids = `(${this.groupReservationId}${this.isGroupMaster ? '*' : ''}, ${this.singleReservationId}${this.isPrimaryGuest ? '*' : ''}`;
    let timeFormat = 'M/d/yy ha';
    let dates = `${getUsEasternDateString(this.arrivalTime, timeFormat)} → ${getUsEasternDateString(this.departureTime, timeFormat)}`;
    let rateRoomAndType = `Rate: ${this.rateType}, Room: ${this.room}${this.isCampRoom ? ' (Camp)' : ''}, Type: ${this.reservationType}`;
    let guests = `Guests: ${this.fullName} ${this.guestCounts.adults}A ${this.guestCounts.children}C ${this.guestCounts.infants}I`;
    let dietaryConcernsSummary = 'dietary concerns: ' + Constants.dietaryConcernLabels.filter((row, index) => this.dietaryConcerns[index], this).join(' ');
    return `${ids}: ${dates}, ${rateRoomAndType}, ${guests}, ${dietaryConcernsSummary}${this.markedForRemoval ? ', Remove' : ''})`;
  };
}

function nameIsInSecondaryGuestList(name, secondaryGuests) {
  // First1 Last1, First2 Last2... OR First1 Last1 First2 Last2...
  if (secondaryGuests.includes(',')) { // If there is ever a guest with a space in their first or last name, the office should keep formatting on the RMS export.
    return secondaryGuests.split(', ').includes(name);
  } else {
    let matches = Array.from(secondaryGuests.matchAll(/[^\s]+\s[^\s]+/g)); // [...iterator] also works, but I'm not familiar with it.
    return matches.some(match => match[0] === name);
  }
}

// Change to static methods
function willDepartEarly(reservationType, stayDurationDays) {
  let earlyDepartureCriteria = new SheetRange(Constants.sheets.setup, Constants.ranges.earlyDepartureCriteria).getValuesAsObject();
  return Object.keys(earlyDepartureCriteria).includes(reservationType) && // reservation type match
    (earlyDepartureCriteria[reservationType] === null || // all stay durations depart early
    earlyDepartureCriteria[reservationType] === stayDurationDays); // reservations with this stay duration depart early
}

function isCampRoom(roomName) {
  return Constants.campRoomPhrases.some(function(phrase) {
    return roomName.toString().toLowerCase().includes(phrase);
  });
}
