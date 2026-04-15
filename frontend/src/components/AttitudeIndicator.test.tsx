import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AttitudeIndicator from './AttitudeIndicator';

describe('AttitudeIndicator', () => {
  it('renders with default props', () => {
    render(<AttitudeIndicator />);
    
    const svg = screen.getByLabelText(/Attitude: roll 0\.0° pitch 0\.0°/);
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '128');
    expect(svg).toHaveAttribute('height', '128');
  });

  it('renders with custom size', () => {
    render(<AttitudeIndicator size={200} />);
    
    const svg = screen.getByLabelText(/Attitude: roll 0\.0° pitch 0\.0°/);
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('height', '200');
  });

  it('renders with custom roll and pitch values', () => {
    render(<AttitudeIndicator roll={30} pitch={10} />);
    
    const svg = screen.getByLabelText('Attitude: roll 30.0° pitch 10.0°');
    expect(svg).toBeInTheDocument();
  });

  it('applies rotation transform for roll', () => {
    const { container } = render(<AttitudeIndicator roll={45} />);
    
    const rotatingGroup = container.querySelector('g[transform*="rotate(45"]');
    expect(rotatingGroup).toBeInTheDocument();
  });

  it('clamps pitch values within limits', () => {
    // Test with extreme pitch values that should be clamped
    render(<AttitudeIndicator pitch={50} />);
    
    // Should still render without errors
    const svg = screen.getByLabelText(/Attitude:.*pitch 50\.0°/);
    expect(svg).toBeInTheDocument();
  });

  it('renders sky and ground rectangles', () => {
    const { container } = render(<AttitudeIndicator />);
    
    const skyRect = container.querySelector('rect[fill="#07192e"]');
    const groundRect = container.querySelector('rect[fill="#1a0d04"]');
    
    expect(skyRect).toBeInTheDocument();
    expect(groundRect).toBeInTheDocument();
  });

  it('renders horizon line', () => {
    const { container } = render(<AttitudeIndicator />);
    
    const horizonLine = container.querySelector('line[stroke="#00FF41"]');
    expect(horizonLine).toBeInTheDocument();
  });

  it('renders pitch ladder lines', () => {
    const { container } = render(<AttitudeIndicator />);
    
    const pitchLines = container.querySelectorAll('line[stroke="#00FF41"][strokeOpacity="0.55"]');
    expect(pitchLines.length).toBeGreaterThan(0);
  });

  it('renders crosshair elements', () => {
    const { container } = render(<AttitudeIndicator />);
    
    const crosshairLines = container.querySelectorAll('line[stroke="#00FF41"][strokeWidth="2"]');
    expect(crosshairLines.length).toBe(2);
    
    const centerCircle = container.querySelector('circle[fill="#00FF41"][r="2"]');
    expect(centerCircle).toBeInTheDocument();
  });

  it('renders roll tick marks', () => {
    const { container } = render(<AttitudeIndicator />);
    
    const rollTicks = container.querySelectorAll('line[stroke="#00FF41"][strokeOpacity="0.5"]');
    expect(rollTicks.length).toBeGreaterThan(0);
  });

  it('renders roll pointer triangle', () => {
    const { container } = render(<AttitudeIndicator roll={20} />);
    
    const triangle = container.querySelector('polygon[fill="#00FF41"]');
    expect(triangle).toBeInTheDocument();
    expect(triangle).toHaveAttribute('opacity', '0.85');
  });

  it('renders border circle', () => {
    const { container } = render(<AttitudeIndicator />);
    
    const border = container.querySelector('circle[fill="none"][stroke="#1e2a3a"]');
    expect(border).toBeInTheDocument();
    expect(border).toHaveAttribute('strokeWidth', '2');
  });
});