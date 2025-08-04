import { ClientAppointmentView } from "@/components/ClientAppointmentView";

const Turnos = () => {
  // Datos del profesional (en un caso real vendrían de una API)
  const professional = {
    name: "Dr. María González",
    specialty: "Medicina General",
    workingHours: { start: "09:00", end: "18:00" },
    appointmentDuration: 30,
    availableDays: [1, 2, 3, 4, 5] // Monday to Friday
  };

  return <ClientAppointmentView professional={professional} />;
};

export default Turnos; 