import { CodeXml } from 'lucide-react';

// Neutral product mark used wherever the app shows its brand. It is a
// plain icon (no third-party logo), sized to fill its container.
export default function BrandMark({ size = 18 }) {
  return (
    <span className="brand-mark" role="img" aria-label="XRSpectre">
      <CodeXml size={size} strokeWidth={2.25} aria-hidden="true" />
    </span>
  );
}
