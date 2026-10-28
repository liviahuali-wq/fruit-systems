"use client";

import { useActionState } from "react";
import { confirmNewAuthenticator, startAuthenticatorSetup, type SetupState } from "@/app/auth-actions";
import { AuthForm, CodeField } from "@/components/auth-form";

// Shows the QR code once it is requested and keeps it on screen through wrong codes.
export function SetupFlow() {
  const [setup, start, starting] = useActionState<SetupState>(startAuthenticatorSetup, {});

  if (!setup.factorId) {
    return (
      <form action={start} className="flex flex-col gap-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>Install an authenticator app, such as Microsoft Authenticator or Google Authenticator.</li>
          <li>Show your QR code here and scan it with the app.</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        {setup.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{setup.error}</p>}
        <button
          type="submit"
          disabled={starting}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {starting ? "Please wait…" : "Show my QR code"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        In your authenticator app, add an account and scan this code. Then enter the 6-digit code it shows.
      </p>
      {/* The QR code is an SVG data URL from Supabase; next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qrCode} alt="QR code to add Fruit Systems to your authenticator app" className="mx-auto h-48 w-48 bg-white p-2" />
      <details className="text-sm text-zinc-600 dark:text-zinc-400">
        <summary className="cursor-pointer">Can&apos;t scan? Enter this key instead</summary>
        <code className="mt-2 block break-all rounded bg-zinc-100 p-2 dark:bg-zinc-900">{setup.secret}</code>
      </details>
      <AuthForm action={confirmNewAuthenticator} submitLabel="Confirm and sign in">
        <input type="hidden" name="factorId" value={setup.factorId} />
        <CodeField />
      </AuthForm>
    </div>
  );
}
