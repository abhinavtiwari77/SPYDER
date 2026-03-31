import { Outlet } from "react-router-dom";
import LeftNav from "../Components/LeftNav";

const MainAppLayout = () => {
  return (
    <div className="w-full h-full flex flex-col bg-app">
      <LeftNav />
      <main className="w-full flex-1 overflow-y-auto pt-20 md:pt-24">
        <Outlet />
      </main>
    </div>
  );
};

export default MainAppLayout;
