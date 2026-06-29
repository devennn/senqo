const TEAM_MEMBER_ERROR_MESSAGES: Record<string, string> = {
  user_not_found:
    "No Senqo account exists for this email. They must register before you can add them to this workspace.",
  user_disabled: "This account is disabled and cannot be added to the workspace.",
  already_member: "This person is already a member of this workspace.",
  already_owner: "This person already owns this workspace.",
  forbidden: "Only the workspace owner can add members.",
  invalid_payload: "Enter a valid email address.",
  unexpected_error: "Something went wrong. Try again.",
};

export function teamMemberErrorMessage(code: string): string {
  const normalized = code.trim().toLowerCase();
  return TEAM_MEMBER_ERROR_MESSAGES[normalized] ?? code.replace(/_/g, " ");
}
