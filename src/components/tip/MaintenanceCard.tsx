import { Card } from '../layout/Card';

export function MaintenanceCard() {
  return (
    <Card className="w-100 !bg-[#1E1E1E] !border-[#8C8D8F] py-3 px-3">
      <div className="flex items-center justify-between">
        <p className="text-primary text-sm">
          We are currently undergoing maintenance. Please check back later.
        </p>
      </div>
    </Card>
  );
}
