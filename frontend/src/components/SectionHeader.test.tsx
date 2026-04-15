import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectionHeader from './SectionHeader';

describe('SectionHeader', () => {
  it('renders the title correctly', () => {
    render(<SectionHeader title="POSITION" />);
    
    expect(screen.getByText('POSITION')).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    const { container } = render(<SectionHeader title="TEST" />);
    
    const titleElement = screen.getByText('TEST');
    expect(titleElement).toHaveClass('text-[9px]', 'text-neon', 'tracking-widest', 'font-bold');
    
    const containerDiv = container.firstChild;
    expect(containerDiv).toHaveClass('flex', 'items-center', 'gap-2', 'py-1.5');
  });

  it('renders a divider line', () => {
    const { container } = render(<SectionHeader title="TEST" />);
    
    const divider = container.querySelector('.h-px.bg-line');
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveClass('flex-1', 'h-px', 'bg-line');
  });

  it('renders different titles correctly', () => {
    const titles = ['POSITION', 'KINEMATICS', 'BATTERY', 'GPS QUALITY'];
    
    titles.forEach(title => {
      const { unmount } = render(<SectionHeader title={title} />);
      expect(screen.getByText(title)).toBeInTheDocument();
      unmount();
    });
  });
});