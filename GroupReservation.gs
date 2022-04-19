/*
  Written by Adam Martin for the Craftsbury Outdoor Center May 2021.

  This class represents one or more ReservationRows with the same group reservation number.
  One or more single reservations are connected in a group reservation. Sub reservation refers to a single reservation tied to a group reservation.
  Group reservations include a group master row with the sum of all guest counts for every sub reservation.
  If every sub reservation does not have the same arrival and departure dates, the group reservation is considered a composite reservation.

  Examples from RMS:
    - Test Reservation 1, 7-9: The office enters a guest profile for each sub reservation.
    - Test Reservation 2, 10-11: The office adds a secondary guest to one of the sub reservations, but does not apply the primary guest to any reservation.
    - Test Reservation 3, 12-14: For camps, the office adds guests to a camp room and a lodging room if they're staying at the Center. This is neccessary in order to avoid overcounting, and to allow for the occasional camper that does not stay at the Center (but still eats meals at the Center).
    - Test Reservation 4, 15-16: For composite reservations, the office applies a guest to every sub reservation. If this is not done, it can not be determined if a missing sub reservation does not have a guest profile applied to it or if the sub reservation wasn't queried in the RMS export (e.g. that sub reservation has already passed).
    - Test Reservation 5, 17-18: Beginning February 2021, the office began adding the "Composite" keyword in composite reservations. Without this keyword, if one sub reservation spans the entire stay period, on specific dates, it's possible that the composite reservation will not register as composite.
*/

function GroupReservation(masterRow) {
  this.masterRow = masterRow;
  this.subReservationRows = [];
  this.addSubReservationRow = function(row) {
    this.subReservationRows.push(row);
  };

  this.isComposite = this.masterRow.reservationNote.toLowerCase().includes(Constants.compositeReservationKeyword); // This is a new business practice, so the calculateFromExportRows() method will also check for varying arrival and departure dates.

  this.calculateFromExportRows = function() {
    // All SingleReservations must call calculateFromExportRows before this function is called!
    rowWithSameGuestAsMaster = null;
    this.subReservationRows.forEach(function(row) {
      if (rowWithSameGuestAsMaster === null && row.fullName == masterRow.fullName) { // Check if this reservation row is the same guest as the group master.
        rowWithSameGuestAsMaster = row;
      }
      // Remove duplicate camp room rows and duplicate dietary concern fields.
      if (!row.hasBeenCounted) {
        let rowsThatCoverRowI = this.getLodgingRowsThatCover(row);
        if (rowsThatCoverRowI.length > 0) {
          rowsThatCoverRowI.sort(getComparisonByKeys(['stayDurationDays']));
          let rowsCoveredByLongestRowThatCoversRowI = this.getRowsCoveredBy(rowsThatCoverRowI[rowsThatCoverRowI.length - 1]);
          rowsCoveredByLongestRowThatCoversRowI.forEach(rowIterator2 => rowIterator2.markAsRedundantGuest());
        }
      }
      // Double check if this group reservation is composite.
      if (!this.isComposite && row.hasDifferentArrivalOrDepartureDay(masterRow)) {
          this.isComposite = true; // See test reservation (5, 17-18) for an example when this check isn't enough. 
      }
      this.masterRow.subtractGuestCounts(row);
    }, this);
    // Adjust the master row.
    if (this.isComposite) {
      this.masterRow.markedForRemoval = true; // For composite reservations, the office applies a guest to every sub reservation and adds the group master guest to a sub reservation if s/he is staying. All this means we can ignore the group master row without further considerations.
    } else {
      this.masterRow.balanceGuestCounts(); // Assuming that all reservation rows represent adults can throw off the adult child guest count balance.
      if (rowWithSameGuestAsMaster !== null) {
        rowWithSameGuestAsMaster.addGuestCounts(this.masterRow); // Since it contains room information, keep the sub reservation row, and delete the group master.
        this.masterRow.markedForRemoval = true;
      } else if (this.masterRow.getGuestCount() === 0) {
        if (this.tryDecrementingOldestExtraGuestCount()) {
          ++this.masterRow.guestCounts.adults;
        } else {
          this.masterRow.markedForRemoval = true; // The group master guest profile must have only made the reservation and is not staying.
        }
      }
    }
  };

  // ReservationRow A covers B IFF (A guest profile) = (B guest profile) AND (B stay period) lives within (B stay period).
  // The biggest use case for these functions is guests who are applied to both a camp room and lodging room, but the pattern also corrects less likely data mis representations from RMS.
  this.getLodgingRowsThatCover = function(row) {
    return this.subReservationRows.filter(function(rowIterator) {
      return !(rowIterator.markedForRemoval || rowIterator.hasBeenCounted || rowIterator.isCampRoom || row === rowIterator) && // valid row
        row.fullName === rowIterator.fullName && rowIterator.includesStayPeriod(row);
    });
  };
  this.getRowsCoveredBy = function(row) {
    return this.subReservationRows.filter(function(rowIterator) {
      return !(rowIterator.markedForRemoval || rowIterator.hasBeenCounted || row === rowIterator) && // valid row
        row.fullName === rowIterator.fullName && row.includesStayPeriod(rowIterator);
    });
  };

  this.tryDecrementingOldestExtraGuestCount = function() {
    let ageGroups = ['adults', 'children', 'infants'];
    for (let i = 0; i < ageGroups.length; ++i) {
      let row = this.getRowWithExtraGuestCount(ageGroups[i]);
      if (row !== null) {
        --row.guestCounts[ageGroups[i]];
        return true;
      }
    }
    return false;
  };
  this.getRowWithExtraGuestCount = function(ageGroup) {
    for (let i = 0; i < this.subReservationRows.length; ++i) {
      if (this.subReservationRows[i].guestCounts[ageGroup] > 1) {
        return this.subReservationRows[i];
      }
    }
    return null;
  };
}
