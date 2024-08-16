#!/usr/bin/env bash

pg_data_path="/var/lib/postgresql/data"
dump_path="$pg_data_path/dump/$PGENV"

read -p $'\n💩 Enter the name of the dump file you want to restore: ' dump_file_name
dump_file_name="${dump_file_name%.sql}"

if [[ ! -f "$dump_path/$dump_file_name.sql" ]]; then
  echo -e "\n💩 ERROR - Dump file not found: .dump/${PGENV}/${dump_file_name}.sql 💩\n"
  exit 1
fi

mkdir -p $dump_path
dump_pathname="$dump_path/$dump_file_name.sql"

echo -e "💩 Restoring ${PGENV} database from ${dump_file_name}.sql... 💩\n"

psql -f ${dump_pathname}

echo -e "\n💩 ${PGENV} database restore from ${dump_file_name}.sql complete 💩\n"

