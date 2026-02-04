terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket                      = "my-url-shortener-tfstate"
    key                         = "terraform.tfstate"
    region                      = "us-east-1"
    force_path_style            = true # Required for R2
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
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
