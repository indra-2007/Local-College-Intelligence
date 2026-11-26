import type { Metadata } from "next";
import { currentRole } from "@/lib/current-session";
import DocumentArchive from "./DocumentArchive";

export const metadata: Metadata = { title: "Upload documents" };

export default async function UploadPage() {
  const role = await currentRole();
  return <DocumentArchive role={role} />;
}
