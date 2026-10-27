/** Shared account form rules. Email is an identifier, not a verified address. */
export const normalizeReaderUsername = (value: string) =>
  value.trim().toLowerCase();
export function validReaderUsername(value: string) {
  if (/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(value)) return true;
  if (value.length > 254) return false;
  const parts = value.split("@");
  return (
    parts.length === 2 &&
    /^[a-z0-9][a-z0-9_.+-]{0,63}$/.test(parts[0]) &&
    parts[1].split(".").length >= 2 &&
    parts[1]
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  );
}
export function readerDetailsError(
  username: string,
  password: string,
  name?: string,
) {
  if (!validReaderUsername(normalizeReaderUsername(username)))
    return "Enter an email address or a username of 3–40 letters, numbers, dots, hyphens or underscores.";
  if (password.length < 12 || password.length > 256)
    return "Use 12–256 characters for your password.";
  if (name !== undefined && (!name.trim() || name.length > 80))
    return "Enter your name using 1–80 characters.";
  return "";
}
