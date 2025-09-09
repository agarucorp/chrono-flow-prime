import { useAuthContext } from "@/contexts/AuthContext";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const UserDashboard = () => {
  const { user } = useAuthContext();

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
          <div className="text-sm text-muted-foreground">
            {user?.email}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle>Mis Clases</CardTitle>
                <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                  Turnos disponibles
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="reservar" className="w-full">
                <TabsList>
                  <TabsTrigger value="reservar">Reservar</TabsTrigger>
                  <TabsTrigger value="mis-turnos">Ver</TabsTrigger>
                </TabsList>
                <TabsContent value="reservar" className="mt-4">
                  <div className="p-4 text-center text-muted-foreground">
                    Calendario de reservas (próximamente)
                  </div>
                </TabsContent>
                <TabsContent value="mis-turnos" className="mt-4">
                  <div className="p-4 text-center text-muted-foreground">
                    Mis turnos reservados (próximamente)
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="default">Reservar Próximo Turno</Button>
              <Button className="w-full" variant="secondary">Ver Historial</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;


