import { FiSearch, FiX } from 'react-icons/fi';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name; the placeholder is not one. */
  label: string;
  className?: string;
}

/** Filter box for a list. Clears with the × or Escape. */
const SearchInput = ({ value, onChange, placeholder, label, className = '' }: SearchInputProps) => (
  <div className={`relative ${className}`}>
    <FiSearch aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
    <input
      type="search"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && value) {
          e.stopPropagation();
          onChange('');
        }
      }}
      className="w-full h-9 pl-9 pr-8 rounded-control border border-line-strong bg-surface text-body text-ink
        placeholder:text-ink-subtle hover:border-[#A9B0C4] focus:outline-none focus:border-primary focus:shadow-focus
        [&::-webkit-search-cancel-button]:appearance-none"
    />
    {value && (
      <button
        type="button"
        aria-label="Clear search"
        onClick={() => onChange('')}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded
          text-ink-subtle hover:text-ink hover:bg-surface-sunken cursor-pointer"
      >
        <FiX aria-hidden="true" />
      </button>
    )}
  </div>
);

export default SearchInput;
