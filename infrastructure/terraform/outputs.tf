output "resource_group_name" { value = azurerm_resource_group.rg.name }
output "storage_account_name" { value = azurerm_storage_account.sa.name }
output "postgres_fqdn" { value = azurerm_postgresql_flexible_server.pg.fqdn }
output "vm_public_ip" { value = azurerm_public_ip.pip.ip_address }

output "azure_cv_endpoint" { value = azurerm_cognitive_account.cv.endpoint }
output "azure_cv_key" { value = azurerm_cognitive_account.cv.primary_access_key sensitive = true } 