import type { ReactNode } from "react";
import { MockStoreProvider } from "@/lib/mock-store-context";

interface PrototypeLayoutProps {
  children: ReactNode;
}

export default function PrototypeLayout({ children }: PrototypeLayoutProps) {
  return <MockStoreProvider>{children}</MockStoreProvider>;
}
