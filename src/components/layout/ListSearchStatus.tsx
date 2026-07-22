type ListSearchStatusProps = {
  loading?: boolean;
  filteredCount: number;
  totalCount: number;
  itemSingular: string;
  itemPlural: string;
  /** Avviso giallo: ricerca testuale attiva */
  isSearchActive?: boolean;
  /** Conteggio "X risultati su Y" (ricerca e/o altri filtri lista) */
  isNarrowed?: boolean;
};

export function ListSearchStatus({
  loading = false,
  filteredCount,
  totalCount,
  itemSingular,
  itemPlural,
  isSearchActive = false,
  isNarrowed,
}: ListSearchStatusProps) {
  const narrowed = isNarrowed ?? isSearchActive;
  const countLabel = loading
    ? "Ricerca in corso…"
    : narrowed
      ? `${filteredCount} risultat${filteredCount === 1 ? "o" : "i"} su ${totalCount} ${itemPlural}`
      : `${totalCount} ${totalCount === 1 ? itemSingular : itemPlural}`;

  return (
    <div className="space-y-1">
      {isSearchActive ? (
        <p className="text-xs font-medium text-amber-800">
          Filtro attivo: stai vedendo solo i {itemPlural} che corrispondono alla ricerca, non
          l&apos;elenco completo.
        </p>
      ) : null}
      <p className="text-sm text-slate-500">{countLabel}</p>
    </div>
  );
}
