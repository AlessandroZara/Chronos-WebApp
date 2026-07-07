interface BarChartProps {
  data: { label: string; value: number }[];
  colorClass?: string;
  suffix?: string;
  labelEvery?: number;
}

/** Grafico a barre leggero (solo div + flexbox, nessuna dipendenza). */
export default function BarChart({
  data,
  colorClass = 'bg-indigo-500',
  suffix = '',
  labelEvery = 1,
}: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      <div className="flex h-32 items-end gap-px sm:gap-1">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex h-full flex-1 flex-col justify-end"
            title={`${d.label}: ${d.value}${suffix}`}
          >
            <div
              className={`${colorClass} w-full rounded-t transition-all hover:opacity-80`}
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? '3px' : '0',
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-px sm:gap-1">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 truncate text-center text-[10px] text-slate-400"
          >
            {i % labelEvery === 0 ? d.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
