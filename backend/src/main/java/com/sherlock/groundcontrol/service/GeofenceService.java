package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.GeofenceDTO;
import com.sherlock.groundcontrol.dto.GeofencePointDTO;
import com.sherlock.groundcontrol.dto.GeofenceRequestDTO;
import com.sherlock.groundcontrol.entity.GeofenceEntity;
import com.sherlock.groundcontrol.entity.GeofencePointEntity;
import com.sherlock.groundcontrol.exception.GeofenceConflictException;
import com.sherlock.groundcontrol.exception.GeofenceNotFoundException;
import com.sherlock.groundcontrol.exception.GeofenceValidationException;
import com.sherlock.groundcontrol.repository.GeofenceRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeofenceService {

    private static final int MAX_NAME_LENGTH = 100;
    private static final int MIN_POINT_COUNT = 3;
    private static final int MAX_POINT_COUNT = 100;

    private final GeofenceRepository geofenceRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final AtomicReference<List<GeofenceDTO>> activeGeofenceCache = new AtomicReference<>(List.of());

    @PostConstruct
    void initializeCache() {
        refreshActiveGeofenceCache();
    }

    @Transactional(readOnly = true)
    public List<GeofenceDTO> listGeofences() {
        return geofenceRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public GeofenceDTO getGeofence(Long geofenceId) {
        return geofenceRepository.findById(geofenceId)
                .map(this::toDTO)
                .orElseThrow(() -> new GeofenceNotFoundException(geofenceId));
    }

    @Transactional
    public GeofenceDTO createGeofence(GeofenceRequestDTO request) {
        GeofenceEntity geofence = buildEntity(request, null);
        GeofenceEntity saved = geofenceRepository.save(geofence);
        refreshActiveGeofenceCache();
        publishTopologyChanged(saved.getId());
        log.info("Geofence '{}' created with id={} and {} points", saved.getName(), saved.getId(), saved.getPoints().size());
        return toDTO(saved);
    }

    @Transactional
    public GeofenceDTO updateGeofence(Long geofenceId, GeofenceRequestDTO request) {
        GeofenceEntity geofence = geofenceRepository.findById(geofenceId)
                .orElseThrow(() -> new GeofenceNotFoundException(geofenceId));

        validateRequest(request, geofenceId);
        boolean isActive = request.getIsActive() == null ? geofence.isActive() : request.getIsActive();
        geofence.setName(validateName(request.getName()));
        geofence.setActive(isActive);
        replacePoints(geofence, request.getPoints());

        GeofenceEntity saved = geofenceRepository.save(geofence);
        refreshActiveGeofenceCache();
        publishTopologyChanged(saved.getId());
        log.info("Geofence id={} updated (active={}, points={})", saved.getId(), saved.isActive(), saved.getPoints().size());
        return toDTO(saved);
    }

    @Transactional
    public GeofenceDTO setActive(Long geofenceId, boolean active) {
        GeofenceEntity geofence = geofenceRepository.findById(geofenceId)
                .orElseThrow(() -> new GeofenceNotFoundException(geofenceId));
        geofence.setActive(active);
        GeofenceEntity saved = geofenceRepository.save(geofence);
        refreshActiveGeofenceCache();
        publishTopologyChanged(saved.getId());
        return toDTO(saved);
    }

    @Transactional
    public void deleteGeofence(Long geofenceId) {
        GeofenceEntity geofence = geofenceRepository.findById(geofenceId)
                .orElseThrow(() -> new GeofenceNotFoundException(geofenceId));
        geofenceRepository.delete(geofence);
        refreshActiveGeofenceCache();
        publishTopologyChanged(geofenceId);
        log.info("Geofence id={} deleted", geofenceId);
    }

    @Transactional(readOnly = true)
    public List<GeofenceDTO> getActiveGeofencesSnapshot() {
        return activeGeofenceCache.get();
    }

    private GeofenceEntity buildEntity(GeofenceRequestDTO request, GeofenceEntity existing) {
        validateRequest(request, existing != null ? existing.getId() : null);

        GeofenceEntity geofence = existing != null ? existing : GeofenceEntity.builder().createdAt(Instant.now()).build();
        geofence.setName(validateName(request.getName()));
        geofence.setActive(request.getIsActive() == null || request.getIsActive());
        replacePoints(geofence, request.getPoints());
        return geofence;
    }

    private void replacePoints(GeofenceEntity geofence, List<GeofencePointDTO> requestedPoints) {
        List<GeofencePointDTO> points = normalizePoints(requestedPoints);
        try {
            GeofenceGeometry.validatePolygon(points);
        } catch (IllegalArgumentException exception) {
            throw new GeofenceValidationException(exception.getMessage());
        }

        geofence.getPoints().clear();
        for (GeofencePointDTO point : points) {
            GeofencePointEntity pointEntity = GeofencePointEntity.builder()
                    .geofence(geofence)
                    .sequence(point.getSequence())
                    .latitude(point.getLatitude())
                    .longitude(point.getLongitude())
                    .build();
            geofence.getPoints().add(pointEntity);
        }
    }

    private void validateRequest(GeofenceRequestDTO request, Long geofenceId) {
        if (request == null) {
            throw new GeofenceValidationException("Geofence request must not be null");
        }
        String normalizedName = validateName(request.getName());
        if (geofenceId == null) {
            if (geofenceRepository.existsByNameIgnoreCase(normalizedName)) {
                throw new GeofenceConflictException("Geofence name already exists");
            }
        } else if (geofenceRepository.existsByNameIgnoreCaseAndIdNot(normalizedName, geofenceId)) {
            throw new GeofenceConflictException("Geofence name already exists");
        }
    }

    private String validateName(String rawName) {
        if (rawName == null || rawName.isBlank()) {
            throw new GeofenceValidationException("Geofence name must not be blank");
        }

        String name = rawName.strip();
        if (name.length() > MAX_NAME_LENGTH) {
            throw new GeofenceValidationException("Geofence name exceeds maximum length of " + MAX_NAME_LENGTH);
        }
        return name;
    }

    private List<GeofencePointDTO> normalizePoints(List<GeofencePointDTO> requestedPoints) {
        if (requestedPoints == null) {
            throw new GeofenceValidationException("Geofence must include polygon points");
        }
        if (requestedPoints.size() < MIN_POINT_COUNT) {
            throw new GeofenceValidationException("Geofence must contain at least " + MIN_POINT_COUNT + " points");
        }
        if (requestedPoints.size() > MAX_POINT_COUNT) {
            throw new GeofenceValidationException("Geofence cannot exceed " + MAX_POINT_COUNT + " points");
        }

        List<GeofencePointDTO> normalizedPoints = new ArrayList<>(requestedPoints.size());
        for (GeofencePointDTO point : requestedPoints) {
            if (point == null) {
                throw new GeofenceValidationException("Geofence point must not be null");
            }
            if (point.getSequence() == null) {
                throw new GeofenceValidationException("Geofence point sequence must not be null");
            }
            if (point.getLatitude() == null || point.getLongitude() == null) {
                throw new GeofenceValidationException("Geofence point must include latitude and longitude");
            }
            if (point.getLatitude() < -90.0 || point.getLatitude() > 90.0) {
                throw new GeofenceValidationException("Geofence latitude out of range");
            }
            if (point.getLongitude() < -180.0 || point.getLongitude() > 180.0) {
                throw new GeofenceValidationException("Geofence longitude out of range");
            }
            normalizedPoints.add(GeofencePointDTO.builder()
                    .sequence(point.getSequence())
                    .latitude(point.getLatitude())
                    .longitude(point.getLongitude())
                    .build());
        }

        normalizedPoints.sort(Comparator.comparing(GeofencePointDTO::getSequence));
        for (int index = 0; index < normalizedPoints.size(); index += 1) {
            Integer sequence = normalizedPoints.get(index).getSequence();
            if (sequence == null || sequence != index) {
                throw new GeofenceValidationException("Geofence point sequences must start at 0 and remain contiguous");
            }
        }

        return Collections.unmodifiableList(normalizedPoints);
    }

    private GeofenceDTO toDTO(GeofenceEntity entity) {
        List<GeofencePointDTO> points = entity.getPoints().stream()
                .sorted(Comparator.comparing(GeofencePointEntity::getSequence))
                .map(this::toPointDTO)
                .toList();

        return GeofenceDTO.builder()
                .id(entity.getId())
                .name(entity.getName())
                .isActive(entity.isActive())
                .createdAt(entity.getCreatedAt())
                .points(List.copyOf(points))
                .build();
    }

    private GeofencePointDTO toPointDTO(GeofencePointEntity entity) {
        return GeofencePointDTO.builder()
                .id(entity.getId())
                .sequence(entity.getSequence())
                .latitude(entity.getLatitude())
                .longitude(entity.getLongitude())
                .build();
    }

    private void refreshActiveGeofenceCache() {
        List<GeofenceDTO> activeGeofences = geofenceRepository.findAllByActiveTrueOrderByCreatedAtDesc()
                .stream()
                .map(this::toDTO)
                .toList();
        activeGeofenceCache.set(List.copyOf(activeGeofences));
    }

    private void publishTopologyChanged(Long geofenceId) {
        eventPublisher.publishEvent(new GeofenceTopologyChangedEvent(geofenceId));
    }
}
