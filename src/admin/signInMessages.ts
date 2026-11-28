// Plain-language reasons for the /admin sign-in and access screens.
// Supabase auth errors carry a stable `code`; older clients only a message.

export type AuthErrorLike =
  | { code?: string | null; message?: string | null; status?: number | null }
  | null
  | undefined;

export function signInErrorMessage(err: AuthErrorLike): string {
  if (!err) return "";
  const code = (err.code ?? "").toLowerCase();
  const msg = (err.message ?? "").toLowerCase();
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "This email is not confirmed yet. Confirm admin@xtsy.one in Lovable Cloud → Users (or from the confirmation email), then sign in again.";
  }
  if (
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials")
  ) {
    return "Email or password is wrong, or this user does not exist in this project. Check Lovable Cloud → Users, or use “Forgot password”.";
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    err.status === 429
  ) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (code === "user_banned")
    return "This user is blocked in Lovable Cloud → Users.";
  if (
    err.status === 0 ||
    msg.includes("failed to fetch") ||
    msg.includes("network")
  ) {
    return "Could not reach the sign-in service. Check your connection and try again.";
  }
  return `Sign-in failed: ${err.message ?? "unknown error"}`;
}

export type DeniedReason = "wrong_email" | "unconfirmed" | "no_admin_role";

export function deniedReason(
  user: { email?: string | null; email_confirmed_at?: string | null },
  superAdminEmail: string,
): DeniedReason {
  if (!user.email_confirmed_at) return "unconfirmed";
  return (user.email ?? "").toLowerCase() === superAdminEmail ? "no_admin_role" : "wrong_email";
}

export function deniedMessage(reason: DeniedReason, email: string): string {
  switch (reason) {
    case "wrong_email":
      return `${email} has no console access, or its login is switched off. Ask the property admin or the super admin.`;
    case "unconfirmed":
      return `${email} is signed in but its email is not confirmed. Confirm it in Lovable Cloud → Users, then sign in again.`;
    case "no_admin_role":
      return `${email} is signed in and confirmed, but does not have its required admin or front-desk staff role yet.`;
  }
}
