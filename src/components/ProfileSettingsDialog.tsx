import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, X, Calendar, Clock, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { ChangeScheduleModal } from './ChangeScheduleModal';

interface ProfileSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  email: string | null;
}

export const ProfileSettingsDialog: React.FC<ProfileSettingsDialogProps> = ({ open, onClose, userId, email }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeSchedule, setShowChangeSchedule] = useState(false);
  const [currentSchedules, setCurrentSchedules] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<number | null>(null);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!open || !userId) return;
      try {
        setLoading(true);
        // Intentar cargar desde profiles; si no existe la tabla, continuar silenciosamente
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, combo_asignado')
          .eq('id', userId)
          .single();

        // Obtener metadata fresca del usuario como fallback
        const { data: authUserResp } = await supabase.auth.getUser();
        const meta = authUserResp?.user?.user_metadata || {};

        if (!error && data) {
          setFirstName(data.first_name || meta.first_name || '');
          setLastName(data.last_name || meta.last_name || '');
          // Fallback al teléfono del user_metadata si profiles.phone está vacío
          const mergedPhone = (data.phone ?? meta.phone ?? '') as string;
          setPhone(mergedPhone);
          setCurrentPlan(data.combo_asignado || null);
        } else {
          // Si no hay fila en profiles o hubo error, usar metadata
          setFirstName(meta.first_name || '');
          setLastName(meta.last_name || '');
          setPhone(meta.phone || '');
        }
        
        // Cargar horarios actuales
        await loadCurrentSchedules();
      } catch (_) {
        // Ignorar errores (p. ej. tabla inexistente)
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, userId]);

  const loadCurrentSchedules = async () => {
    if (!userId) return;
    try {
      setLoadingSchedules(true);
      const { data, error } = await supabase
        .from('vista_horarios_usuarios')
        .select('*')
        .eq('usuario_id', userId)
        .eq('activo', true)
        .order('dia_semana', { ascending: true })
        .order('clase_numero', { ascending: true });

      if (error) {
        console.error('Error cargando horarios:', error);
        return;
      }

      setCurrentSchedules(data || []);
      
      // Obtener plan actual desde profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('combo_asignado')
        .eq('id', userId)
        .single();
      
      if (profileData) {
        setCurrentPlan(profileData.combo_asignado);
      }
    } catch (error) {
      console.error('Error cargando horarios:', error);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    try {
      setSaving(true);
      // Actualizar metadata del usuario (seguro aunque no exista profiles)
      await supabase.auth.updateUser({
        data: {
          first_name: firstName || null,
          last_name: lastName || null,
          phone: phone || null,
        },
      });

      // Intentar persistir también en profiles si la tabla existe
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          first_name: firstName || null,
          last_name: lastName || null,
          phone: phone || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error && (error.code === 'PGRST116' || (error.message || '').includes('relation'))) {
        // Tabla no existe: ignorar
      }

      onClose();
    } catch (e) {
      // Podríamos mostrar un toast si hay sistema de notificaciones
      console.error('Error guardando perfil:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Botón X para mobile */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute right-2 top-2 sm:hidden h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <DialogHeader className="pb-3 sm:block hidden">
          <DialogTitle className="text-sm">Configurar Perfil</DialogTitle>
          <DialogDescription className="text-sm">Actualiza tus datos personales.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Mobile view */}
          <div className="sm:hidden space-y-4">
            {/* Email - solo lectura */}
            <div className="space-y-2">
              <Label className="text-xs">Email</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground">{email || 'No configurado'}</p>
              </div>
            </div>

            {/* Nombre y Apellido - editables */}
            <div className="space-y-2">
              <Label htmlFor="firstName-mobile" className="text-xs">Nombre</Label>
              <Input id="firstName-mobile" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} className="text-xs h-9" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName-mobile" className="text-xs">Apellido</Label>
              <Input id="lastName-mobile" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} className="text-xs h-9" />
            </div>

            {/* Teléfono - editable */}
            <div className="space-y-2">
              <Label htmlFor="phone-mobile" className="text-xs">Teléfono</Label>
              <Input id="phone-mobile" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} className="text-xs h-9" placeholder="+54 9 11 1234-5678" />
            </div>

            {/* Sección de Horarios Actuales */}
            <div className="space-y-2">
              <Label className="text-xs">Plan y horarios</Label>
              <Card className="p-3">
                {loadingSchedules ? (
                  <p className="text-xs text-muted-foreground">Cargando...</p>
                ) : currentSchedules.length > 0 ? (
                  <div className="space-y-2">
                    {currentPlan && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium">Plan actual:</span>
                        <Badge variant="outline" className="text-xs">Plan {currentPlan}</Badge>
                      </div>
                    )}
                    <div className="space-y-1">
                      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((diaNombre, index) => {
                        const diaNumero = index + 1;
                        const horariosDia = currentSchedules.filter(h => h.dia_semana === diaNumero);
                        if (horariosDia.length === 0) return null;
                        return (
                          <div key={diaNumero} className="flex items-center gap-2 text-xs">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium w-16">{diaNombre}:</span>
                            <div className="flex flex-wrap gap-1">
                              {horariosDia.map((h, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  <Clock className="h-2.5 w-2.5 mr-1" />
                                  {h.hora_inicio?.substring(0, 5)} - {h.hora_fin?.substring(0, 5)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      onClick={() => setShowChangeSchedule(true)}
                      className="w-full text-xs h-8 mt-2"
                      variant="outline"
                    >
                      <Edit className="w-3 h-3 mr-2" />
                      Cambiar horarios
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-xs text-muted-foreground mb-2">No tienes horarios configurados</p>
                    <Button
                      type="button"
                      onClick={() => setShowChangeSchedule(true)}
                      className="w-full text-xs h-8"
                      variant="outline"
                    >
                      <Calendar className="w-3 h-3 mr-2" />
                      Configurar horarios
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            {/* CTA Cambiar Contraseña */}
            <Button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="w-full text-xs h-9"
              style={{ backgroundColor: '#6b7280', color: '#ffffff', borderColor: '#4b5563' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4b5563'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#6b7280'; }}
              disabled={loading}
            >
              <Lock className="w-3.5 h-3.5 mr-2" />
              Cambiar Contraseña
            </Button>

            {/* Botón Guardar */}
            <Button 
              className="w-full text-xs h-9 bg-white text-gray-900 hover:bg-gray-100 border border-gray-300" 
              onClick={handleSave} 
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>

          {/* Desktop view */}
          <div className="hidden sm:block space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email-desktop" className="text-sm">Email</Label>
              <Input id="email-desktop" value={email ?? ''} disabled className="text-sm" />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName-desktop" className="text-sm">Nombre</Label>
                <Input id="firstName-desktop" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName-desktop" className="text-sm">Apellido</Label>
                <Input id="lastName-desktop" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} className="text-sm" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone-desktop" className="text-sm">Teléfono</Label>
              <Input id="phone-desktop" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} className="text-sm" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Seguridad</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowChangePassword(true)}
                className="w-full justify-start text-sm h-9"
                disabled={loading}
              >
                <Lock className="w-4 h-4 mr-2" />
                Cambiar Contraseña
              </Button>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 text-sm h-9" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button className="flex-1 text-sm h-9 bg-white text-gray-900 hover:bg-gray-100 border border-gray-300" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Dialog para cambiar contraseña */}
      <ChangePasswordDialog
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {/* Dialog para cambiar horarios */}
      <ChangeScheduleModal
        isOpen={showChangeSchedule}
        onClose={() => {
          setShowChangeSchedule(false);
          loadCurrentSchedules(); // Recargar horarios después de cerrar
        }}
        onComplete={() => {
          setShowChangeSchedule(false);
          loadCurrentSchedules(); // Recargar horarios después de completar
        }}
        currentSchedules={currentSchedules}
        currentPlan={currentPlan}
      />
    </Dialog>
  );
};

