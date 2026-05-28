import React from "react";
import { LoaderIcon } from "lucide-react";

function PageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#08101D]">
      <LoaderIcon className="animate-spin size-10 text-cyan-300" />
    </div>
  );
}

export default PageLoader;
