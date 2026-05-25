#!/usr/bin/env bash
# Genera (o rota) un API token de Wapu desde la línea de comandos.
#
# Flujo: POST /users/login (email+password) -> JWT -> POST /users/api-token (Bearer JWT) -> API token.
# Spec: https://docs.wapupay.com/openapi.es.json
#
# Uso:
#   bash scripts/get-wapu-token.sh                       # producción (default)
#   BE_URL=https://be-stage.wapu.app bash scripts/get-wapu-token.sh
#
# Solo el API token va a stdout, para poder pipear:
#   bash scripts/get-wapu-token.sh > .wapu_token
#
# Requisitos: bash, curl. No usa jq (parseo con sed).

set -euo pipefail

BE_URL="${BE_URL:-https://be-prod.wapu.app}"

# Todo lo informativo va a stderr para no contaminar el stdout.
log() { printf '%s\n' "$*" >&2; }

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "ERROR: falta '$1' en PATH"
    exit 127
  fi
}
require curl

# Extrae el valor de un campo string del primer nivel de un JSON. No es un parser
# completo: alcanza para {"access_token":"..."} y {"token":"..."} sin escapes raros.
extract_field() {
  local field="$1" json="$2"
  printf '%s' "$json" | sed -n "s/.*\"${field}\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" | head -n1
}

# POST <path> <body_json> [<bearer>]  ->  imprime body por stdout, status code por var STATUS.
http_post() {
  local path="$1" body="$2" bearer="${3:-}"
  local tmp status
  tmp="$(mktemp)"
  local -a auth=()
  [[ -n "$bearer" ]] && auth=(-H "Authorization: Bearer ${bearer}")
  status="$(
    curl -sS -o "$tmp" -w '%{http_code}' \
      -X POST "${BE_URL}${path}" \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/json' \
      "${auth[@]}" \
      --data "$body"
  )"
  STATUS="$status"
  cat "$tmp"
  rm -f "$tmp"
}

log "Wapu API token generator"
log "Target: ${BE_URL}"
log "ADVERTENCIA: si ya tenés un API token, este endpoint lo ROTA y el viejo deja de funcionar."
log ""

read -r -p "Email: " EMAIL </dev/tty
read -r -s -p "Password: " PASSWORD </dev/tty
log ""
log ""

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  log "ERROR: email y password son obligatorios"
  exit 2
fi

# Escapado mínimo de comillas para meter password en el JSON sin sustos.
escape_json() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
EMAIL_ESC="$(escape_json "$EMAIL")"
PASSWORD_ESC="$(escape_json "$PASSWORD")"
LOGIN_BODY="{\"email\":\"${EMAIL_ESC}\",\"password\":\"${PASSWORD_ESC}\"}"

log "[1/2] POST ${BE_URL}/users/login"
LOGIN_RESP="$(http_post /users/login "$LOGIN_BODY")"
if [[ "$STATUS" != "200" ]]; then
  log "ERROR: login falló (HTTP $STATUS)"
  log "$LOGIN_RESP"
  exit 1
fi

ACCESS_TOKEN="$(extract_field access_token "$LOGIN_RESP")"
if [[ -z "$ACCESS_TOKEN" ]]; then
  log "ERROR: no se pudo extraer access_token de la respuesta de login"
  log "$LOGIN_RESP"
  exit 1
fi
log "      OK (JWT recibido)"

log "[2/2] POST ${BE_URL}/users/api-token (Bearer JWT)"
TOKEN_RESP="$(http_post /users/api-token '{}' "$ACCESS_TOKEN")"
if [[ "$STATUS" != "201" && "$STATUS" != "200" ]]; then
  log "ERROR: api-token falló (HTTP $STATUS)"
  log "$TOKEN_RESP"
  if [[ "$STATUS" == "403" ]]; then
    log ""
    log "HTTP 403 normalmente significa que la cuenta no tiene api_enabled=true."
    log "Pedile al admin de Wapu que habilite el acceso a API tokens para esta cuenta."
  fi
  exit 1
fi

API_TOKEN="$(extract_field token "$TOKEN_RESP")"
if [[ -z "$API_TOKEN" ]]; then
  log "ERROR: no se pudo extraer el campo 'token' de la respuesta"
  log "$TOKEN_RESP"
  exit 1
fi

log "      OK (API token generado)"
log ""
log "Pegalo en el onboarding de la app. El servidor SOLO lo retorna esta vez."
log ""

printf '%s\n' "$API_TOKEN"
