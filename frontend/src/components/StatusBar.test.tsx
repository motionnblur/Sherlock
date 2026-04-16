import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatusBar from './StatusBar';
import type { TelemetryPoint } from '../interfaces/telemetry';

// Mock constants
vi.mock('../constants/performance', () => ({
  PERFORMANCE_STAGE_LABELS: ['NORMAL', 'LOW', 'MINIMAL MAP'],
  PERFORMANCE_STAGE_LOW: 1,
  PERFORMANCE_STAGE_MINIMAL_MAP: 2,
}));

vi.mock('../constants/telemetry', () => ({
  PACKET_RATE_LABEL: '2 Hz',
}));

// Mock formatters
vi.mock('../utils/formatters', () => ({
  formatCoordinatePair: (lat: number, lon: number) => `${lat.toFixed(4)}°N ${lon.toFixed(4)}°E`,
}));

describe('StatusBar', () => {
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

  const defaultProps = {
    telemetry: mockTelemetry,
    connected: true,
    selectedDrone: 'SHERLOCK-01',
    freeMode: false,
    performanceStage: 0 as 0 | 1 | 2,
    onCyclePerformanceStage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('MISSION')).toBeInTheDocument();
    expect(screen.getByText('PLATFORM')).toBeInTheDocument();
    expect(screen.getByText('PKT RATE')).toBeInTheDocument();
    expect(screen.getByText('SYSTEM')).toBeInTheDocument();
  });

  it('shows mission status as active when connected with telemetry', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('● ACTIVE')).toBeInTheDocument();
  });

  it('shows mission status as standby when not connected or no telemetry', () => {
    render(<StatusBar {...defaultProps} connected={false} />);
    
    expect(screen.getByText('○ STANDBY')).toBeInTheDocument();
  });

  it('shows platform name when drone is selected', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('SHERLOCK-01')).toBeInTheDocument();
  });

  it('shows "NO ASSET" when no drone is selected', () => {
    render(<StatusBar {...defaultProps} selectedDrone={null} />);
    
    expect(screen.getByText('NO ASSET')).toBeInTheDocument();
  });

  it('shows position coordinates when connected with telemetry and not in free mode', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('POS')).toBeInTheDocument();
    expect(screen.getByText('37.7749°N -122.4194°E')).toBeInTheDocument();
  });

  it('does not show position coordinates in free mode', () => {
    render(<StatusBar {...defaultProps} freeMode={true} />);
    
    expect(screen.queryByText('POS')).not.toBeInTheDocument();
  });

  it('does not show position coordinates when not connected', () => {
    render(<StatusBar {...defaultProps} connected={false} />);
    
    expect(screen.queryByText('POS')).not.toBeInTheDocument();
  });

  it('shows low performance button when drone is selected', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('LOW PERF NORMAL')).toBeInTheDocument();
  });

  it('calls onCyclePerformanceStage when low performance button is clicked', () => {
    render(<StatusBar {...defaultProps} />);
    
    fireEvent.click(screen.getByText('LOW PERF NORMAL'));
    expect(defaultProps.onCyclePerformanceStage).toHaveBeenCalled();
  });

  it('shows low performance stage labels correctly', () => {
    const { rerender } = render(<StatusBar {...defaultProps} performanceStage={1 as 0 | 1 | 2} />);
    
    expect(screen.getByText('LOW PERF LOW')).toBeInTheDocument();
    
    rerender(<StatusBar {...defaultProps} performanceStage={2 as 0 | 1 | 2} />);
    expect(screen.getByText('LOW PERF MINIMAL MAP')).toBeInTheDocument();
  });

  it('shows critical battery warning when battery is below 10%', () => {
    const criticalTelemetry = { ...mockTelemetry, battery: 5 };
    render(<StatusBar {...defaultProps} telemetry={criticalTelemetry} />);
    
    expect(screen.getByText('⚠ CRITICAL BATTERY - RTB IMMEDIATELY')).toBeInTheDocument();
  });

  it('shows low battery warning when battery is below 20% but above 10%', () => {
    const lowTelemetry = { ...mockTelemetry, battery: 15 };
    render(<StatusBar {...defaultProps} telemetry={lowTelemetry} />);
    
    expect(screen.getByText('⚠ LOW BATTERY - 15.0%')).toBeInTheDocument();
  });

  it('shows "ALL SYSTEMS NOMINAL" when battery is normal and connected', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('ALL SYSTEMS NOMINAL')).toBeInTheDocument();
  });

  it('shows "SELECT AN ASSET TO BEGIN MISSION" when no drone is selected', () => {
    render(<StatusBar {...defaultProps} selectedDrone={null} />);
    
    expect(screen.getByText('SELECT AN ASSET TO BEGIN MISSION')).toBeInTheDocument();
  });

  it('shows datalink lost warning when drone is selected but not connected', () => {
    render(<StatusBar {...defaultProps} connected={false} />);
    
    expect(screen.getByText('⚠ DATALINK LOST - ATTEMPTING RECONNECT')).toBeInTheDocument();
  });

  it('shows packet rate when drone is selected', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('2 Hz')).toBeInTheDocument();
  });

  it('shows dash for packet rate when no drone is selected', () => {
    render(<StatusBar {...defaultProps} selectedDrone={null} />);
    
    expect(screen.getByText('─')).toBeInTheDocument();
  });

  it('shows system version', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('SHERLOCK v1.0')).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    const { container } = render(<StatusBar {...defaultProps} />);
    
    const footer = container.firstChild;
    expect(footer).toHaveClass('flex', 'items-center', 'justify-between', 'px-4', 'h-7', 'bg-elevated', 'border-t', 'border-line');
  });

  it('handles missing telemetry data gracefully', () => {
    render(<StatusBar {...defaultProps} telemetry={null} />);
    
    // Should still render without errors
    expect(screen.getByText('MISSION')).toBeInTheDocument();
    expect(screen.getByText('○ STANDBY')).toBeInTheDocument();
  });

  it('applies correct color classes to low performance button based on stage', () => {
    const { rerender, container } = render(<StatusBar {...defaultProps} performanceStage={0 as 0 | 1 | 2} />);
    
    let button = screen.getByText('LOW PERF NORMAL');
    expect(button).toHaveClass('text-muted', 'hover:text-neon');
    
    rerender(<StatusBar {...defaultProps} performanceStage={1 as 0 | 1 | 2} />);
    button = screen.getByText('LOW PERF LOW');
    expect(button).toHaveClass('text-caution', 'bg-panel');
    
    rerender(<StatusBar {...defaultProps} performanceStage={2 as 0 | 1 | 2} />);
    button = screen.getByText('LOW PERF MINIMAL MAP');
    expect(button).toHaveClass('text-danger', 'bg-panel');
  });

  it('does not show low performance button when no drone is selected', () => {
    render(<StatusBar {...defaultProps} selectedDrone={null} />);
    
    expect(screen.queryByText('LOW PERF')).not.toBeInTheDocument();
  });
});