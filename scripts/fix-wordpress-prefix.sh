#!/usr/bin/env bash

set -euo pipefail

TARGET_PREFIX="wp_"
SOURCE_PREFIX=""
DRY_RUN="NO"
REPLACE_TARGET="NO"
METADATA_ONLY="NO"

usage() {
  cat <<'EOF'
Usage: lando fix-prefix [options]

Detect an imported WordPress database table prefix and rename it to wp_.

Options:
  --source-prefix <prefix>   Use a known source prefix instead of auto-detecting.
  --target-prefix <prefix>   Rename tables to this prefix. Defaults to wp_.
  --replace-target           Drop existing target-prefixed tables before renaming.
  --dry-run                  Show the changes without applying them.
  -h, --help                 Show this help.
EOF
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

sql_string() {
  local value=${1//\'/\'\'}
  printf "'%s'" "$value"
}

sql_identifier() {
  local value=${1//\`/\`\`}
  printf '`%s`' "$value"
}

contains() {
  local needle=$1
  shift

  local item
  for item in "$@"; do
    [[ "$item" == "$needle" ]] && return 0
  done

  return 1
}

has_table() {
  local needle=$1
  contains "$needle" "${tables[@]}"
}

has_core_tables() {
  local prefix=$1
  local suffix

  for suffix in options users usermeta posts postmeta; do
    has_table "${prefix}${suffix}" || return 1
  done

  return 0
}

run_db_query() {
  local query=$1

  if [[ "$DRY_RUN" == "YES" ]]; then
    printf '[dry-run] wp db query %q\n' "$query"
    return 0
  fi

  wp db query "$query" >/dev/null
}

run_config_set() {
  if [[ "$DRY_RUN" == "YES" ]]; then
    printf '[dry-run] wp config set table_prefix %q --type=variable\n' "$TARGET_PREFIX"
    return 0
  fi

  wp config set table_prefix "$TARGET_PREFIX" --type=variable >/dev/null
}

detect_stored_prefix() {
  local target_options_table="${TARGET_PREFIX}options"
  has_table "$target_options_table" || return 1

  local target_options_table_sql
  local target_user_roles_sql
  local prefix
  local stored_prefixes=()

  target_options_table_sql=$(sql_identifier "$target_options_table")
  target_user_roles_sql=$(sql_string "${TARGET_PREFIX}user_roles")

  mapfile -t stored_prefixes < <(wp db query "SELECT DISTINCT LEFT(option_name, CHAR_LENGTH(option_name) - CHAR_LENGTH('user_roles')) FROM ${target_options_table_sql} WHERE option_name LIKE '%user_roles' AND option_name <> ${target_user_roles_sql}" --skip-column-names)

  for prefix in "${stored_prefixes[@]}"; do
    [[ -n "$prefix" ]] || continue
    [[ "$prefix" != "$TARGET_PREFIX" ]] || continue
    printf '%s\n' "$prefix"
  done
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-prefix)
      SOURCE_PREFIX=${2:-}
      [[ -n "$SOURCE_PREFIX" ]] || fail '--source-prefix requires a value.'
      shift 2
      ;;
    --target-prefix)
      TARGET_PREFIX=${2:-}
      [[ -n "$TARGET_PREFIX" ]] || fail '--target-prefix requires a value.'
      shift 2
      ;;
    --replace-target)
      REPLACE_TARGET="YES"
      shift
      ;;
    --dry-run)
      DRY_RUN="YES"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

mapfile -t tables < <(wp db query "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name" --skip-column-names)

