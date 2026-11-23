variable "IMAGE_NAMESPACE" {
  default = "opspilot-local"
}

variable "IMAGE_TAG" {
  default = "dev"
}

variable "IMAGE_SOURCE" {
  default = null
}

variable "IMAGE_REVISION" {
  default = null
}

variable "USE_GHA_CACHE" {
  default = false
}

group "default" {
  targets = ["app"]
}

target "app" {
  matrix = {
    component = ["frontend", "incident", "monitor", "notification"]
  }

  name      = component
  context   = component == "frontend" ? "./frontend" : "./services/${component}-service"
  contexts  = component == "frontend" ? { nginx_config = "./infrastructure/nginx" } : {}
  platforms = ["linux/amd64"]
  tags      = ["${IMAGE_NAMESPACE}/opspilot-${component}:${IMAGE_TAG}"]

  labels = {
    "org.opencontainers.image.source"   = IMAGE_SOURCE
    "org.opencontainers.image.revision" = IMAGE_REVISION
  }

  cache-from = USE_GHA_CACHE ? ["type=gha,scope=opspilot-${component}"] : []
  cache-to   = USE_GHA_CACHE ? ["type=gha,scope=opspilot-${component},mode=max,ignore-error=true"] : []
}
