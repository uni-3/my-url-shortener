variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "environment" {
  description = "Environment (development/production)"
  type        = string
  default     = "development"
}

variable "r2_access_key_id" {
  description = "R2 Access Key ID for Logpush"
  type        = string
  sensitive   = true
}

variable "r2_secret_access_key" {
  description = "R2 Secret Access Key for Logpush"
  type        = string
  sensitive   = true
}
