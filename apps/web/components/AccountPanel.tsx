"use client";
import { useEffect, useState } from "react";
import { readerClient } from "@pagechime/core";
import { useAccount } from "../lib/account";
const api = readerClient("/api/reader");
type AccountRow = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  active: boolean;
};
export default function AccountPanel() {
  const { account, syncMessage, keepLocalChanges } = useAccount(),
    [accounts, setAccounts] = useState<AccountRow[]>([]),
    [error, setError] = useState(""),
    [invitation, setInvitation] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api<{ accounts: AccountRow[] }>("/admin/accounts").then((x) =>
      setAccounts(x.accounts),
    );
  useEffect(() => {
    if (account?.role === "admin") load().catch((e) => setError(e.message));
  }, [account?.role]);
  if (!account) return null;
  return (
    <div className="account-settings">
      {syncMessage && (
        <div className="sync-choice">
          <p role="status">{syncMessage}</p>
          {syncMessage.includes("another device") && (
            <button
              onClick={() =>
                keepLocalChanges().catch((e) => setError(e.message))
              }
            >
              Keep changes from this device
            </button>
          )}
        </div>
      )}
      <p>
        Signed in as <strong>{account.displayName}</strong>
        <br />
        <span className="quiet-note">@{account.username}</span>
      </p>
      <p>
        Your bookmarks, notes and reading place belong to your account. Imported
        book files stay on this device.
      </p>
      {account?.role === "admin" && (
        <>
          <h3>Library access</h3>
          <p className="quiet-note">
            Invite a reader or pause their access. Pausing also signs them out
            of their online sessions.
          </p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const { invite } = await api<{ invite: string }>(
                  "/admin/invites",
                  "POST",
                  {},
                );
                setInvitation(`${location.origin}/#invite=${invite}`);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Create invitation
          </button>
          {invitation && (
            <label className="invite-result">
              Private invitation · expires in 48 hours
              <input
                readOnly
                value={invitation}
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() =>
                  navigator.clipboard
                    .writeText(invitation)
                    .catch(() =>
                      setError("Select the invitation link to copy it."),
                    )
                }
              >
                Copy link
              </button>
            </label>
          )}
          <div className="account-list">
            {accounts.map((a) => (
              <div key={a.id}>
                <span>
                  <strong>{a.display_name}</strong>
                  <small>
                    @{a.username} · {a.active ? "Active" : "Paused"}
                  </small>
                </span>
                <button
                  disabled={busy || a.id === account.id}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await api(`/admin/accounts/${a.id}`, "PATCH", {
                        active: !a.active,
                      });
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {a.id === account.id
                    ? "You"
                    : a.active
                      ? "Pause access"
                      : "Restore access"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
