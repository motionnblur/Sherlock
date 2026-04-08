package com.sherlock.groundcontrol.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sherlock.groundcontrol.dto.GeofencePointDTO;
import com.sherlock.groundcontrol.dto.GeofenceRequestDTO;
import com.sherlock.groundcontrol.exception.GeofenceConflictException;
import com.sherlock.groundcontrol.exception.GeofenceNotFoundException;
import com.sherlock.groundcontrol.exception.GeofenceValidationException;
import com.sherlock.groundcontrol.security.JwtTokenProvider;
import com.sherlock.groundcontrol.security.OperatorUserDetailsService;
import com.sherlock.groundcontrol.service.AuthService;
import com.sherlock.groundcontrol.service.GeofenceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(GeofenceController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class GeofenceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private GeofenceService geofenceService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private OperatorUserDetailsService operatorUserDetailsService;

    @MockBean
    private AuthService authService;

    @Test
    void createGeofenceReturnsBadRequestForInvalidPayload() throws Exception {
        when(geofenceService.createGeofence(any())).thenThrow(new GeofenceValidationException("Geofence name must not be blank"));

        mockMvc.perform(post("/api/geofences")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"points\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getGeofenceReturnsNotFoundWhenMissing() throws Exception {
        when(geofenceService.getGeofence(99L)).thenThrow(new GeofenceNotFoundException(99L));

        mockMvc.perform(get("/api/geofences/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateGeofenceReturnsConflictForNameCollision() throws Exception {
        when(geofenceService.updateGeofence(eq(7L), any())).thenThrow(new GeofenceConflictException("Geofence name already exists"));

        mockMvc.perform(put("/api/geofences/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson("RANGE-A")))
                .andExpect(status().isConflict());
    }

    @Test
    void deleteGeofenceReturnsNoContentWhenSuccessful() throws Exception {
        doNothing().when(geofenceService).deleteGeofence(7L);

        mockMvc.perform(delete("/api/geofences/7"))
                .andExpect(status().isNoContent());
    }

    private String requestJson(String name) throws Exception {
        GeofenceRequestDTO request = GeofenceRequestDTO.builder()
                .name(name)
                .isActive(true)
                .points(List.of(
                        point(0, 37.0, 23.0),
                        point(1, 37.0, 24.0),
                        point(2, 38.0, 24.0)
                ))
                .build();
        return objectMapper.writeValueAsString(request);
    }

    private static GeofencePointDTO point(int sequence, double latitude, double longitude) {
        return GeofencePointDTO.builder()
                .sequence(sequence)
                .latitude(latitude)
                .longitude(longitude)
                .build();
    }
}
