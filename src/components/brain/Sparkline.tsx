// Mini andamento degli ultimi risultati: linea sottile nel colore attenuato,
// ultimo punto nel colore d'accento. Il valore esatto è sempre scritto accanto
// (il grafico non è l'unico portatore dell'informazione).
export function Sparkline({
  values,
  label,
  width = 96,
  height = 32,
}: {
  values: readonly number[];
  label: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="shrink-0">
      <title>{label}</title>
      <polyline
        points={points}
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(last)} cy={y(values[last])} r={4} fill="var(--secondary)" stroke="var(--bg)" strokeWidth={2} />
    </svg>
  );
}
