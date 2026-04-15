import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SystemPanel from './SystemPanel';
import type { TelemetryPoint } from '../interfaces/telemetry';
import type { CommandLogEntry } from '../interfaces/command';

// Mock child components
vi.mock('./SectionHeader', () => ({
  default: ({ title }: { title: string }) => <div data-testid="section-header">{title}</div>,
}));

vi.mock('./PreflightChecklist', () => ({
  default: () => <div data-testid="preflight-checklist">Preflight Checklist</div>,
}));

vi.mock('./FlightLogSection', () => ({
  default: () => <div data-testid="flight-log-section">Flight Log Section</div>,
}));

// Mock formatters
vi.mock('../utils/formatters', () => ({
  BLANK_VALUE: '--',
  formatUtcTime: (value: string | undefined) => value ? new Date(value).toISOString().slice(11, 19) : '--',
}));

describe('SystemPanel', () => {
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

  const mockHistory: TelemetryPoint[] = [
    { ...mockTelemetry, altitude: 950, timestamp: '2026-04-15T11:59:55Z' },
    { ...mockTelemetry, altitude: 980, timestamp: '2026-04-15T11:59:58Z' },
    mockTelemetry,
  ];

  const mockCommandLog: CommandLogEntry[] = [
    {
      commandId: 'cmd-1',
      droneId: 'SHERLOCK-01',
      commandType: 'ARM',
      status: 'ACKED',
      requestedAt: '2026-04-15T12:00:00Z',
      updatedAt: '2026-04-15T12:00:01Z',
      detail: 'COMMAND_ACK ACCEPTED',
    },
    {
      commandId: 'cmd-2',
      droneId: 'SHERLOCK-01',
      commandType: 'TAKEOFF',
      status: 'SENT',
      requestedAt: '2026-04-15T12:00:02Z',
      updatedAt: '2026-04-15T12:00:03Z',
    },
  ];

  const defaultProps = {
    telemetry: mockTelemetry,
    history: mockHistory,
    connected: true,
    selectedDroneId: 'SHERLOCK-01',
    hasActiveGeofence: false,
    activeGeofenceCount: 0,
    onSendCommand: vi.fn(),
    isCommandSending: false,
    commandError: null,
    commandLog: mockCommandLog,
    isDriverModeEnabled: false,
    isDriverModeAvailable: true,
    onToggleDriverMode: vi.fn(),
    driverWaypointCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<SystemPanel {...defaultProps} />);
    
    expect(screen.getByText('◈ System Status')).toBeInTheDocument();
    expect(screen.getByTestId('preflight-checklist')).toBeInTheDocument();
  });

  it('renders all section headers', () => {
    render(<SystemPanel {...defaultProps} />);
    
    const headers = screen.getAllByTestId('section-header');
    const headerTexts = headers.map(header => header.textContent);
    
    expect(headerTexts).toContain('MISSION CLOCK');
    expect(headerTexts).toContain('HEADING');
    expect(headerTexts).toContain('ALT TREND');
    expect(headerTexts).toContain('DATALINK');
    expect(headerTexts).toContain('COMMANDS');
    expect(headerTexts).toContain('COMMAND LOG');
  });

  it('renders mission clock when connected with telemetry', () => {
    render(<SystemPanel {...defaultProps} />);

    // MissionClock starts at 00:00:00 and is always present when connected + telemetry
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  it('renders compass rose with heading', () => {
    render(<SystemPanel {...defaultProps} />);
    
    // Check heading display
    expect(screen.getByText('180.0°')).toBeInTheDocument();
  });

  it('renders altitude trend indicator', () => {
    render(<SystemPanel {...defaultProps} />);
    
    // Should show altitude value
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();
  });

  it('renders datalink status correctly', () => {
    render(<SystemPanel {...defaultProps} />);
    
    expect(screen.getByText('● NOMINAL')).toBeInTheDocument();
    expect(screen.getByText('STOMP/WS')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument(); // RSSI
    expect(screen.getByText('⚠ ARMED')).toBeInTheDocument();
    expect(screen.getByText('LOITER')).toBeInTheDocument();
  });

  it('shows lost connection status when not connected', () => {
    render(<SystemPanel {...defaultProps} connected={false} />);
    
    expect(screen.getByText('○ LOST')).toBeInTheDocument();
  });

  it('renders command buttons', () => {
    render(<SystemPanel {...defaultProps} />);
    
    // Find buttons by their text content and check they're button elements
    const buttons = screen.getAllByRole('button');
    const commandButtons = buttons.filter(button => 
      ['TAKEOFF', 'RTH', 'ARM', 'DISARM'].includes(button.textContent || '')
    );
    
    expect(commandButtons.length).toBe(4);
  });

  it('calls onSendCommand when command buttons are clicked', () => {
    render(<SystemPanel {...defaultProps} />);
    
    // Find the actual command buttons (not the text in command log)
    const buttons = screen.getAllByRole('button');
    const takeoffButton = buttons.find(button => button.textContent === 'TAKEOFF');
    const rthButton = buttons.find(button => button.textContent === 'RTH');
    const armButton = buttons.find(button => button.textContent === 'ARM');
    const disarmButton = buttons.find(button => button.textContent === 'DISARM');
    
    expect(takeoffButton).toBeTruthy();
    expect(rthButton).toBeTruthy();
    expect(armButton).toBeTruthy();
    expect(disarmButton).toBeTruthy();
    
    if (takeoffButton) fireEvent.click(takeoffButton);
    expect(defaultProps.onSendCommand).toHaveBeenCalledWith('TAKEOFF');
    
    if (rthButton) fireEvent.click(rthButton);
    expect(defaultProps.onSendCommand).toHaveBeenCalledWith('RTH');
    
    if (armButton) fireEvent.click(armButton);
    expect(defaultProps.onSendCommand).toHaveBeenCalledWith('ARM');
    
    if (disarmButton) fireEvent.click(disarmButton);
    expect(defaultProps.onSendCommand).toHaveBeenCalledWith('DISARM');
  });

  it('disables command buttons when isCommandSending is true', () => {
    render(<SystemPanel {...defaultProps} isCommandSending={true} />);
    
    // Find command buttons and check if they're disabled
    const buttons = screen.getAllByRole('button');
    const commandButtons = buttons.filter(button => 
      ['TAKEOFF', 'RTH', 'ARM', 'DISARM'].includes(button.textContent || '')
    );
    
    commandButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });


  it('renders driver mode button', () => {
    render(<SystemPanel {...defaultProps} />);
    
    expect(screen.getByText('DRIVER MODE')).toBeInTheDocument();
  });

  it('calls onToggleDriverMode when driver mode button is clicked', () => {
    render(<SystemPanel {...defaultProps} />);
    
    fireEvent.click(screen.getByText('DRIVER MODE'));
    expect(defaultProps.onToggleDriverMode).toHaveBeenCalled();
  });

  it('shows driver mode instructions when driver mode is enabled', () => {
    render(<SystemPanel {...defaultProps} isDriverModeEnabled={true} driverWaypointCount={3} />);
    
    expect(screen.getByText(/L-CLICK MAP TO ADD WAYPOINTS \(3\)/)).toBeInTheDocument();
  });

  it('shows command error when present', () => {
    const errorMessage = 'DRONE NOT CONNECTED';
    render(<SystemPanel {...defaultProps} commandError={errorMessage} />);
    
    expect(screen.getByText(`⚠ ${errorMessage}`)).toBeInTheDocument();
  });

  it('shows sending indicator when isCommandSending is true', () => {
    render(<SystemPanel {...defaultProps} isCommandSending={true} />);
    
    expect(screen.getByText('SENDING...')).toBeInTheDocument();
  });

  it('renders flight log section', () => {
    render(<SystemPanel {...defaultProps} />);
    
    expect(screen.getByTestId('flight-log-section')).toBeInTheDocument();
  });

  it('renders command log with entries', () => {
    render(<SystemPanel {...defaultProps} />);
    
    // Check command log headers — STATUS also appears in DATALINK section, so use getAllByText
    expect(screen.getByText('TIME (UTC)')).toBeInTheDocument();
    expect(screen.getByText('CMD')).toBeInTheDocument();
    expect(screen.getAllByText('STATUS').length).toBeGreaterThanOrEqual(1);
    
    // Check command entries — ARM/TAKEOFF also appear as command buttons, so use getAllByText
    expect(screen.getAllByText('ARM').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('TAKEOFF').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ACKED')).toBeInTheDocument();
    expect(screen.getByText('SENT')).toBeInTheDocument();
  });

  it('shows "No commands yet" when command log is empty', () => {
    render(<SystemPanel {...defaultProps} commandLog={[]} />);
    
    expect(screen.getByText('No commands yet')).toBeInTheDocument();
  });

  it('handles missing telemetry data gracefully', () => {
    render(<SystemPanel {...defaultProps} telemetry={null} />);
    
    // Should still render without errors; multiple fields show BLANK_VALUE when telemetry is null
    expect(screen.getByText('◈ System Status')).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });

  it('applies correct styling classes', () => {
    const { container } = render(<SystemPanel {...defaultProps} />);
    
    const panel = container.firstChild;
    expect(panel).toHaveClass('w-52', 'bg-panel', 'border-l', 'border-line');
  });

  it('shows safe status when drone is not armed', () => {
    const safeTelemetry = { ...mockTelemetry, isArmed: false };
    render(<SystemPanel {...defaultProps} telemetry={safeTelemetry} />);
    
    expect(screen.getByText('SAFE')).toBeInTheDocument();
  });

  it('disables driver mode button when not available', () => {
    render(<SystemPanel {...defaultProps} isDriverModeAvailable={false} />);
    
    const driverModeButton = screen.getByText('DRIVER MODE');
    expect(driverModeButton).toBeDisabled();
  });
});