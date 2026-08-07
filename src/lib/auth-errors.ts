// Traduz erros da API de autenticação em mensagens amigáveis (PT-BR).

export function friendlyAuthError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const m = raw.toLowerCase();

  if (!m) return "Ocorreu um erro inesperado. Tente novamente.";

  // Falha de rede / backend indisponível
  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network request failed") ||
    m.includes("load failed") ||
    m.includes("fetch failed")
  ) {
    return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
  }

  // Limite de envio
  if (
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("over_email_send_rate_limit") ||
    m.includes("security purposes")
  ) {
    return "Erro ao enviar o e-mail. Tente novamente em instantes.";
  }

  if (m.includes("user not found") || m.includes("email not found")) {
    return "Este e-mail não foi encontrado.";
  }

  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }

  if (m.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (m.includes("error sending") || m.includes("smtp") || m.includes("email")) {
    return "Erro ao enviar o e-mail. Tente novamente em instantes.";
  }

  if (m.includes("expired") || m.includes("invalid token") || m.includes("otp")) {
    return "Link expirado ou inválido. Solicite um novo link de recuperação.";
  }

  if (m.includes("password") && m.includes("short")) {
    return "A senha precisa ter no mínimo 8 caracteres.";
  }

  if (m.includes("pwned") || m.includes("compromised")) {
    return "Esta senha foi encontrada em vazamentos. Escolha outra senha.";
  }

  return raw;
}
