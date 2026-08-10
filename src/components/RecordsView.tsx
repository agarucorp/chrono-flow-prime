import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRecords } from '@/hooks/useRecords';
import { formatRecordValor } from '@/lib/records';

export function RecordsView() {
  const { disciplinas, entries, loading, error } = useRecords();

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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24 sm:pb-0">
      <div className="mb-2">
        <h2 className="text-title">Records</h2>
      </div>

      {disciplinas.map((disc) => {
        const rows = entries.filter((e) => e.disciplina_id === disc.id);
        return (
          <Card key={disc.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{disc.nombre}</CardTitle>
                <span className="text-label">
                  {disc.unidad === 'kg' ? 'Kilogramos' : 'Tiempo'}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-caption py-2">Sin records cargados todavía.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-2 py-2 text-left text-caption font-medium sm:px-3">Alumno</th>
                        <th className="px-2 py-2 text-right text-caption font-medium sm:px-3">Record</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-b border-border/60 last:border-0">
                          <td className="px-2 py-2.5 text-sm sm:px-3">{row.alumno_nombre}</td>
                          <td className="px-2 py-2.5 text-right text-sm font-medium sm:px-3">
                            {formatRecordValor(row.valor, disc.unidad)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
