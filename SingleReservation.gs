/*
  Written by Adam Martin for the Craftsbury Outdoor Center May 2021.

  This class represents one or more ReservationRows pertaining to the same room and date range.
  For single reservations, the guest counts on each row are the total guest counts for the single reservation, so they are all the same.

  Examples from RMS:
    - Test Reservation 0, 2: The office enters guest profiles for both adults in the reservation, and there are two rows each with 2 adults.
    - Test Reservation 0, 1: The office only enters one guest profile, and there is a single row with 2 adults.
    - Test Reservation 0, 4: The office will enter three guest profiles if the primary guest is only making the reservation and is not staying.
    - Test Reservation 0, 3: The office doesn't enter secondary guest ages (just name and dietary concerns), so the script assumes that every reservation row represents an adult. This means that the script will increase the number of adults (and decrease the number of children) if there are more guest profiles than adults and there are extra children spots.
*/

function SingleReservation(primaryRow) {
  this.primaryRow = primaryRow;
  this.secondaryRows = [];
  this.addSecondaryRow = function(row) {
    this.secondaryRows.push(row);
  };
  
  this.calculateFromExportRows = function() {
    this.secondaryRows.forEach(function(row) {
      row.clearGuestCounts();
      row.guestCounts.adults = 1; // It's unknown if the secondary guest is an adult, child, or infant, so assume the secondary guest is an adult.
      this.primaryRow.decrementGuestCount();
    }, this);
  }
}
