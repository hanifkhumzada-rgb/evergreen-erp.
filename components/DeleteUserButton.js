"use client";
import { Trash2 } from "lucide-react";
import { deleteUser } from "@/app/actions";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";

export default function DeleteUserButton({ userId, userName, isSelf }) {
  if (isSelf) {
    return (
      <button type="button" disabled title="You can't delete your own account from this screen"
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line text-coral text-xs font-semibold opacity-40 cursor-not-allowed">
        <Trash2 size={13} /> Delete
      </button>
    );
  }

  return (
    <ReasonConfirmButton
      action={deleteUser} id={userId} label="Delete" icon={Trash2}
      confirmText={`Permanently delete ${userName}?`}
      detailText="This can't be undone. Their login and profile will be removed immediately."
      confirmLabel="Confirm Delete" busyLabel="Deleting…"
    />
  );
}
