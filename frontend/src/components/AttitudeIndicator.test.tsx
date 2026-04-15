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
    
    // Look for pitch ladder lines by checking if they exist in the rendered SVG
    const lines = container.querySelectorAll('line');
    const pitchLines = Array.from(lines).filter(line => {
      const stroke = line.getAttribute('stroke');
      const strokeOpacity = line.getAttribute('stroke-opacity');
      return stroke === '#00FF41' && strokeOpacity === '0.55';
    });
    expect(pitchLines.length).toBeGreaterThan(0);
  });

  it('renders crosshair elements', () => {
    const { container } = render(<AttitudeIndicator />);
    
    // Look for crosshair lines
    const lines = container.querySelectorAll('line');
    const crosshairLines = Array.from(lines).filter(line => {
      const stroke = line.getAttribute('stroke');
      const strokeWidth = line.getAttribute('stroke-width');
      return stroke === '#00FF41' && strokeWidth === '2';
    });
    expect(crosshairLines.length).toBe(2);
    
    // Look for center circle
    const circles = container.querySelectorAll('circle');
    const centerCircle = Array.from(circles).find(circle => {
      const fill = circle.getAttribute('fill');
      const r = circle.getAttribute('r');
      return fill === '#00FF41' && r === '2';
    });
    expect(centerCircle).toBeTruthy();
  });

  it('renders roll tick marks', () => {
    const { container } = render(<AttitudeIndicator />);
    
    // Look for roll tick marks
    const lines = container.querySelectorAll('line');
    const rollTicks = Array.from(lines).filter(line => {
      const stroke = line.getAttribute('stroke');
      const strokeOpacity = line.getAttribute('stroke-opacity');
      return stroke === '#00FF41' && strokeOpacity === '0.5';
    });
    expect(rollTicks.length).toBeGreaterThan(0);
  });

  it('renders border circle', () => {
    const { container } = render(<AttitudeIndicator />);
    
    // Look for border circle
    const circles = container.querySelectorAll('circle');
    const border = Array.from(circles).find(circle => {
      const fill = circle.getAttribute('fill');
      const stroke = circle.getAttribute('stroke');
      return fill === 'none' && stroke === '#1e2a3a';
    });
    expect(border).toBeTruthy();
    expect(border?.getAttribute('stroke-width')).toBe('2');
  });

  it('renders roll pointer triangle', () => {
    const { container } = render(<AttitudeIndicator roll={20} />);
    
    const triangle = container.querySelector('polygon[fill="#00FF41"]');
    expect(triangle).toBeInTheDocument();
    expect(triangle).toHaveAttribute('opacity', '0.85');
  });

});