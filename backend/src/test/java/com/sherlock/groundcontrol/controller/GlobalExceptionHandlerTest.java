package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.exception.AccountLockedException;
import com.sherlock.groundcontrol.exception.AuthenticationFailedException;
import com.sherlock.groundcontrol.exception.GeofenceConflictException;
import com.sherlock.groundcontrol.exception.GeofenceNotFoundException;
import com.sherlock.groundcontrol.exception.GeofenceValidationException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    @Test
    void handlerMethodsExposeExpectedErrorMessages() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        assertEquals("auth", handler.handleAuthFailed(new AuthenticationFailedException("auth")).get("error"));
        assertEquals("locked", handler.handleAccountLocked(new AccountLockedException("locked")).get("error"));
        assertEquals("bad", handler.handleGeofenceValidation(new GeofenceValidationException("bad")).get("error"));
        assertEquals("conflict", handler.handleGeofenceConflict(new GeofenceConflictException("conflict")).get("error"));
        assertEquals("Geofence not found: 42", handler.handleGeofenceNotFound(new GeofenceNotFoundException(42L)).get("error"));
        assertEquals("Internal server error", handler.handleGeneric(new RuntimeException("boom")).get("error"));
    }
}
