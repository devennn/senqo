const TEAM_MEMBER_ERROR_MESSAGES: Record<string, string> = {
  user_not_found:
    "No Senqo account exists for this email. They must register before you can add them to this workspace.",
  user_disabled: "This account is disabled and cannot be added to the workspace.",
  already_member: "This person is already a member of this workspace.",
  already_owner: "This person already owns this workspace.",
  forbidden: "You do not have permission to do that.",
  invalid_payload: "Enter a valid email address or phone number.",
  unexpected_error: "Something went wrong. Try again.",
  no_whatsapp_connection: "Connect a WhatsApp line first.",
  invalid_connection: "Choose a WhatsApp line to send the code from.",
  phone_is_connection:
    "That number is already used by a WhatsApp connection in this workspace. Use a different personal number.",
  invalid_phone: "Enter a valid number with country code, e.g. 60123456789.",
  invalid_code: "That code is incorrect.",
  code_expired: "That code expired. Tap Resend code.",
  too_many_attempts: "Too many incorrect codes. Tap Resend code.",
  send_failed: "Could not send the code over WhatsApp. Try again.",
  user_not_teammate: "That person is not on this workspace team.",
};

export function teamMemberErrorMessage(code: string): string {
  const normalized = code.trim().toLowerCase();
  return TEAM_MEMBER_ERROR_MESSAGES[normalized] ?? code.replace(/_/g, " ");
}
