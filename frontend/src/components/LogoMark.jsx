export default function LogoMark({ className = "h-5 w-5", inverted = false }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="3.5"
        width="25"
        height="25"
        rx="5.5"
        className={inverted ? "fill-black stroke-black" : "fill-transparent stroke-current"}
      />
      <path
        d="M9 9.5L13.8 22.5L18.2 9.5"
        className={inverted ? "stroke-white" : "stroke-current"}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 9.5V22.5H24"
        className={inverted ? "stroke-white" : "stroke-current"}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
