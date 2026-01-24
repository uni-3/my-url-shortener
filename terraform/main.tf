terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_d1_database" "url_shortener_db" {
  account_id = var.cloudflare_account_id
  name       = "url-shortener-${var.environment}"
}

resource "cloudflare_workers_kv_namespace" "url_cache" {
  account_id = var.cloudflare_account_id
  title      = "url-cache-${var.environment}"
}

output "d1_database_id" {
  value = cloudflare_d1_database.url_shortener_db.id
}

output "kv_namespace_id" {
  value = cloudflare_workers_kv_namespace.url_cache.id
}
