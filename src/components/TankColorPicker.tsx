import {
  PILOT_COLORS,
  pilotColorLabel,
} from '@/game/tanks/tankColors';

interface TankColorPickerProps {
  selected: string;
  onSelect: (hex: string) => void;
}

export function TankColorPicker({ selected, onSelect }: TankColorPickerProps) {
  return (
    <aside className="tank-color-picker" data-testid="tank-color-picker">
      <h3>Tank color</h3>
      <p className="tank-color-hint">Pick a color — rivals see it in the arena.</p>
      <div className="tank-color-swatches">
        {PILOT_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            className={hex === selected ? 'selected' : ''}
            style={{ backgroundColor: hex }}
            title={pilotColorLabel(hex)}
            aria-label={`${pilotColorLabel(hex)} tank`}
            aria-pressed={hex === selected}
            data-testid={`tank-color-${pilotColorLabel(hex).toLowerCase()}`}
            onClick={() => onSelect(hex)}
          />
        ))}
      </div>
      <p className="tank-color-selected">
        Selected: <strong>{pilotColorLabel(selected)}</strong>
      </p>
    </aside>
  );
}
