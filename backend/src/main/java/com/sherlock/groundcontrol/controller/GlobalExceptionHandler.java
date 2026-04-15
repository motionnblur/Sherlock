package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.exception.AccountLockedException;
import com.sherlock.groundcontrol.exception.AuthenticationFailedException;
import com.sherlock.groundcontrol.exception.GeofenceConflictException;
import com.sherlock.groundcontrol.exception.GeofenceNotFoundException;
import com.sherlock.groundcontrol.exception.GeofenceValidationException;
import com.sherlock.groundcontrol.exception.TelemetryHistoryValidationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(AuthenticationFailedException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public Map<String, String> handleAuthFailed(AuthenticationFailedException e) {
        return Map.of("error", e.getMessage());
    }

    @ExceptionHandler(AccountLockedException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public Map<String, String> handleAccountLocked(AccountLockedException e) {
        return Map.of("error", e.getMessage());
    }

    @ExceptionHandler(GeofenceValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleGeofenceValidation(GeofenceValidationException e) {
        return Map.of("error", e.getMessage());
    }

    @ExceptionHandler(GeofenceConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleGeofenceConflict(GeofenceConflictException e) {
        return Map.of("error", e.getMessage());
    }

    @ExceptionHandler(GeofenceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleGeofenceNotFound(GeofenceNotFoundException e) {
        return Map.of("error", e.getMessage());
    }

    @ExceptionHandler(TelemetryHistoryValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleTelemetryHistoryValidation(TelemetryHistoryValidationException e) {
        return Map.of("error", e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Map<String, String> handleGeneric(Exception e) {
        log.error("[API] Unhandled exception", e);
        return Map.of("error", "Internal server error");
    }
}
