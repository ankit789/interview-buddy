import { Navbar } from "@/components/layout/Navbar";
import { SettingsForm } from "./SettingsForm";

export default function SettingsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 sm:px-6 py-12 space-y-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Your API keys are stored in your account and used only during your sessions.
          </p>
        </div>

        <SettingsForm />

        <div className="border-t border-border pt-8">
          <p className="text-xs text-muted-foreground">
            Keys are fetched client-side and sent directly to Groq and Anthropic — never proxied through our servers.
          </p>
        </div>
      </main>
    </div>
  );
}