[[ ${#tables[@]} -gt 0 ]] || fail 'No database tables found. Import a WordPress database first.'

if [[ -n "$SOURCE_PREFIX" ]]; then
  if has_core_tables "$SOURCE_PREFIX"; then
    METADATA_ONLY="NO"
  elif has_core_tables "$TARGET_PREFIX"; then
    METADATA_ONLY="YES"
  else
    fail "Could not find a WordPress table set for source prefix '$SOURCE_PREFIX'."
  fi
else
  candidates=()
  non_target_candidates=()

  for table in "${tables[@]}"; do
    [[ "$table" == *options ]] || continue

    prefix=${table%options}
    [[ -n "$prefix" ]] || continue

    if has_core_tables "$prefix" && ! contains "$prefix" "${candidates[@]}"; then
      candidates+=("$prefix")

      if [[ "$prefix" != "$TARGET_PREFIX" ]]; then
        non_target_candidates+=("$prefix")
      fi
    fi
  done

  if [[ ${#non_target_candidates[@]} -eq 1 ]]; then
    SOURCE_PREFIX=${non_target_candidates[0]}
  elif [[ ${#non_target_candidates[@]} -eq 0 ]] && has_core_tables "$TARGET_PREFIX"; then
    mapfile -t stored_prefixes < <(detect_stored_prefix)

    if [[ ${#stored_prefixes[@]} -eq 1 ]]; then
      SOURCE_PREFIX=${stored_prefixes[0]}
      METADATA_ONLY="YES"
    elif [[ ${#stored_prefixes[@]} -eq 0 ]]; then
      printf 'Database tables already use the %s prefix.\n' "$TARGET_PREFIX"
      run_config_set
      exit 0
    else
      printf 'Detected multiple possible stored prefixes in %soptions:\n' "$TARGET_PREFIX" >&2
      printf '  %s\n' "${stored_prefixes[@]}" >&2
      fail 'Re-run with --source-prefix <prefix>.'
    fi
  elif [[ ${#non_target_candidates[@]} -eq 0 ]]; then
    fail 'Could not detect a WordPress table prefix.'
  else
    printf 'Detected multiple possible source prefixes:\n' >&2
    printf '  %s\n' "${non_target_candidates[@]}" >&2
    fail 'Re-run with --source-prefix <prefix>.'
  fi
fi

if [[ "$SOURCE_PREFIX" == "$TARGET_PREFIX" ]]; then
  printf 'Database tables already use the %s prefix.\n' "$TARGET_PREFIX"
  run_config_set
  exit 0
fi

source_tables=()
target_collisions=()
option_prefix_updates=()

if [[ "$METADATA_ONLY" == "YES" ]]; then
  option_prefix_updates+=("${SOURCE_PREFIX}options:${TARGET_PREFIX}options")
else
  for table in "${tables[@]}"; do
    [[ "$table" == "$SOURCE_PREFIX"* ]] || continue

    source_tables+=("$table")
    target_table="${TARGET_PREFIX}${table#"$SOURCE_PREFIX"}"

    if has_table "$target_table"; then
      target_collisions+=("$target_table")
    fi
  done

  [[ ${#source_tables[@]} -gt 0 ]] || fail "No tables found with source prefix '$SOURCE_PREFIX'."
fi

if [[ ${#target_collisions[@]} -gt 0 && "$REPLACE_TARGET" != "YES" ]]; then
  printf 'Target-prefixed tables already exist and would be overwritten:\n' >&2
  printf '  %s\n' "${target_collisions[@]}" >&2
  fail 'Back up the database, then re-run with --replace-target if these local target tables can be dropped.'
fi

if [[ "$METADATA_ONLY" == "YES" ]]; then
  printf 'Tables already use %s. Updating stored WordPress prefix values from %s to %s.\n' "$TARGET_PREFIX" "$SOURCE_PREFIX" "$TARGET_PREFIX"
else
  printf 'Renaming WordPress database prefix from %s to %s.\n' "$SOURCE_PREFIX" "$TARGET_PREFIX"
fi

if [[ "$METADATA_ONLY" != "YES" && ${#target_collisions[@]} -gt 0 ]]; then
  drop_tables=()

  for table in "${target_collisions[@]}"; do
    drop_tables+=("$(sql_identifier "$table")")
  done

  run_db_query 'SET FOREIGN_KEY_CHECKS=0'
  run_db_query "DROP TABLE IF EXISTS $(IFS=,; printf '%s' "${drop_tables[*]}")"
  run_db_query 'SET FOREIGN_KEY_CHECKS=1'
fi

rename_pairs=()

if [[ "$METADATA_ONLY" != "YES" ]]; then
  for table in "${source_tables[@]}"; do
    target_table="${TARGET_PREFIX}${table#"$SOURCE_PREFIX"}"
    rename_pairs+=("$(sql_identifier "$table") TO $(sql_identifier "$target_table")")

    if [[ "$table" == *options ]]; then
      option_prefix_updates+=("$table:$target_table")
    fi
  done

  run_db_query 'SET FOREIGN_KEY_CHECKS=0'
  run_db_query "RENAME TABLE $(IFS=,; printf '%s' "${rename_pairs[*]}")"
  run_db_query 'SET FOREIGN_KEY_CHECKS=1'
fi

for pair in "${option_prefix_updates[@]}"; do
  source_options_table=${pair%%:*}
  target_options_table=${pair#*:}
  old_option_prefix=${source_options_table%options}
  new_option_prefix=${target_options_table%options}

  old_option_prefix_sql=$(sql_string "$old_option_prefix")
  new_option_prefix_sql=$(sql_string "$new_option_prefix")
  target_options_table_sql=$(sql_identifier "$target_options_table")

  run_db_query "DELETE target FROM ${target_options_table_sql} target INNER JOIN ${target_options_table_sql} source ON target.option_name = CONCAT(${new_option_prefix_sql}, SUBSTRING(source.option_name, CHAR_LENGTH(${old_option_prefix_sql}) + 1)) WHERE LEFT(source.option_name, CHAR_LENGTH(${old_option_prefix_sql})) = ${old_option_prefix_sql} AND LEFT(target.option_name, CHAR_LENGTH(${new_option_prefix_sql})) = ${new_option_prefix_sql}"
  run_db_query "UPDATE ${target_options_table_sql} SET option_name = CONCAT(${new_option_prefix_sql}, SUBSTRING(option_name, CHAR_LENGTH(${old_option_prefix_sql}) + 1)) WHERE LEFT(option_name, CHAR_LENGTH(${old_option_prefix_sql})) = ${old_option_prefix_sql}"

  if has_table "${SOURCE_PREFIX}usermeta" || has_table "${TARGET_PREFIX}usermeta"; then
    target_usermeta_table_sql=$(sql_identifier "${TARGET_PREFIX}usermeta")
    run_db_query "DELETE target FROM ${target_usermeta_table_sql} target INNER JOIN ${target_usermeta_table_sql} source ON target.user_id = source.user_id AND target.meta_key = CONCAT(${new_option_prefix_sql}, SUBSTRING(source.meta_key, CHAR_LENGTH(${old_option_prefix_sql}) + 1)) WHERE LEFT(source.meta_key, CHAR_LENGTH(${old_option_prefix_sql})) = ${old_option_prefix_sql} AND LEFT(target.meta_key, CHAR_LENGTH(${new_option_prefix_sql})) = ${new_option_prefix_sql}"
    run_db_query "UPDATE ${target_usermeta_table_sql} SET meta_key = CONCAT(${new_option_prefix_sql}, SUBSTRING(meta_key, CHAR_LENGTH(${old_option_prefix_sql}) + 1)) WHERE LEFT(meta_key, CHAR_LENGTH(${old_option_prefix_sql})) = ${old_option_prefix_sql}"
  fi
done

run_config_set

printf 'Database prefix update complete.\n'
