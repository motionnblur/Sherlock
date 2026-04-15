import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TelemetryPanel from './TelemetryPanel';
import type { TelemetryPoint } from '../interfaces/telemetry';

// Mock the formatters to avoid testing their implementation details
vi.mock('../utils/formatters', () => ({
  BLANK_VALUE: '--',
  clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
  formatFixed: (value: number | undefined, decimals: number) => value?.toFixed(decimals) ?? '--',
  formatHemisphereCoordinate: (value: number | undefined, pos: string, neg: string) => 
    value !== undefined ? `${value.toFixed(6)}° ${value >= 0 ? pos : neg}` : '--',
  formatUtcTime: (value: string | undefined) => value ? new Date(value).toISOString().slice(11, 19) : '--',
  getCardinalDirection: (heading: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  },
}));

// Mock the constants
vi.mock('../constants/telemetry', () => ({
  PACKET_RATE_LABEL: '2 Hz',
}));

// Mock child components
vi.mock('./SectionHeader', () => ({
  default: ({ title }: { title: string }) => <div data-testid="section-header">{title}</div>,
}));

vi.mock('./AttitudeIndicator', () => ({
  default: ({ roll, pitch, size }: { roll?: number; pitch?: number; size?: number }) => (
    <div data-testid="attitude-indicator">
      Roll: {roll ?? 0}, Pitch: {pitch ?? 0}, Size: {size ?? 128}
    </div>
  ),
}));

describe('TelemetryPanel', () => {
  const mockTelemetry: TelemetryPoint = {
    droneId: 'SHERLOCK-01',
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 1000,
    speed: 120.5,
    battery: 85.3,
    heading: 180,
    timestamp: '2026-04-15T12:00:00Z',
    roll: 5.2,
    pitch: -2.1,
    hdop: 1.2,
    satelliteCount: 12,
    fixType: 3,
    rssi: 95,
    isArmed: true,
    flightMode: 'LOITER',
  };

  it('renders without telemetry data', () => {
    render(<TelemetryPanel telemetry={null} />);
    
    expect(screen.getByText('◈ Telemetry Feed')).toBeInTheDocument();
    expect(screen.getByText('○ WAIT')).toBeInTheDocument();
    expect(screen.getByText('PLATFORM NONE')).toBeInTheDocument();
  });

  it('renders with telemetry data', () => {
    render(<TelemetryPanel telemetry={mockTelemetry} />);
    
    expect(screen.getByText('● LIVE')).toBeInTheDocument();
    expect(screen.getByText('PLATFORM SHERLOCK-01')).toBeInTheDocument();
  });

  it('renders all section headers', () => {
    render(<TelemetryPanel telemetry={mockTelemetry} />);
    
    const headers = screen.getAllByTestId('section-header');
    const headerTexts = headers.map(header => header.textContent);
    
    expect(headerTexts).toContain('POSITION');
    expect(headerTexts).toContain('KINEMATICS');
    expect(headerTexts).toContain('POWER');
    expect(headerTexts).toContain('ATTITUDE');
    expect(headerTexts).toContain('GPS QUALITY');
    expect(headerTexts).toContain('TIMING');
  });

  it('renders position data correctly', () => {
    render(<TelemetryPanel telemetry={mockTelemetry} />);
    
    // Check latitude and longitude formatting
    expect(screen.getByText('LATITUDE')).toBeInTheDocument();
    expect(screen.getByText('LONGITUDE')).toBeInTheDocument();
  });

  it('renders kinematics data correctly', () => {
    render(<TelemetryPanel telemetry={mockTelemetry} />);
    
    expect(screen.getByText('ALTITUDE')).toBeInTheDocument();
    expect(screen.getByText('SPEED')).toBeInTheDocument();
    expect(screen.getByText('HEADING')).toBeInTheDocument();
  });

  it('renders battery bar with correct values', () => {
    render(<TelemetryPanel telemetry={mockTelemetry} />);
    
    expect(screen.getByText('BATTERY')).toBeInTheDocument();
    expect(screen.getByText('85.3%')).toBeInTheDocument();
  });

  it('renders attitude indicator with correct props', () => {
    render(<TelemetryPanel telemetry={mockTelemetry} />);
    
    const attitudeIndicator = screen.getByTestId('attitude-indicator');
    expect(attitudeIndicator.textContent).toContain('Roll: 5.2');
    expect(attitudeIndicator.textContent).toContain('Pitch: -2.1');
    expect(attitudeIndicator.textContent).toContain('Size: 96');
  });

  it('renders GPS quality data correctly', () => {
    render(<TelemetryPanel telemetry={mockTelemetry} />);
    
    expect(screen.getByText('FIX')).toBeInTheDocument();
    expect(screen.getByText('HDOP')).toBeInTheDocument();
    expect(screen.getByText('SATS')).toBeInTheDocument();
  });

  it('renders timing data correctly', () => {
    render(<TelemetryPanel telemetry={mockTelemetry} />);
    
    expect(screen.getByText('LAST PKT')).toBeInTheDocument();
  });

  it('shows low battery warning when battery is below 20%', () => {
    const lowBatteryTelemetry = { ...mockTelemetry, battery: 15 };
    render(<TelemetryPanel telemetry={lowBatteryTelemetry} />);
    
    expect(screen.getByText('⚠ LOW')).toBeInTheDocument();
  });

  it('shows critical battery warning when battery is below 10%', () => {
    const criticalBatteryTelemetry = { ...mockTelemetry, battery: 5 };
    render(<TelemetryPanel telemetry={criticalBatteryTelemetry} />);
    
    expect(screen.getByText('⚠ CRITICAL')).toBeInTheDocument();
  });

  it('handles missing optional telemetry fields', () => {
    const minimalTelemetry: TelemetryPoint = {
      droneId: 'SHERLOCK-01',
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 1000,
      speed: 120.5,
      battery: 85.3,
      heading: 180,
      timestamp: '2026-04-15T12:00:00Z',
    };
    
    render(<TelemetryPanel telemetry={minimalTelemetry} />);
    
    // Should still render without errors
    expect(screen.getByText('◈ Telemetry Feed')).toBeInTheDocument();
    expect(screen.getByText('● LIVE')).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    const { container } = render(<TelemetryPanel telemetry={mockTelemetry} />);
    
    const panel = container.firstChild;
    expect(panel).toHaveClass('w-64', 'bg-panel', 'border-r', 'border-line');
  });
});