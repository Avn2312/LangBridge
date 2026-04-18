import Sidebar from "./Sidebar.jsx";
import Navbar from "./Navbar.jsx";
import VerificationBanner from "./VerificationBanner.jsx";

const Layout = ({ children, showSidebar = false }) => {
  return (
    <div className="min-h-screen">
      <div className="flex">
        {showSidebar && <Sidebar />}
        <div className="flex-1 flex flex-col">
          <Navbar />
          <VerificationBanner />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
