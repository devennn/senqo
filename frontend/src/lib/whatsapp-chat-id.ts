export function phoneToWhatsappChatId(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `${digits}@c.us`;
}
