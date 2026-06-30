import { Navbar } from "@/components/layout/Navbar";
import { Kicker } from "@/components/ui/surface";
import { Reveal } from "@/components/ui/reveal";
import { SettingsForm } from "./SettingsForm";

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-10 px-4 py-12 sm:px-6">
        <Reveal className="space-y-1.5">
          <Kicker>Configuration</Kicker>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Your API keys are stored encrypted and used only during your sessions.
          </p>
        </Reveal>

        <Reveal index={1}>
          <SettingsForm />
        </Reveal>

        <div className="border-t border-border pt-8">
          <p className="text-xs text-muted-foreground">
            Keys are stored in your account and used only by interview-buddy&apos;s server to call the
            model providers (Mistral, Cerebras, Groq, Gemini, Anthropic, Google Cloud TTS) on your behalf during your sessions.
            They are never shared or used for anything else.
          </p>
        </div>
      </main>
    </div>
  );
}
