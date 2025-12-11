import Sidebar from "~/shared/layouts/sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Sidebar>
      <section className="overflow-hidden">{children}</section>
    </Sidebar>
  );
}
