import React from "react";
import { LoaderIcon } from "lucide-react";

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08101D]">
      <LoaderIcon className="animate-spin size-10 text-cyan-300" />
    </div>
  );
}

export default PageLoader;
