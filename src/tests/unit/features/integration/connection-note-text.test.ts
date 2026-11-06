// tests/unit/features/integration/connection-note-text.test.ts
//
// The connection test of every tracker reports a coded note; the Integration
// tab shows it in the UI language (release review 0.18: the adapters' status
// texts were English only). The English sentences stay as before.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import i18next from "i18next";
import { describe, expect, it } from "vitest";
import {
  connectionFailure,
  connectionNoteEnglish,
  type ConnectionNote,
} from "features/integration/adapters/adapter-support";
import { connectionNoteText } from "features/integration/services/connection-note-text";

const NOTES: ConnectionNote[] = [
  { code: "connected", account: "someone", count: 1, unit: "projects" },
  { code: "connected", account: "someone", count: 3, unit: "repositories" },
  { code: "authFailed", hint: "pat" },
  { code: "authFailed", hint: "emailApiToken" },
  { code: "authFailed", hint: "organizationPat" },
  { code: "authFailed", hint: "apiKey" },
  { code: "connectionFailed", detail: "500" },
  { code: "listFailed", status: 403, unit: "projects" },
  { code: "listFailed", status: 404, unit: "repositories" },
];

const locale = (lang: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "src/i18n/locales", lang, "common.json"), "utf8"));

async function t(lang: string) {
  const i18n = i18next.createInstance();
  await i18n.init({
    lng: lang,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    resources: { de: { translation: locale("de") }, en: { translation: locale("en") } },
  });
  return i18n.t.bind(i18n);
}

describe("connection test notes", () => {
  it("English sentences as before the codes", () => {
    expect(NOTES.map(connectionNoteEnglish)).toEqual([
      "Connected as someone — 1 project(s).",
      "Connected as someone — 3 repositories.",
      "Authentication failed — check the personal access token.",
      "Authentication failed — check e-mail and API token.",
      "Authentication failed — check the organization URL and the personal access token.",
      "Authentication failed — check the API key.",
      "Connection failed (500).",
      "Projects could not be loaded (403).",
      "Repositories could not be loaded (404).",
    ]);
  });

  it("a refused login is authFailed, anything else connectionFailed", () => {
    expect(connectionFailure({ ok: false, status: 401 } as never, "pat")).toEqual({ code: "authFailed", hint: "pat" });
    expect(connectionFailure({ ok: false, status: 0, error: "ENOTFOUND" } as never, "pat")).toEqual({
      code: "connectionFailed",
      detail: "ENOTFOUND",
    });
  });

  it("German UI: every note in German, with singular / plural", async () => {
    const de = await t("de");
    expect(NOTES.map((n) => connectionNoteText(n, de))).toEqual([
      "Verbunden als someone — 1 Projekt.",
      "Verbunden als someone — 3 Repositories.",
      "Anmeldung fehlgeschlagen — Personal Access Token prüfen.",
      "Anmeldung fehlgeschlagen — E-Mail und API-Token prüfen.",
      "Anmeldung fehlgeschlagen — Organisations-URL und Personal Access Token prüfen.",
      "Anmeldung fehlgeschlagen — API-Schlüssel prüfen.",
      "Verbindung fehlgeschlagen (500).",
      "Projekte konnten nicht geladen werden (403).",
      "Repositories konnten nicht geladen werden (404).",
    ]);
  });

  it("English UI: plural forms", async () => {
    const en = await t("en");
    expect(connectionNoteText(NOTES[0], en)).toBe("Connected as someone — 1 project.");
    expect(connectionNoteText({ ...NOTES[0], count: 2 } as ConnectionNote, en)).toBe("Connected as someone — 2 projects.");
  });
});
