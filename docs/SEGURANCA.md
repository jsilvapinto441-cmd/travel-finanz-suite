# Segurança

[Voltar ao README](../README.md)

## Credenciais

- Nenhuma chave privada fica no código. A chave administrativa (`SUPABASE_SERVICE_ROLE_KEY`) e a chave de IA (`LOVABLE_API_KEY`) são lidas apenas no servidor, por variáveis de ambiente.
- Os valores de `SUPABASE_URL` e da chave pública (`*_PUBLISHABLE_KEY`) são **públicos por natureza**: eles vão para o navegador de qualquer visitante. A proteção dos dados vem das regras de segurança por linha (RLS), não do sigilo dessa chave.
- Use `.env.example` como modelo e nunca publique um `.env` com chaves privadas.

## Proteção dos dados

- RLS ativa em todas as tabelas do schema `public`.
- Cada usuário acessa apenas registros com o seu `owner_id` e arquivos na sua própria pasta.
- Perfis de acesso guardados em uma tabela separada e verificados no banco e nas funções de servidor.
- Operações administrativas só rodam no servidor, depois de confirmar que o usuário é administrador.
- Endpoints de IA exigem token de usuário. O endpoint público de backup exige o header `apikey`.

## Sessão

- Saída automática após 30 minutos sem atividade.
- Troca de e-mail exige a senha atual.
- Mensagens de erro de autenticação tratadas, sem expor detalhes internos.

## Dados de demonstração

O repositório não contém dados de clientes. As capturas de tela mostram apenas a tela pública de login.

## Como reportar um problema

Se encontrar uma vulnerabilidade, entre em contato diretamente com o mantenedor do repositório em vez de abrir uma issue pública.
