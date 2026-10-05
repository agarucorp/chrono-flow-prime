import { useMemo, useState } from 'react';
import { ChevronDown, Pencil, Plus, Search, Trash2, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRecords } from '@/hooks/useRecords';
import { supabase } from '@/lib/supabase';
import {
  RECORD_MEDAL_STYLES,
  formatRecordValor,
  getRecordMedal,
  getRecordPlaceNumbers,
  isValidRecordValor,
  sortRecordsByRanking,
  type RecordDisciplina,
  type RecordEntry,
  type RecordUnidad,
} from '@/lib/records';
import { toast } from 'sonner';

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function RecordsAdminPanel() {
  const { disciplinas, entries, loading, error, reload } = useRecords();
  const [saving, setSaving] = useState(false);
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

  const [discDialogOpen, setDiscDialogOpen] = useState(false);
  const [editingDisc, setEditingDisc] = useState<RecordDisciplina | null>(null);
  const [discNombre, setDiscNombre] = useState('');
  const [discUnidad, setDiscUnidad] = useState<RecordUnidad>('kg');

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RecordEntry | null>(null);
  const [entryDiscId, setEntryDiscId] = useState('');
  const [entryNombre, setEntryNombre] = useState('');
  const [entryValor, setEntryValor] = useState('');

  const [deleteDisc, setDeleteDisc] = useState<RecordDisciplina | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<RecordEntry | null>(null);

  const selectedUnidad = useMemo(() => {
    const id = editingEntry?.disciplina_id || entryDiscId;
    return disciplinas.find((d) => d.id === id)?.unidad || 'kg';
  }, [disciplinas, entryDiscId, editingEntry]);

  const openCreateDisc = () => {
    setEditingDisc(null);
    setDiscNombre('');
    setDiscUnidad('kg');
    setDiscDialogOpen(true);
  };

  const openEditDisc = (d: RecordDisciplina) => {
    setEditingDisc(d);
    setDiscNombre(d.nombre);
    setDiscUnidad(d.unidad);
    setDiscDialogOpen(true);
  };

  const openCreateEntry = (disciplinaId?: string) => {
    setEditingEntry(null);
    setEntryDiscId(disciplinaId || disciplinas[0]?.id || '');
    setEntryNombre('');
    setEntryValor('');
    setEntryDialogOpen(true);
  };

  const openEditEntry = (e: RecordEntry) => {
    setEditingEntry(e);
    setEntryDiscId(e.disciplina_id);
    setEntryNombre(e.alumno_nombre);
    setEntryValor(e.valor);
    setEntryDialogOpen(true);
  };

  const saveDisciplina = async () => {
    const nombre = discNombre.trim();
    if (!nombre) {
      toast.error('Ingresá un nombre de disciplina');
      return;
    }
    setSaving(true);
    try {
      if (editingDisc) {
        const { error: err } = await supabase
          .from('record_disciplinas')
          .update({ nombre, unidad: discUnidad, updated_at: new Date().toISOString() })
          .eq('id', editingDisc.id);
        if (err) throw err;
        toast.success('Disciplina actualizada');
      } else {
        const nextOrden = (disciplinas.reduce((m, d) => Math.max(m, d.orden), 0) || 0) + 1;
        const { error: err } = await supabase.from('record_disciplinas').insert({
          nombre,
          unidad: discUnidad,
          orden: nextOrden,
        });
        if (err) throw err;
        toast.success('Disciplina creada');
      }
      setDiscDialogOpen(false);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar la disciplina');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteDisc = async () => {
    if (!deleteDisc) return;
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('record_disciplinas')
        .delete()
        .eq('id', deleteDisc.id);
      if (err) throw err;
      toast.success('Disciplina eliminada');
      setDeleteDisc(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar');
    } finally {
      setSaving(false);
    }
  };

  const saveEntry = async () => {
    const nombre = entryNombre.trim();
    const valor = entryValor.trim().replace(',', '.');
    if (!entryDiscId) {
      toast.error('Elegí una disciplina');
      return;
    }
    if (!nombre) {
      toast.error('Ingresá el nombre del alumno');
      return;
    }
    if (!isValidRecordValor(valor, selectedUnidad)) {
      toast.error(
        selectedUnidad === 'kg'
          ? 'Valor inválido. Usá un número (ej: 80 o 80.5)'
          : 'Tiempo inválido. Usá formato mm:ss (ej: 04:32)'
      );
      return;
    }
    setSaving(true);
    try {
      if (editingEntry) {
        const { error: err } = await supabase
          .from('record_entries')
          .update({
            disciplina_id: entryDiscId,
            alumno_nombre: nombre,
            valor,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingEntry.id);
        if (err) throw err;
        toast.success('Record actualizado');
      } else {
        const { error: err } = await supabase.from('record_entries').insert({
          disciplina_id: entryDiscId,
          alumno_nombre: nombre,
          valor,
        });
        if (err) throw err;
        toast.success('Record agregado');
      }
      setEntryDialogOpen(false);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar el record');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteEntry = async () => {
    if (!deleteEntry) return;
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('record_entries')
        .delete()
        .eq('id', deleteEntry.id);
      if (err) throw err;
      toast.success('Record eliminado');
      setDeleteEntry(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Trophy className="h-5 w-5" />
            Records de alumnos
          </CardTitle>
          <p className="mt-1 text-sm text-foreground/70">
            Creá disciplinas y cargá marcas con nombre libre (sin vincular usuarios).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openCreateDisc}>
            <Plus className="mr-1.5 h-4 w-4" />
            Disciplina
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => openCreateEntry()}
            disabled={disciplinas.length === 0}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Record
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-body-muted">Cargando...</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error}
            <span className="mt-1 block text-caption">
              Aplicá la migración <code>20260810_records_alumnos.sql</code> en Supabase.
            </span>
          </p>
        ) : disciplinas.length === 0 ? (
          <p className="text-body-muted">No hay disciplinas. Creá la primera para empezar.</p>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre"
                aria-label="Buscar records por nombre"
                className="pl-9"
              />
            </div>
            {searching && grouped.every((g) => g.matched.length === 0) && (
              <p className="text-sm text-muted-foreground">
                Ningún record coincide con «{query.trim()}».
              </p>
            )}
            {(searching ? grouped.filter((g) => g.matched.length > 0) : grouped).map(({ disc, ranked, places, matched }) => {
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
              <div key={disc.id} className="surface-inset p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-heading">{disc.nombre}</p>
                    <p className="text-label mt-0.5">
                      {disc.unidad === 'kg' ? 'Unidad: kg · mayor primero' : 'Unidad: tiempo · menor primero'}
                      {ranked.length > 0 && (
                        <span className="ml-2">
                          {searching
                            ? `· ${matched.length} ${matched.length === 1 ? 'resultado' : 'resultados'}`
                            : hiddenCount > 0 && !isOpen
                              ? `· Podio de ${ranked.length}`
                              : `· ${ranked.length} ${ranked.length === 1 ? 'record' : 'records'}`}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => openCreateEntry(disc.id)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => openEditDisc(disc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteDisc(disc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {ranked.length === 0 ? (
                  <p className="text-caption">Sin records.</p>
                ) : (
                  <div className="space-y-1.5">
                    {shown.map((row, index) => {
                      const place = shownPlaces[index];
                      const medal = getRecordMedal(place);
                      const medalStyle = medal ? RECORD_MEDAL_STYLES[medal] : null;
                      return (
                        <div
                          key={row.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            {medalStyle ? (
                              <span
                                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-2 ${medalStyle.className} ${medalStyle.ring}`}
                                title={medal === 'oro' ? 'Oro' : medal === 'plata' ? 'Plata' : 'Bronce'}
                                aria-label={`Puesto ${place}, ${medal}`}
                              >
                                {medalStyle.label}
                              </span>
                            ) : (
                              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-caption text-muted-foreground">
                                {place}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{row.alumno_nombre}</p>
                              <p className="text-caption">{formatRecordValor(row.valor, disc.unidad)}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button type="button" variant="ghost" size="icon" onClick={() => openEditEntry(row)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteEntry(row)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {!searching && hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenId((current) => (current === disc.id ? null : disc.id))
                        }
                        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                        aria-expanded={isOpen}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        {isOpen ? 'Mostrar menos' : `Ver todos (${ranked.length})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </>
        )}
      </CardContent>

      {/* Dialog disciplina */}
      <Dialog open={discDialogOpen} onOpenChange={setDiscDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDisc ? 'Editar disciplina' : 'Nueva disciplina'}</DialogTitle>
            <DialogDescription>
              Definí el nombre y la unidad de medida del record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disc-nombre">Nombre</Label>
              <Input
                id="disc-nombre"
                value={discNombre}
                onChange={(e) => setDiscNombre(e.target.value)}
                placeholder="Ej: Press plano"
              />
            </div>
            <div className="space-y-2">
              <Label>Unidad</Label>
              <Select value={discUnidad} onValueChange={(v) => setDiscUnidad(v as RecordUnidad)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                  <SelectItem value="tiempo">Tiempo (mm:ss)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDiscDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveDisciplina} disabled={saving}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog entry */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Editar record' : 'Nuevo record'}</DialogTitle>
            <DialogDescription>
              El nombre del alumno se escribe manualmente; no hace falta que exista en el sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Disciplina</Label>
              <Select value={entryDiscId} onValueChange={setEntryDiscId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {disciplinas.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nombre} ({d.unidad === 'kg' ? 'kg' : 'tiempo'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-nombre">Nombre del alumno</Label>
              <Input
                id="entry-nombre"
                value={entryNombre}
                onChange={(e) => setEntryNombre(e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-valor">
                Valor {selectedUnidad === 'kg' ? '(kg)' : '(mm:ss)'}
              </Label>
              <Input
                id="entry-valor"
                value={entryValor}
                onChange={(e) => setEntryValor(e.target.value)}
                placeholder={selectedUnidad === 'kg' ? '80.5' : '04:32'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEntryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveEntry} disabled={saving}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDisc} onOpenChange={(o) => !o && setDeleteDisc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar disciplina</AlertDialogTitle>
            <AlertDialogDescription>
              Se van a borrar también todos los records de “{deleteDisc?.nombre}”. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDisc} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteEntry} onOpenChange={(o) => !o && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar record</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el record de {deleteEntry?.alumno_nombre}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
