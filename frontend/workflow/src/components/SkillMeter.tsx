interface SkillMeterProps {
  level: number;
  max?: number;
  /** Print "Expert" etc. beside the pips. */
  showLabel?: boolean;
}

export const SKILL_LABELS = ['Beginner', 'Junior', 'Intermediate', 'Advanced', 'Expert'];

/**
 * Skill level as five pips plus its name. Ordinal, so a single hue: filled pips
 * in brand navy, the rest in the line colour. The number and label are always
 * printed, so the pips are a reading aid rather than the only signal.
 */
const SkillMeter = ({ level, max = 5, showLabel = true }: SkillMeterProps) => {
  const clamped = Math.max(0, Math.min(max, Math.round(level)));
  return (
    <span className="inline-flex items-center gap-2" title={`Skill ${clamped} of ${max}`}>
      <span aria-hidden="true" className="inline-flex gap-[3px]">
        {Array.from({ length: max }).map((_, i) => (
          <span key={i} className={`h-2.5 w-1.5 rounded-sm ${i < clamped ? 'bg-primary' : 'bg-line'}`} />
        ))}
      </span>
      <span className="text-meta text-ink-muted tabular">
        {clamped}/{max}
        {showLabel && SKILL_LABELS[clamped - 1] ? ` · ${SKILL_LABELS[clamped - 1]}` : ''}
      </span>
    </span>
  );
};

export default SkillMeter;
