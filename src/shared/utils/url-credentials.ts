// ==================== URL CREDENTIALS ====================
// A repository URL can carry credentials in its user part
// (https://user:token@host/…, https://token@host/…). They must not travel
// with a project file: the component import copies source bindings and the
// component's remote URL into every machine that imports it — into their
// repositories and reports (review 2026-11-11). Credentials of a private
// repository belong in the keychain (credentialRef), never in a URL.
//
//   https / http / git / ftp …  the whole user part goes
//   ssh://user:pw@host/…        the password goes, the user stays (ssh needs
//                               it; "git" is no secret)
//   git@host:path (scp form)    unchanged — a user name, no secret

const WITH_SCHEME = /^([a-z][a-z0-9+.-]*):\/\/([^/?#@]*)@(.*)$/i;

/** The URL without credentials in its user part (see above). */
export function withoutUrlCredentials(url: string): string {
  const m = WITH_SCHEME.exec(url.trim());
  if (!m) return url;
  const [, scheme, userInfo, rest] = m;
  if (/^(ssh|git\+ssh|ssh\+git)$/i.test(scheme)) {
    const user = userInfo.split(":")[0];
    return user ? `${scheme}://${user}@${rest}` : `${scheme}://${rest}`;
  }
  return `${scheme}://${rest}`;
}

/** Whether the URL carries credentials that withoutUrlCredentials would drop. */
export function hasUrlCredentials(url: string): boolean {
  return withoutUrlCredentials(url) !== url.trim() && WITH_SCHEME.test(url.trim());
}
