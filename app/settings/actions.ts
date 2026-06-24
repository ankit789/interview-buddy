"use server";

import { createClient } from "@/lib/supabase/server";
import { encryptSecret, KEY_FIELDS, type KeyField } from "@/lib/crypto";

export type KeyStatus = Record<KeyField, boolean>;

function emptyStatus(): KeyStatus {
  return Object.fromEntries(KEY_FIELDS.map((f) => [f, false])) as KeyStatus;
}

// Returns only WHETHER each provider key is set — never the values. Secrets must not be
// sent back to the browser.
export async function getKeyStatus(): Promise<KeyStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return emptyStatus();

  const { data } = await supabase
    .from("user_settings")
    .select(KEY_FIELDS.join(", "))
    .eq("user_id", user.id)
    .single();
  if (!data) return emptyStatus();

  const row = data as unknown as Record<string, unknown>;
  return Object.fromEntries(
    KEY_FIELDS.map((f) => [f, typeof row[f] === "string" && (row[f] as string).length > 0])
  ) as KeyStatus;
}

// Saves only the fields the user actually entered (encrypted); preserves the rest. An empty
// field leaves the existing key untouched rather than wiping it.
export async function saveKeys(
  input: Partial<Record<KeyField, string>>
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("user_settings")
    .select(KEY_FIELDS.join(", "))
    .eq("user_id", user.id)
    .single();
  const prev = (existing as unknown as Record<string, unknown> | null) ?? {};

  const row: Record<string, unknown> = { user_id: user.id };
  try {
    for (const f of KEY_FIELDS) {
      const incoming = input[f]?.trim();
      row[f] = incoming ? encryptSecret(incoming) : prev[f] ?? null;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Encryption failed" };
  }

  const { error } = await supabase
    .from("user_settings")
    .upsert(row, { onConflict: "user_id" });
  return error ? { error: error.message } : {};
}
