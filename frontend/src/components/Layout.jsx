import Sidebar from "./Sidebar.jsx";
import Navbar from "./Navbar.jsx";
import VerificationBanner from "./VerificationBanner.jsx";

const Layout = ({ children, showSidebar = false, showNavbar = true }) => {
  return (
    <div className="h-screen overflow-hidden bg-[#08101D]">
      <div className="flex h-full">
        {showSidebar && <Sidebar />}
        <div className="flex min-w-0 flex-1 flex-col">
          {showNavbar && <Navbar />}
          <VerificationBanner />
          <main className="min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
