variable "project_name" { type = string default = "visionqa" }
variable "location" { type = string default = "eastus" }
variable "environment" { type = string default = "dev" }

variable "resource_group_name" { type = string default = null }

variable "postgres_admin_user" { type = string default = "visionqa_admin" }
variable "postgres_admin_password" { type = string default = null sensitive = true }
variable "postgres_version" { type = string default = "16" }

variable "vm_size" { type = string default = "Standard_B2s" }
variable "vm_admin_username" { type = string default = "azureuser" }
variable "vm_admin_ssh_pubkey" { type = string default = null }

# Container Registry / Apps (opcional)
variable "acr_sku" { type = string default = "Basic" }
variable "backend_image" { type = string default = null }
variable "frontend_image" { type = string default = null } 