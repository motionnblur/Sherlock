package com.sherlock.groundcontrol.exception;

public class GeofenceNotFoundException extends RuntimeException {

    public GeofenceNotFoundException(Long geofenceId) {
        super("Geofence not found: " + geofenceId);
    }
}
