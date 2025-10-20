import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Search, 
  Filter, 
  MoreHorizontal, 
  CheckCircle, 
  Clock, 
  Eye, 
  Calendar,
  User,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface Payment {
  id: string;
  usuario_id: string;
  email: string;
  first_name: string;
  last_name: string;
  monto: number;
  fecha_pago: string;
  periodo: string;
  estado: 'pendiente' | 'pagado';
  metodo_pago?: string;
  observaciones?: string;
  procesado_por?: string;
  procesado_at?: string;
  created_at: string;
}

export const AdminPayments = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pendiente' | 'pagado'>('all');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  // Cargar pagos al montar el componente
  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      
      // Obtener pagos con información del usuario
      const { data, error } = await supabase
        .from('pagos')
        .select(`
          *,
          profiles:usuario_id (
            first_name,
            last_name
          ),
          users:usuario_id (
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching payments:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los pagos",
          variant: "destructive",
        });
        return;
      }

      // Transformar datos para el formato esperado
      const transformedPayments = data?.map(payment => ({
        id: payment.id,
        usuario_id: payment.usuario_id,
        email: payment.users?.email || 'N/A',
        first_name: payment.profiles?.first_name || 'N/A',
        last_name: payment.profiles?.last_name || 'N/A',
        monto: payment.monto,
        fecha_pago: payment.fecha_pago,
        periodo: payment.periodo,
        estado: payment.estado,
        metodo_pago: payment.metodo_pago,
        observaciones: payment.observaciones,
        procesado_por: payment.procesado_por,
        procesado_at: payment.procesado_at,
        created_at: payment.created_at,
      })) || [];

      setPayments(transformedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: "Error",
        description: "Error inesperado al cargar los pagos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtrar pagos según búsqueda y filtro
  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || payment.estado === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Procesar pago (marcar como pagado)
  const handleProcessPayment = async (paymentId: string) => {
    try {
      setProcessingPayment(paymentId);
      
      const { error } = await supabase.rpc('marcar_pago_procesado', {
        pago_id: paymentId
      });

      if (error) {
        console.error('Error processing payment:', error);
        toast({
          title: "Error",
          description: "No se pudo procesar el pago",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Pago Procesado",
        description: "El pago ha sido marcado como procesado exitosamente",
      });

      // Recargar la lista de pagos
      await fetchPayments();
      setShowProcessDialog(false);
      setSelectedPayment(null);
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Error",
        description: "Error inesperado al procesar el pago",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(null);
    }
  };

  // Obtener estadísticas de pagos
  const getPaymentStats = () => {
    const total = payments.length;
    const pendientes = payments.filter(p => p.estado === 'pendiente').length;
    const pagados = payments.filter(p => p.estado === 'pagado').length;
    const totalMonto = payments.reduce((sum, p) => sum + p.monto, 0);
    const montoPendiente = payments
      .filter(p => p.estado === 'pendiente')
      .reduce((sum, p) => sum + p.monto, 0);

    return { total, pendientes, pagados, totalMonto, montoPendiente };
  };

  const stats = getPaymentStats();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando pagos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas de Pagos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pagos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-foreground">{stats.pendientes}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Procesados</p>
                <p className="text-2xl font-bold text-green-600">{stats.pagados}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monto Pendiente</p>
                <p className="text-2xl font-bold text-red-600">${stats.montoPendiente.toLocaleString()}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y Búsqueda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuario, email o ID de pago..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('all')}
                size="sm"
              >
                Todos
              </Button>
              <Button
                variant={filterStatus === 'pendiente' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('pendiente')}
                size="sm"
                className="text-muted-foreground"
              >
                <Clock className="w-4 h-4 mr-2" />
                Pendientes
              </Button>
              <Button
                variant={filterStatus === 'pagado' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('pagado')}
                size="sm"
                className="text-green-600"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Procesados
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Pagos */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Pagos</CardTitle>
          <CardDescription>
            Administra y procesa los pagos de cuotas mensuales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Usuario</th>
                  <th className="text-left p-3 font-medium">Monto</th>
                  <th className="text-left p-3 font-medium">Período</th>
                  <th className="text-left p-3 font-medium">Estado</th>
                  <th className="text-left p-3 font-medium">Fecha Pago</th>
                  <th className="text-left p-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{payment.first_name} {payment.last_name}</p>
                          <p className="text-sm text-muted-foreground">{payment.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-semibold">${payment.monto.toLocaleString()}</p>
                    </td>
                    <td className="p-3">
                      <p className="text-sm">{new Date(payment.periodo).toLocaleDateString('es-ES', { 
                        year: 'numeric', 
                        month: 'long' 
                      })}</p>
                    </td>
                    <td className="p-3">
                      <Badge 
                        variant={payment.estado === 'pagado' ? 'default' : 'secondary'}
                        className={payment.estado === 'pagado' ? 'bg-green-500 hover:bg-green-600' : 'bg-accent hover:bg-accent/80'}
                      >
                        {payment.estado === 'pagado' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Procesado
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 mr-1" />
                            Pendiente
                          </>
                        )}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.fecha_pago).toLocaleDateString('es-ES')}
                      </p>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => { setSelectedPayment(payment); setShowPaymentDetails(true); }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {payment.estado === 'pendiente' && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => { setSelectedPayment(payment); setShowProcessDialog(true); }}
                            disabled={processingPayment === payment.id}
                          >
                            {processingPayment === payment.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredPayments.length === 0 && (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No se encontraron pagos</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalles del Pago */}
      {showPaymentDetails && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Detalles del Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Usuario</label>
                <p className="text-sm text-muted-foreground">
                  {selectedPayment.first_name} {selectedPayment.last_name}
                </p>
                <p className="text-xs text-muted-foreground">{selectedPayment.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Monto</label>
                <p className="text-sm text-muted-foreground font-semibold">
                  ${selectedPayment.monto.toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Período</label>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedPayment.periodo).toLocaleDateString('es-ES', { 
                    year: 'numeric', 
                    month: 'long' 
                  })}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Estado</label>
                <Badge 
                  variant={selectedPayment.estado === 'pagado' ? 'default' : 'secondary'}
                  className={selectedPayment.estado === 'pagado' ? 'bg-green-500 hover:bg-green-600' : 'bg-accent hover:bg-accent/80'}
                >
                  {selectedPayment.estado === 'pagado' ? 'Procesado' : 'Pendiente'}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium">Fecha de Pago</label>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedPayment.fecha_pago).toLocaleDateString('es-ES')}
                </p>
              </div>
              {selectedPayment.metodo_pago && (
                <div>
                  <label className="text-sm font-medium">Método de Pago</label>
                  <p className="text-sm text-muted-foreground">{selectedPayment.metodo_pago}</p>
                </div>
              )}
              {selectedPayment.observaciones && (
                <div>
                  <label className="text-sm font-medium">Observaciones</label>
                  <p className="text-sm text-muted-foreground">{selectedPayment.observaciones}</p>
                </div>
              )}
              {selectedPayment.procesado_at && (
                <div>
                  <label className="text-sm font-medium">Procesado el</label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedPayment.procesado_at).toLocaleString('es-ES')}
                  </p>
                </div>
              )}
            </CardContent>
            <div className="p-6 pt-0 flex justify-end">
              <Button onClick={() => setShowPaymentDetails(false)}>
                Cerrar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Dialog de Confirmación de Procesamiento */}
      <AlertDialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Procesar Pago</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres marcar este pago como procesado?
              <br />
              <br />
              <strong>Usuario:</strong> {selectedPayment?.first_name} {selectedPayment?.last_name}
              <br />
              <strong>Monto:</strong> ${selectedPayment?.monto.toLocaleString()}
              <br />
              <strong>Período:</strong> {selectedPayment && new Date(selectedPayment.periodo).toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long' 
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPayment && handleProcessPayment(selectedPayment.id)}
              disabled={processingPayment === selectedPayment?.id}
            >
              {processingPayment === selectedPayment?.id ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Procesar Pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
