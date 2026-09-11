import DocumentPreview from "@/components/DocumentPreview";
import { Files } from "lucide-react";

export const metadata = { title: "Files & Preview | Evergreen Water" };

export default function DocumentsPage() {
  return <div><div className="flex items-center gap-3 mb-6"><div className="w-11 h-11 rounded-2xl bg-aquaSoft text-aqua flex items-center justify-center"><Files size={22} /></div><div><h1 className="font-display text-2xl font-semibold">Files & Preview</h1><p className="text-sm text-slate">Business documents ko open aur verify karein.</p></div></div><DocumentPreview /></div>;
}
