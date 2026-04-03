import type { SectionHeaderProps } from '../interfaces/components';

export default function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-[9px] text-neon tracking-widest font-bold">{title}</span>
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}
