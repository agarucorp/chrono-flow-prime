import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ChangePasswordDialog } from './ChangePasswordDialog';

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

  useEffect(() => {
    const load = async () => {
      if (!open || !userId) return;
      try {
        setLoading(true);
        // Intentar cargar desde profiles; si no existe la tabla, continuar silenciosamente
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone')
          .eq('id', userId)
          .single();

        if (!error && data) {
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
          setPhone(data.phone || '');
        }
      } catch (_) {
        // Ignorar errores (p. ej. tabla inexistente)
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, userId]);

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Perfil</DialogTitle>
          <DialogDescription>Actualiza tus datos personales.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email ?? ''} disabled />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label>Seguridad</Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowChangePassword(true)}
              className="w-full justify-start"
              disabled={loading}
            >
              <Lock className="w-4 h-4 mr-2" />
              Cambiar Contraseña
            </Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
          </div>
        </div>
      </DialogContent>

      {/* Dialog para cambiar contraseña */}
      <ChangePasswordDialog
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </Dialog>
  );
};


