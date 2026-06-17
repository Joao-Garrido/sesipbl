import { Sidebar } from "@/shared/components/Sidebar";
import { StoreSync } from "@/features/dashboard/StoreSync";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <StoreSync />
      <Sidebar />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
