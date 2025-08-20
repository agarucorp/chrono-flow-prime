import { AppointmentSystem } from "@/components/AppointmentSystem";
import { TestAuth } from "@/components/TestAuth";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div>
      <TestAuth />
      <AppointmentSystem />
      <Footer />
    </div>
  );
};

export default Index;
