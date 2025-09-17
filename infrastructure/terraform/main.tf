locals {
  name     = lower("${var.project_name}-${var.environment}")
  rg_name  = coalesce(var.resource_group_name, "${local.name}-rg")
}

resource "azurerm_resource_group" "rg" {
  name     = local.rg_name
  location = var.location
}

resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}

resource "azurerm_storage_account" "sa" {
  name                     = replace(substr("${local.name}${random_string.suffix.result}", 0, 24), "-", "")
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

# PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "pg" {
  name                   = "${local.name}-pg"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = var.postgres_version
  administrator_login    = var.postgres_admin_user
  administrator_password = var.postgres_admin_password
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"
  zone                   = "1"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_all_azure" {
  name                = "allow-azure"
  server_id           = azurerm_postgresql_flexible_server.pg.id
  start_ip_address    = "0.0.0.0"
  end_ip_address      = "0.0.0.0"
}

# Networking para VM
resource "azurerm_virtual_network" "vnet" {
  name                = "${local.name}-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_subnet" "subnet" {
  name                 = "app"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]
}

resource "azurerm_public_ip" "pip" {
  name                = "${local.name}-pip"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_network_security_group" "nsg" {
  name                = "${local.name}-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "allow_ssh"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow_http"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow_api"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "8000"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_interface" "nic" {
  name                = "${local.name}-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.subnet.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.pip.id
  }
}

resource "azurerm_network_interface_security_group_association" "nic_nsg" {
  network_interface_id      = azurerm_network_interface.nic.id
  network_security_group_id = azurerm_network_security_group.nsg.id
}

resource "azurerm_linux_virtual_machine" "vm" {
  name                = "${local.name}-vm"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  size                = var.vm_size
  admin_username      = var.vm_admin_username
  network_interface_ids = [azurerm_network_interface.nic.id]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }

  admin_ssh_key {
    username   = var.vm_admin_username
    public_key = var.vm_admin_ssh_pubkey
  }
}

resource "azurerm_cognitive_account" "cv" {
  name                = "${local.name}-cv"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  kind                = "ComputerVision"
  sku_name            = "S0"
  custom_subdomain_name = "${local.name}-cv"
}

resource "azurerm_container_registry" "acr" {
  name                = replace(substr("${local.name}acr", 0, 50), "-", "")
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = var.acr_sku
  admin_enabled       = true
}

resource "azurerm_container_app_environment" "aca_env" {
  name                       = "${local.name}-aca-env"
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = azurerm_resource_group.rg.location
  infrastructure_subnet_id   = null
  log_analytics_workspace_id = null
}

# Backend Container App
resource "azurerm_container_app" "backend" {
  name                         = "${local.name}-api"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.aca_env.id
  revision_mode                = "Single"

  template {
    container {
      name   = "api"
      image  = coalesce(var.backend_image, "${azurerm_container_registry.acr.login_server}/visionqa-backend:latest")
      cpu    = 0.5
      memory = "1Gi"
      env {
        name  = "APP_PORT"
        value = "8000"
      }
      env { name = "OPENAI_API_KEY" value = "${var.openai_api_key}" }
      env { name = "OPENAI_MODEL" value = "gpt-4o-mini" }
      env { name = "AZURE_OPENAI_ENDPOINT" value = var.azure_openai_endpoint }
      env { name = "AZURE_OPENAI_API_KEY" value = var.azure_openai_api_key }
      env { name = "AZURE_OPENAI_DEPLOYMENT" value = var.azure_openai_deployment }
      env { name = "AZURE_OPENAI_API_VERSION" value = "2024-06-01" }
      env { name = "AZURE_CV_ENDPOINT" value = azurerm_cognitive_account.cv.endpoint }
      env { name = "AZURE_CV_KEY" value = azurerm_cognitive_account.cv.primary_access_key }
    }
    scale {
      min_replicas = 1
      max_replicas = 3
      http_concurrency = 100
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8000
    transport        = "auto"
  }
}

# Frontend Container App
resource "azurerm_container_app" "frontend" {
  name                         = "${local.name}-web"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.aca_env.id
  revision_mode                = "Single"

  template {
    container {
      name   = "web"
      image  = coalesce(var.frontend_image, "${azurerm_container_registry.acr.login_server}/visionqa-frontend:latest")
      cpu    = 0.5
      memory = "1Gi"
      env {
        name  = "NEXT_PUBLIC_BACKEND_URL"
        value = azurerm_container_app.backend.latest_revision_fqdn != null ? "https://${azurerm_container_app.backend.latest_revision_fqdn}" : ""
      }
    }
    scale {
      min_replicas = 1
      max_replicas = 2
      http_concurrency = 100
    }
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "auto"
  }
} 