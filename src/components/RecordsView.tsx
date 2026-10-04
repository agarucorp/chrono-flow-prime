import { useMemo, useState } from 'react';
import { ChevronDown, Search, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRecords } from '@/hooks/useRecords';
import {
  RECORD_MEDAL_STYLES,
  formatRecordValor,
  getRecordMedal,
  getRecordPlaceNumbers,
  sortRecordsByRanking,
  type RecordDisciplina,
  type RecordEntry,
} from '@/lib/records';

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function RecordTable({
  rows,
  places,
  unidad,
}: {
  rows: RecordEntry[];
  places: number[];
  unidad: RecordDisciplina['unidad'];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-border">
            <th className="w-12 px-2 py-2 text-left text-caption font-medium sm:px-3">#</th>
            <th className="px-2 py-2 text-left text-caption font-medium sm:px-3">Alumno</th>
            <th className="px-2 py-2 text-right text-caption font-medium sm:px-3">Record</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const place = places[index];
            const medal = getRecordMedal(place);
            const medalStyle = medal ? RECORD_MEDAL_STYLES[medal] : null;
            return (
              <tr
                key={row.id}
                className="border-b border-border/60 last:border-0"
              >
                <td className="px-2 py-2.5 sm:px-3">
                  {medalStyle ? (
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-2 ${medalStyle.className} ${medalStyle.ring}`}
                      title={medal === 'oro' ? 'Oro' : medal === 'plata' ? 'Plata' : 'Bronce'}
                      aria-label={`Puesto ${place}, ${medal}`}
                    >
                      {medalStyle.label}
                    </span>
                  ) : (
                    <span className="inline-flex h-6 w-6 items-center justify-center text-caption text-muted-foreground">
                      {place}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-sm sm:px-3">{row.alumno_nombre}</td>
                <td className="px-2 py-2.5 text-right text-sm font-medium sm:px-3">
                  {formatRecordValor(row.valor, unidad)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RecordsView() {
  const { disciplinas, entries, loading, error } = useRecords();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const needle = normalizeName(query);
  const searching = needle.length > 0;

  const grouped = useMemo(() => {
    return disciplinas.map((disc) => {
      const ranked = sortRecordsByRanking(
        entries.filter((e) => e.disciplina_id === disc.id),
        disc.unidad
      );
      const places = getRecordPlaceNumbers(ranked, disc.unidad);
      const matched = searching
        ? ranked
            .map((row, index) => ({ row, place: places[index] }))
            .filter(({ row }) => normalizeName(row.alumno_nombre).includes(needle))
        : [];
      return { disc, ranked, places, matched };
    });
  }, [disciplinas, entries, needle, searching]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-body-muted">Cargando records...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="py-8 text-center text-sm text-destructive">
          {error}
          <p className="mt-2 text-caption">
            Si es la primera vez, el admin debe aplicar la migración de records en Supabase.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (disciplinas.length === 0) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="py-10 text-center">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-heading">Todavía no hay disciplinas</p>
          <p className="mt-1 text-body-muted">
            Cuando el admin cargue records, van a aparecer acá.
          </p>
        </CardContent>
      </Card>
    );
  }

  const visibleGroups = searching ? grouped.filter((g) => g.matched.length > 0) : grouped;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24 sm:pb-0">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre"
          aria-label="Buscar records por nombre"
          className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {searching && visibleGroups.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Ningún record coincide con «{query.trim()}».
          </CardContent>
        </Card>
      )}

      {visibleGroups.map(({ disc, ranked, places, matched }) => {
        const podiumCount = places.findIndex((place) => place > 3);
        const visibleCount = podiumCount === -1 ? ranked.length : podiumCount;
        const isOpen = openId === disc.id;
        const shown = searching
          ? matched.map((m) => m.row)
          : isOpen
            ? ranked
            : ranked.slice(0, visibleCount);
        const shownPlaces = searching
          ? matched.map((m) => m.place)
          : isOpen
            ? places
            : places.slice(0, visibleCount);
        const hiddenCount = Math.max(0, ranked.length - visibleCount);

        return (
          <Card key={disc.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-baseline justify-between gap-3">
                <span>{disc.nombre}</span>
                <span className="text-caption font-normal text-muted-foreground">
                  {searching
                    ? `${matched.length} ${matched.length === 1 ? 'resultado' : 'resultados'}`
                    : hiddenCount > 0 && !isOpen
                      ? `Podio de ${ranked.length}`
                      : `${ranked.length} ${ranked.length === 1 ? 'record' : 'records'}`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ranked.length === 0 ? (
                <p className="text-caption py-2">Sin records cargados todavía.</p>
              ) : (
                <>
                  <RecordTable rows={shown} places={shownPlaces} unidad={disc.unidad} />
                  {!searching && hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setOpenId((current) => (current === disc.id ? null : disc.id))
                      }
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      aria-expanded={isOpen}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      {isOpen ? 'Mostrar menos' : `Ver todos (${ranked.length})`}
                    </button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
