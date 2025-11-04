import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        {/* Top bar with notifications */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex justify-end items-center px-8 py-3">
            <NotificationBell />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};
