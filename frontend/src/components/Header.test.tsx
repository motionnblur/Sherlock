import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Header from './Header';
import { NAVIGATION_DIRECTION_ALL } from '../constants/navigation';

// Mock the navigation constants
vi.mock('../constants/navigation', () => ({
  NAVIGATION_DIRECTION_ALL: 'ALL',
}));

// Mock the UtcClock component by mocking Date
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Header', () => {
  const defaultProps = {
    connected: true,
    selectedDrone: 'SHERLOCK-01',
    freeMode: false,
    isLiveVideoOpen: false,
    showAllAssets: false,
    selectedNavigationDirection: 'ALL' as const,
    isMissionModeEnabled: false,
    isGeofenceModeEnabled: false,
    isReplayModeEnabled: false,
    onToggleFreeMode: vi.fn(),
    onDeselect: vi.fn(),
    onToggleLiveVideo: vi.fn(),
    onToggleShowAllAssets: vi.fn(),
    onSelectNavigationDirection: vi.fn(),
    onToggleMissionMode: vi.fn(),
    onToggleGeofenceMode: vi.fn(),
    onToggleReplayMode: vi.fn(),
    onLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<Header {...defaultProps} />);
    
    expect(screen.getByText('SHERLOCK GCS')).toBeInTheDocument();
  });

  it('renders UTC clock', () => {
    render(<Header {...defaultProps} />);
    
    // The UTC clock should show 12:00:00 since we mocked the time
    expect(screen.getByText('12:00:00')).toBeInTheDocument();
  });

  it('shows link status when drone is selected', () => {
    render(<Header {...defaultProps} />);
    
    expect(screen.getByText('LINK ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('SHERLOCK-01')).toBeInTheDocument();
  });

  it('shows connecting status when not connected', () => {
    render(<Header {...defaultProps} connected={false} />);
    
    expect(screen.getByText('CONNECTING...')).toBeInTheDocument();
  });

  it('shows logout button when no drone is selected', () => {
    render(<Header {...defaultProps} selectedDrone={null} />);
    
    expect(screen.getByText('LOG OUT')).toBeInTheDocument();
    expect(screen.queryByText('LINK ACTIVE')).not.toBeInTheDocument();
    expect(screen.queryByText('SHERLOCK-01')).not.toBeInTheDocument();
  });

  it('calls onLogout when logout button is clicked', () => {
    render(<Header {...defaultProps} selectedDrone={null} />);
    
    fireEvent.click(screen.getByText('LOG OUT'));
    expect(defaultProps.onLogout).toHaveBeenCalled();
  });

  it('shows settings button when drone is selected', () => {
    render(<Header {...defaultProps} />);
    
    expect(screen.getByText('SETTINGS')).toBeInTheDocument();
    expect(screen.getByText('✕')).toBeInTheDocument(); // Deselect button
  });

  it('opens settings menu when settings button is clicked', () => {
    render(<Header {...defaultProps} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    
    expect(screen.getByText('FREE MODE: OFF')).toBeInTheDocument();
  });

  it('calls onDeselect when deselect button is clicked', () => {
    render(<Header {...defaultProps} />);
    
    fireEvent.click(screen.getByText('✕'));
    expect(defaultProps.onDeselect).toHaveBeenCalled();
  });

  it('calls onToggleFreeMode when free mode toggle is clicked', () => {
    render(<Header {...defaultProps} />);
    
    // Open settings first
    fireEvent.click(screen.getByText('SETTINGS'));
    
    fireEvent.click(screen.getByText('FREE MODE: OFF'));
    expect(defaultProps.onToggleFreeMode).toHaveBeenCalled();
  });

  it('shows free mode as ON when freeMode is true', () => {
    render(<Header {...defaultProps} freeMode={true} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    
    expect(screen.getByText('FREE MODE: ON')).toBeInTheDocument();
  });

  it('shows non-free mode options when freeMode is false', () => {
    render(<Header {...defaultProps} freeMode={false} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    
    expect(screen.getByText('LIVE VIDEO: OFF')).toBeInTheDocument();
    expect(screen.getByText('MISSION PLAN: OFF')).toBeInTheDocument();
    expect(screen.getByText('GEOFENCE DRAW: OFF')).toBeInTheDocument();
    expect(screen.getByText('FLIGHT REPLAY: OFF')).toBeInTheDocument();
  });

  it('calls onToggleLiveVideo when live video toggle is clicked', () => {
    render(<Header {...defaultProps} freeMode={false} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    fireEvent.click(screen.getByText('LIVE VIDEO: OFF'));
    
    expect(defaultProps.onToggleLiveVideo).toHaveBeenCalled();
  });

  it('calls onToggleMissionMode when mission plan toggle is clicked', () => {
    render(<Header {...defaultProps} freeMode={false} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    fireEvent.click(screen.getByText('MISSION PLAN: OFF'));
    
    expect(defaultProps.onToggleMissionMode).toHaveBeenCalled();
  });

  it('calls onToggleGeofenceMode when geofence draw toggle is clicked', () => {
    render(<Header {...defaultProps} freeMode={false} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    fireEvent.click(screen.getByText('GEOFENCE DRAW: OFF'));
    
    expect(defaultProps.onToggleGeofenceMode).toHaveBeenCalled();
  });

  it('calls onToggleReplayMode when flight replay toggle is clicked', () => {
    render(<Header {...defaultProps} freeMode={false} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    fireEvent.click(screen.getByText('FLIGHT REPLAY: OFF'));
    
    expect(defaultProps.onToggleReplayMode).toHaveBeenCalled();
  });

  it('shows free mode options when freeMode is true', () => {
    render(<Header {...defaultProps} freeMode={true} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    
    expect(screen.getByText('SHOW ASSET: PARTICULAR')).toBeInTheDocument();
  });

  it('calls onToggleShowAllAssets when show asset toggle is clicked', () => {
    render(<Header {...defaultProps} freeMode={true} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    fireEvent.click(screen.getByText('SHOW ASSET: PARTICULAR'));
    
    expect(defaultProps.onToggleShowAllAssets).toHaveBeenCalled();
  });

  it('shows navigation filter when showAllAssets is true in free mode', () => {
    render(<Header {...defaultProps} freeMode={true} showAllAssets={true} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    
    expect(screen.getByText('SHOW ASSETS BY NAW')).toBeInTheDocument();
  });

  it('opens navigation filter when show assets by NAW is clicked', () => {
    render(<Header {...defaultProps} freeMode={true} showAllAssets={true} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    fireEvent.click(screen.getByText('SHOW ASSETS BY NAW'));
    
    expect(screen.getByText('ALL')).toBeInTheDocument();
    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.getByText('NE')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('SE')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('SW')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('NW')).toBeInTheDocument();
  });

  it('calls onSelectNavigationDirection when navigation direction is clicked', () => {
    render(<Header {...defaultProps} freeMode={true} showAllAssets={true} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    fireEvent.click(screen.getByText('SHOW ASSETS BY NAW'));
    fireEvent.click(screen.getByText('N'));
    
    expect(defaultProps.onSelectNavigationDirection).toHaveBeenCalledWith('N');
  });

  it('calls onSelectNavigationDirection with ALL when ALL button is clicked', () => {
    render(<Header {...defaultProps} freeMode={true} showAllAssets={true} />);
    
    fireEvent.click(screen.getByText('SETTINGS'));
    fireEvent.click(screen.getByText('SHOW ASSETS BY NAW'));
    fireEvent.click(screen.getByText('ALL'));
    
    expect(defaultProps.onSelectNavigationDirection).toHaveBeenCalledWith('ALL');
  });

  it('applies correct styling classes', () => {
    const { container } = render(<Header {...defaultProps} />);
    
    const header = container.firstChild;
    expect(header).toHaveClass('flex', 'items-center', 'justify-between', 'px-4', 'h-11', 'bg-panel', 'border-b', 'border-line');
  });

  it('closes settings when clicking outside', () => {
    render(<Header {...defaultProps} />);

    // Open settings
    fireEvent.click(screen.getByText('SETTINGS'));
    expect(screen.getByText('FREE MODE: OFF')).toBeInTheDocument();

    // Click outside — wrap in act() to flush the React state update triggered by the window
    // mousedown listener. waitFor() is incompatible with vi.useFakeTimers() used in beforeEach.
    act(() => {
      fireEvent.mouseDown(document.body);
    });

    expect(screen.queryByText('FREE MODE: OFF')).not.toBeInTheDocument();
  });

  it('hides settings when drone is deselected', () => {
    const { rerender } = render(<Header {...defaultProps} />);
    
    // Open settings
    fireEvent.click(screen.getByText('SETTINGS'));
    expect(screen.getByText('FREE MODE: OFF')).toBeInTheDocument();
    
    // Deselect drone
    rerender(<Header {...defaultProps} selectedDrone={null} />);
    
    expect(screen.queryByText('FREE MODE: OFF')).not.toBeInTheDocument();
  });

  it('hides navigation filter when free mode is turned off', () => {
    const { rerender } = render(<Header {...defaultProps} freeMode={true} showAllAssets={true} />);
    
    // Open settings and navigation filter
    fireEvent.click(screen.getByText('SETTINGS'));
    fireEvent.click(screen.getByText('SHOW ASSETS BY NAW'));
    expect(screen.getByText('ALL')).toBeInTheDocument();
    
    // Turn off free mode
    rerender(<Header {...defaultProps} freeMode={false} showAllAssets={true} />);
    
    expect(screen.queryByText('ALL')).not.toBeInTheDocument();
  });

  it('hides navigation filter when showAllAssets is turned off', () => {
    const { rerender } = render(<Header {...defaultProps} freeMode={true} showAllAssets={true} />);
    
    // Open settings and navigation filter
    fireEvent.click(screen.getByText('SETTINGS'));
    fireEvent.click(screen.getByText('SHOW ASSETS BY NAW'));
    expect(screen.getByText('ALL')).toBeInTheDocument();
    
    // Turn off showAllAssets
    rerender(<Header {...defaultProps} freeMode={true} showAllAssets={false} />);
    
    expect(screen.queryByText('ALL')).not.toBeInTheDocument();
  });
});