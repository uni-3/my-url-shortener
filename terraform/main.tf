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

resource "cloudflare_r2_bucket" "trace_logs" {
  account_id = var.cloudflare_account_id
  name       = "url-shortener-traces-${var.environment}"
}

resource "cloudflare_logpush_job" "workers_trace_events" {
  account_id       = var.cloudflare_account_id
  dataset          = "workers_trace_events"
  name             = "workers-trace-events"
  destination_conf = "r2://${cloudflare_r2_bucket.trace_logs.name}/{DATE}?account-id=${var.cloudflare_account_id}&access-key-id=${var.r2_access_key_id}&secret-access-key=${var.r2_secret_access_key}"
  enabled          = true
}

output "d1_database_id" {
  value = cloudflare_d1_database.url_shortener_db.id
}

output "kv_namespace_id" {
  value = cloudflare_workers_kv_namespace.url_cache.id
}
