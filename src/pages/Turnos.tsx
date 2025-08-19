import { TurnoReservation } from "@/components/TurnoReservation";

const Turnos = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Sistema de Entrenamiento Personal
        </h1>
        <p className="text-muted-foreground">
          Reserva tus sesiones de entrenamiento personal
        </p>
      </div>
      
      <TurnoReservation />
    </div>
  );
};

export default Turnos; 