interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * The product mark: three stage nodes with a hand-off between lanes — the shape
 * every enquiry takes through the workflow. Decorative; the wordmark beside it
 * carries the name.
 */
const BrandMark = ({ size = 32, className = '' }: BrandMarkProps) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    className={className}
  >
    <rect width="32" height="32" rx="8" fill="#434E78" />
    <path
      d="M9 11h5.5a3 3 0 0 1 3 3v4a3 3 0 0 0 3 3H23"
      stroke="#FFFFFF"
      strokeOpacity="0.55"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="9" cy="11" r="3" fill="#FFFFFF" />
    <circle cx="17.5" cy="16" r="2.25" fill="#FFFFFF" fillOpacity="0.8" />
    <circle cx="23" cy="21" r="3" fill="#8FE3B8" />
  </svg>
);

export default BrandMark;
