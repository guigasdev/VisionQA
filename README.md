# VisionQA

Sistema de perguntas e respostas com OCR + IA (OpenAI/Azure OpenAI), com infraestrutura como código (Terraform), provisionamento (Ansible), backend Fastify (TypeScript) e frontend Next.js.

## Estrutura

```
backend/
frontend/
infrastructure/
  terraform/
ansible/
.github/workflows/ci.yml
.env.example
```

## Backend (TypeScript + Fastify)

- Rotas:
  - `GET /healthz`
  - `POST /ask/` (form-data): `file` (imagem opcional), `question` (texto opcional), `model` (opcional)
  - Resposta: `{ answer, prompt, usage, elapsed_ms }`
- OCR: Azure Image Analysis (`AZURE_CV_ENDPOINT`, `AZURE_CV_KEY`)
- IA: OpenAI ou Azure OpenAI

### Rodar localmente

```bash
cd backend
cp ../.env.example ../.env
npm install
npm run dev
# API: http://localhost:8000/healthz e /ask/
```

### Docker

```bash
cd backend
docker compose up --build
```

## Frontend

- Next.js (App Router) com Tailwind CSS
- Upload de imagem, colagem via Ctrl+V, histórico com localStorage, dark mode e exportação .txt

```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

## Infra (Terraform na Azure)

Pré-requisitos:
- Azure Subscription + Service Principal com permissões
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`

```bash
cd infrastructure/terraform
terraform init
terraform plan -var "postgres_admin_password=SEU_SEGREDO" -var "vm_admin_ssh_pubkey=$(cat ~/.ssh/id_rsa.pub)"
terraform apply -auto-approve -var "postgres_admin_password=SEU_SEGREDO" -var "vm_admin_ssh_pubkey=$(cat ~/.ssh/id_rsa.pub)"
```

## Provisionamento (Ansible)

```bash
cd ansible
ansible-galaxy collection install community.docker
ansible-playbook -i inventory.ini playbook.yml \
  -e vm_public_ip=IP_DA_VM -e vm_admin_username=azureuser -e ssh_private_key_path=~/.ssh/id_rsa \
  -e openai_api_key=... -e azure_openai_endpoint=... -e azure_openai_api_key=... -e azure_openai_deployment=... \
  -e azure_cv_endpoint=... -e azure_cv_key=...
```

## CI/CD (GitHub Actions)

- `ci.yml` executa Terraform, Ansible, build do frontend e valida backend TS.
- Ajuste os segredos conforme documentado.

## Diagrama arquitetural

```mermaid
flowchart LR
    A[GitHub / Azure DevOps Pipeline] --> B[Terraform]
    B --> C[Azure]
    C --> D[Ansible -> Backend em VM]
    D --> E[Frontend (Next.js)]
    D --> F[Backend Fastify]
    C --> G[Storage Account]
    F --> H[OCR (Azure CV)]
    F --> I[IA (OpenAI/Azure OpenAI)]
``` 